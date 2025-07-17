const express = require('express');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { connectToDatabase } = require('../config/db');
const jwt = require('jsonwebtoken');

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;

// Get notifications
router.get('/api/user/notifications', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const user = await User.findOne({ username: decoded.username });
  if (!user) return res.status(404).json({ error: "User not found" });
  const notifications = await Notification.find({ student: user._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("book", "title");
  res.json(notifications);
});

// Mark notification as read
router.post('/api/user/notifications/:id/read', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const user = await User.findOne({ username: decoded.username });
  if (!user) return res.status(404).json({ error: "User not found" });
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, student: user._id },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  res.json({ success: true });
});

// Mark all notifications as read
router.post('/api/user/notifications/read-all', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const user = await User.findOne({ username: decoded.username });
  if (!user) return res.status(404).json({ error: "User not found" });
  await Notification.updateMany(
    { student: user._id, isRead: false },
    { $set: { isRead: true } }
  );
  res.json({ success: true });
});

// Get unread notification count
router.get('/api/user/notifications/unread-count', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const user = await User.findOne({ username: decoded.username });
  if (!user) return res.status(404).json({ error: "User not found" });
  const count = await Notification.countDocuments({
    student: user._id,
    isRead: false
  });
  res.json({ count });
});

module.exports = router; 