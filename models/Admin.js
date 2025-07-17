const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
});

const Admin = mongoose.model("Admins", adminSchema);
module.exports = Admin; 