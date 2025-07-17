const express = require('express');
const Request = require('../models/Request');
const User = require('../models/User');
const Book = require('../models/Book');
const Notification = require('../models/Notification');
const { connectToDatabase } = require('../config/db');

const router = express.Router();

// Submit a new book request
router.post('/api/requests', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const { studentId, bookId, days } = req.body;
  const book = await Book.findById(bookId);
  if (!book || book.availableCopies <= 0) {
    return res.status(400).json({ error: "Book not available" });
  }
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  const newRequest = new Request({
    student: studentId,
    book: bookId,
    dueDate,
    status: "Pending",
  });
  await newRequest.save();
  res.status(201).json({ message: "Request submitted successfully!" });
});

// Get all requests
router.get('/api/requests', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const requests = await Request.find()
    .populate("student", "username")
    .populate("book", "title");
  res.json(requests);
});

// Update request status (approve/reject)
router.put('/api/requests/:id', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const { status } = req.body;
  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const request = await Request.findById(req.params.id)
    .populate("student")
    .populate("book");
  if (!request) return res.status(404).json({ error: "Request not found" });
  const notificationType = request.isRenewal ? 
    (status === "Approved" ? "renewal-approved" : "renewal-rejected") :
    (status === "Approved" ? "request-approved" : "request-rejected");
  const notificationMessage = request.isRenewal ?
    (status === "Approved" ? 
     `Your renewal for "${request.book.title}" has been approved` :
     `Your renewal for "${request.book.title}" has been rejected`) :
    (status === "Approved" ?
     `Your request for "${request.book.title}" has been approved` :
     `Your request for "${request.book.title}" has been rejected`);
  const notification = new Notification({
    student: request.student._id,
    message: notificationMessage,
    type: notificationType,
    book: request.book._id,
  });
  await notification.save();
  if (status === "Approved") {
    const book = await Book.findById(request.book._id);
    if (!book) return res.status(404).json({ error: "Book not found" });
    if (request.isRenewal) {
      const student = await User.findById(request.student._id);
      const borrowedBook = student.borrowedBooks.find(
        b => b.bookId.toString() === request.book._id.toString()
      );
      if (borrowedBook) {
        borrowedBook.dueDate = request.dueDate;
        borrowedBook.status = "Active";
        await student.save();
        await Book.findByIdAndUpdate(
          request.book._id, 
          { $inc: { renewals: 1 } },
          { new: true }
        );
      }
    } else {
      if (book.availableCopies <= 0) {
        return res.status(400).json({ error: "Book not available" });
      }
      await User.findByIdAndUpdate(
        request.student._id,
        {
          $push: {
            borrowedBooks: {
              bookId: request.book._id,
              dueDate: request.dueDate,
              status: "Active",
            },
          },
        },
        { new: true }
      );
      book.availableCopies -= 1;
      book.borrowCount = (book.borrowCount || 0) + 1;
      await book.save();
    }
  }
  request.status = status;
  await request.save();
  res.json({ 
    message: "Request status updated successfully",
    updatedBook: status === "Approved" && request.isRenewal 
      ? await Book.findById(request.book._id) 
      : null
  });
});

module.exports = router; 