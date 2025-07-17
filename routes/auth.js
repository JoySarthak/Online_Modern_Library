const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { connectToDatabase } = require('../config/db');

const router = express.Router();

const SECRET_KEY = process.env.SECRET_KEY;

// Registration Route
router.post('/post', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  // ... existing code from /post route ...
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format" });
  }
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    return res.status(400).json({ success: false, message: existingUser.username === username ? "Username already exists" : "Email already registered" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, email, password: hashedPassword });
  await newUser.save();
  res.status(201).json({ success: true, message: "User registered successfully!", user: { id: newUser._id, username: newUser.username } });
});

// Login Route
router.post('/logon', async (req, res) => {
  await connectToDatabase(process.env.MONGODB_URI);
  const { role, username, password } = req.body;
  let user;
  if (role === "admin") {
    user = await Admin.findOne({ username });
    if (!user) return res.status(404).json({ error: "Admin not found" });
  } else if (role === "student") {
    user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "Student not found" });
  } else {
    return res.status(400).json({ error: "Invalid role selected" });
  }
  let passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) return res.status(401).json({ error: "Incorrect password" });
  const token = jwt.sign({ username: user.username, role }, SECRET_KEY, { expiresIn: "1h" });
  res.cookie("token", token, { httpOnly: true });
  res.json({ message: "Login successful", role, username: user.username, userId: user._id, token });
});

// User Profile Route
router.get('/api/user/profile', (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.json({ username: decoded.username, role: decoded.role });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Logout Route
router.post('/api/auth/logout', (req, res) => {
  try {
    res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error during logout' });
  }
});

// Change Username
router.post('/api/user/change-username', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const { newUsername, password } = req.body;
  if (!newUsername || !password) return res.status(400).json({ error: "All fields are required" });
  if (newUsername.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });
  const user = await User.findOne({ username: decoded.username });
  if (!user) return res.status(404).json({ error: "User not found" });
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) return res.status(401).json({ error: "Incorrect password" });
  const usernameExists = await User.findOne({ username: newUsername });
  if (usernameExists && usernameExists._id.toString() !== user._id.toString()) {
    return res.status(400).json({ error: "Username already taken" });
  }
  user.username = newUsername;
  await user.save();
  const newToken = jwt.sign({ username: newUsername, role: decoded.role }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ success: true, message: "Username updated successfully", token: newToken });
});

// Change Password
router.post('/api/user/change-password', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const decoded = jwt.verify(token, SECRET_KEY);
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "All fields are required" });
  if (newPassword.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });
  const user = await User.findOne({ username: decoded.username });
  if (!user) return res.status(404).json({ error: "User not found" });
  const passwordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatch) return res.status(401).json({ error: "Current password is incorrect" });
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();
  const newToken = jwt.sign({ username: user.username, role: decoded.role }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ success: true, message: "Password updated successfully", token: newToken });
});

module.exports = router; 