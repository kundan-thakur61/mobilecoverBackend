require('dotenv').config();
const delhiveryService = require('./utils/deliveryOne');
const logger = require('./utils/logger');

console.log('🔍 Checking Delhivery Configuration...');
console.log('=====================================');

// Check token
try {
  delhiveryService.validateCredentials();
  console.log('✅ API Token: Available');
} catch (error) {
  console.log('❌ API Token:', error.message);
}

// Check pickup configuration
console.log('📍 Pickup Location Configuration:');
console.log('  - Location:', delhiveryService.pickupLocation);
console.log('  - Address:', delhiveryService.pickupAddress);
console.log('  - Pincode:', delhiveryService.pickupPincode);
console.log('  - City:', delhiveryService.pickupCity);
console.log('  - State:', delhiveryService.pickupState);
console.log('  - Country:', delhiveryService.pickupCountry);
console.log('  - Phone:', delhiveryService.pickupPhone);

// Check company details
console.log('🏢 Company Details:');
console.log('  - Name:', delhiveryService.companyName);
console.log('  - GST:', delhiveryService.gstNumber || 'Not set');

console.log('\n📋 Environment Variables Check:');
const requiredVars = [
  'DELHIVERY_API_KEY',
  'DELHIVERY_PICKUP_PINCODE',
  'DELHIVERY_PICKUP_CITY',
  'DELHIVERY_PICKUP_STATE',
  'DELHIVERY_COMPANY_NAME'
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`  - ${varName}: ${value ? '✅ Set' : '❌ Missing'}`);
});

console.log('\n🔗 API Base URL:', process.env.DELHIVERY_API_BASE_URL || 'Not set');
