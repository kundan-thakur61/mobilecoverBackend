require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node queryUser.js <email>');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce';
(async () => {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const user = await User.findOne({ email }).lean();
  console.log(user ? JSON.stringify(user, null, 2) : 'User not found');
  process.exit(0);
})();
