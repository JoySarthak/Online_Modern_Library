const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ["request-approved", "request-rejected", "renewal-approved", "renewal-rejected", "system"], required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification; 