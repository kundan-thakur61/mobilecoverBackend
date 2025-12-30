require('dotenv').config();

console.log('Testing Environment Variables:');
console.log('SHIPROCKET_EMAIL:', process.env.SHIPROCKET_EMAIL);
console.log('SHIPROCKET_PASSWORD:', process.env.SHIPROCKET_PASSWORD ? '***' + process.env.SHIPROCKET_PASSWORD.slice(-4) : 'NOT SET');
console.log('SHIPROCKET_API_BASE_URL:', process.env.SHIPROCKET_API_BASE_URL);
