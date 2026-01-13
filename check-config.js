require('dotenv').config();
const delhiveryService = require('./utils/deliveryOne');

console.log('📍 Current Delhivery Configuration:');
console.log('Pickup Location:', delhiveryService.pickupLocation);
console.log('Pickup Pincode:', delhiveryService.pickupPincode);
console.log('Pickup City:', delhiveryService.pickupCity);
console.log('Pickup Phone:', delhiveryService.pickupPhone);
console.log('Company Name:', delhiveryService.companyName);
console.log('GST Number:', delhiveryService.gstNumber);
console.log('API Base URL:', process.env.DELHIVERY_API_BASE_URL);
console.log('API Key:', process.env.DELHIVERY_API_KEY ? 'SET' : 'NOT SET');
