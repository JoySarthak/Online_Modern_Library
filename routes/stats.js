const express = require('express');
const Book = require('../models/Book');
const User = require('../models/User');
const Request = require('../models/Request');
const { connectToDatabase } = require('../config/db');

const router = express.Router();

// Dashboard stats
router.get('/api/stats', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const totalBooks = await Book.countDocuments();
  const totalStudents = await User.countDocuments();
  const totalBorrowsResult = await Book.aggregate([
    { $group: { _id: null, totalBorrows: { $sum: "$borrowCount" } } }
  ]);
  const totalBorrows = totalBorrowsResult.length > 0 ? totalBorrowsResult[0].totalBorrows : 0;
  res.json({
    totalBooks,
    totalStudents,
    totalBorrows,
    pendingRequests: await Request.countDocuments({ status: "Pending" }),
  });
});

// Borrowing trend (if used)
router.get('/stats/borrowing-trend', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  // Note: Borrowing model is not defined in the provided code, so this is a placeholder.
  // If you have a Borrowing model, import and use it here.
  res.status(501).json({ error: 'Borrowing trend not implemented (Borrowing model missing)' });
});

module.exports = router; 