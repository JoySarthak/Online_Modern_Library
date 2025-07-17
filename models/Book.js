const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  copies: Number,
  availableCopies: Number,
  isbn: String,
  link: String,
  category: String,
  imageCoverLink: String,
  renewals: { type: Number, default: 0 },
  borrowCount: { type: Number, default: 0 }
});

const Book = mongoose.model("Book", bookSchema);
module.exports = Book; 