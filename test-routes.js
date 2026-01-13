require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();

// Connect to database first
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob')
  .then(() => {
    console.log('✅ Database connected');
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

// Import the same routes as app.js
const shiprocketRoutes = require('./routes/shiprocket');

app.use('/api/shiprocket', shiprocketRoutes);

// Add middleware to log all requests
app.use((req, res, next) => {
  console.log('🔍 REQUEST:', req.method, req.url);
  next();
});

app.listen(4001, () => {
  console.log('Test server running on port 4001');
  
  // Test the route
  const axios = require('axios');
  
  setTimeout(() => {
    console.log('\n🧪 Testing route...');
    axios.get('http://localhost:4001/api/shiprocket/track/69246fedbcc220e6f3894d0f')
      .then(response => {
        console.log('✅ Response:', response.status, response.data);
      })
      .catch(error => {
        console.log('❌ Error:', error.response?.status, error.response?.data);
      })
      .finally(() => {
        process.exit(0);
      });
  }, 2000); // Wait longer for DB connection
});
