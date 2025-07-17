const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  borrowedBooks: [
    {
      bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
      dueDate: { type: Date, required: true },
      status: {
        type: String,
        enum: ["Active", "Expired", "Pending Renewal"],
        default: "Active"
      },
    },
  ],
});

const User = mongoose.model("Student", userSchema);
module.exports = User; 