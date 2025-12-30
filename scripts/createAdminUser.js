require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];
const password = process.argv[3] || 'admin123';
const name = process.argv[4] || 'Admin User';

if (!email) {
  console.error('Usage: node createAdminUser.js <email> [password] [name]');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce';

(async () => {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    let user = await User.findOne({ email });
    if (user) {
      user.role = 'admin';
      user.passwordHash = password;
      user.name = name;
      await user.save();
      console.log('Updated existing user to admin:', user.email);
      process.exit(0);
    }

    user = new User({ name, email, passwordHash: password, role: 'admin' });
    await user.save();
    console.log('Created admin user:', user.email);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin user:', err);
    process.exit(2);
  }
})();
