const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('Current directory:', __dirname);
console.log('Loading .env from:', path.join(__dirname, '.env'));
console.log('\nEnvironment Variables:');
console.log('SHIPROCKET_EMAIL:', process.env.SHIPROCKET_EMAIL);
console.log('SHIPROCKET_PASSWORD:', process.env.SHIPROCKET_PASSWORD ? '***' + process.env.SHIPROCKET_PASSWORD.slice(-4) : 'NOT SET');
console.log('SHIPROCKET_API_BASE_URL:', process.env.SHIPROCKET_API_BASE_URL);
