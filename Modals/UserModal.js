const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true }, 
  password: { type: String, required: true },
  mobile: { type: Number},
  city: { type: String },
  subscription: {
    type: String,
    enum: ['basic', 'medium', 'premium'],
    default: 'basic',
  }, 
});

const User = mongoose.model('signup', userSchema);

module.exports = User;


