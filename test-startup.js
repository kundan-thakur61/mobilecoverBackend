require('dotenv').config();
console.log('Environment variables loaded:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('DELHIVERY_API_KEY:', process.env.DELHIVERY_API_KEY ? '✅ Set' : '❌ Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');

try {
  const mongoose = require('mongoose');
  console.log('MongoDB connection string:', process.env.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce');
  
  mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce')
    .then(() => {
      console.log('✅ MongoDB connected successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ MongoDB connection failed:', err.message);
      process.exit(1);
    });
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
