require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node promoteToAdmin.js <email>');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce';

(async () => {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const user = await User.findOneAndUpdate({ email }, { $set: { role: 'admin' } }, { new: true });
    if (!user) {
      console.error('User not found:', email);
      process.exit(2);
    }

    console.log('User promoted to admin:', user.email, user.role);
    process.exit(0);
  } catch (err) {
    console.error('Error promoting user:', err);
    process.exit(3);
  }
})();
