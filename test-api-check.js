require('dotenv').config();

// Import the deliveryOne utility
const deliveryOneUtil = require('./utils/deliveryOne');

// Wait for the API check to complete
setTimeout(() => {
  console.log('Testing Delhivery API availability check...\n');
  
  // The module checks API availability on load
  // We'll just wait a bit and then check the status
  console.log('API check should have completed by now.');
  console.log('If you see "Delhivery API is available" in the logs above, the API is working!');
  console.log('If you see "using mock implementation", the API check failed.');
  
  process.exit(0);
}, 6000); // Wait 6 seconds for the check to complete
