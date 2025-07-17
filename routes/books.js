const express = require('express');
const Book = require('../models/Book');
const User = require('../models/User');
const Request = require('../models/Request');
const { connectToDatabase } = require('../config/db');
const jwt = require('jsonwebtoken');

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;

// Add Book (Admin)
router.post('/admin/addBook', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const { title, author, copies, isbn, link, category, imageCoverLink } = req.body;
  if (!title || !author || !copies || !isbn) {
    return res.status(400).json({ error: "Title, author, copies and ISBN are required" });
  }
  const existingBook = await Book.findOne({ isbn });
  if (existingBook) {
    return res.status(400).json({ error: "A book with this ISBN already exists" });
  }
  const newBook = new Book({
    title,
    author,
    copies: parseInt(copies),
    availableCopies: parseInt(copies),
    isbn,
    link: link || null,
    category: category || "General",
    imageCoverLink: imageCoverLink || null
  });
  await newBook.save();
  res.status(201).json({ message: "Book added successfully", book: newBook });
});

// Get Books (with search & pagination)
router.get('/api/books', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;
  let query = {};
  if (req.query.search && req.query.search.trim()) {
    const searchTerm = req.query.search.trim();
    query = {
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { author: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } }
      ]
    };
  }
  const total = await Book.countDocuments(query);
  const books = await Book.find(query)
    .select('title author copies availableCopies isbn link category imageCoverLink borrowCount')
    .sort({ title: 1 })
    .skip(skip)
    .limit(limit);
  res.set('X-Total-Count', total);
  res.json(books);
});

// Get Book Stats
router.get('/api/books/stats', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const books = await Book.find().select('title copies availableCopies renewals category');
  const bookStats = books.map(book => ({
    title: book.title,
    category: book.category || 'General',
    copiesTotal: book.copies,
    copiesAvailable: book.availableCopies,
    copiesBorrowed: book.copies - book.availableCopies,
    renewals: book.renewals || 0
  }));
  res.json(bookStats);
});

// Get User's Borrowed Books
router.get('/api/user/books', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const student = await User.findOne({ username: decoded.username }).populate("borrowedBooks.bookId");
  if (!student) return res.status(404).json({ error: "User not found" });
  const books = student.borrowedBooks.map((borrowedBook) => ({
    _id: borrowedBook.bookId._id,
    title: borrowedBook.bookId.title,
    author: borrowedBook.bookId.author,
    dueDate: borrowedBook.dueDate,
    status: borrowedBook.status,
    link: borrowedBook.bookId.link
  }));
  res.json(books);
});

// Update Book Status (Expired)
router.post('/api/user/updateBookStatus', async (req, res) => {
  const { bookId } = req.body;
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const student = await User.findOne({ username: decoded.username });
  if (!student) return res.status(404).json({ error: "User not found" });
  const borrowedBook = student.borrowedBooks.find((book) => book.bookId.toString() === bookId);
  if (!borrowedBook) return res.status(404).json({ error: "Book not found in user's list" });
  const currentDate = new Date();
  if (borrowedBook.dueDate < currentDate && borrowedBook.status !== "Expired") {
    borrowedBook.status = "Expired";
    await student.save();
    await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: 1 } });
    return res.json({ message: "Book status updated to Expired" });
  }
  res.json({ message: "Book status unchanged" });
});

// Book Renewal Request
router.post('/api/books/renew', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const { studentId, bookId, days } = req.body;
  const student = await User.findById(studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });
  const book = await Book.findById(bookId);
  if (!book) return res.status(404).json({ error: "Book not found" });
  const borrowedBook = student.borrowedBooks.find(b => b.bookId.toString() === bookId);
  if (!borrowedBook) return res.status(400).json({ error: "You haven't borrowed this book" });
  const newDueDate = new Date();
  newDueDate.setDate(newDueDate.getDate() + parseInt(days));
  const newRequest = new Request({
    student: studentId,
    book: bookId,
    dueDate: newDueDate,
    status: "Pending",
    isRenewal: true
  });
  await newRequest.save();
  borrowedBook.status = "Pending Renewal";
  await student.save();
  res.json({ message: "Renewal request submitted successfully!" });
});

module.exports = router; 