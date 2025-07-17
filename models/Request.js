const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  book: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
  requestDate: { type: Date, default: Date.now },
  dueDate: Date,
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  isRenewal: { type: Boolean, default: false }
});

const Request = mongoose.model("Request", requestSchema);
module.exports = Request; 