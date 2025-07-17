const express = require('express');
const User = require('../models/User');
const { connectToDatabase } = require('../config/db');

const router = express.Router();

// Get all students
router.get('/api/students', async (req, res) => {
  const students = await User.find();
  res.json(students);
});

// Update student
router.put('/api/students/:id', async (req, res) => {
  const { username, email, status } = req.body;
  const studentId = req.params.id;
  const updatedStudent = await User.findByIdAndUpdate(
    studentId,
    { username, email, status },
    { new: true, runValidators: true }
  );
  if (!updatedStudent) {
    return res.status(404).json({ error: "Student not found" });
  }
  res.json({
    message: "Student updated successfully",
    student: updatedStudent,
  });
});

// Delete student
router.delete('/api/students/:id', async (req, res) => {
  const studentId = req.params.id;
  const deletedStudent = await User.findByIdAndDelete(studentId);
  if (!deletedStudent) {
    return res.status(404).json({ error: "Student not found" });
  }
  res.json({ message: "Student deleted successfully" });
});

// Get single student
router.get('/api/students/:id', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const studentId = req.params.id;
  const student = await User.findById(studentId);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }
  res.json({
    _id: student._id,
    username: student.username,
    email: student.email,
    status: student.status,
  });
});

// Student stats
router.get('/api/student/stats', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const jwt = require('jsonwebtoken');
  const SECRET_KEY = process.env.SECRET_KEY;
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const student = await User.findOne({ username: decoded.username }).populate("borrowedBooks.bookId");
  if (!student) return res.status(404).json({ error: "Student not found" });
  const currentDate = new Date();
  const totalBorrowed = student.borrowedBooks.length;
  const activeBooks = student.borrowedBooks.filter((book) => {
    const dueDate = new Date(book.dueDate);
    return dueDate >= currentDate && book.status === "Active";
  }).length;
  const expiredBooks = student.borrowedBooks.filter((book) => {
    const dueDate = new Date(book.dueDate);
    return dueDate < currentDate || book.status === "Expired";
  }).length;
  res.json({
    borrowedCount: totalBorrowed,
    activeCount: activeBooks,
    expiredCount: expiredBooks,
    success: true,
  });
});

module.exports = router; 