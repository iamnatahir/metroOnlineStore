const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, enum: ["customer", "admin"] },
 
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
