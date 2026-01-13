require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.DELHIVERY_API_KEY;
const BASE_URL = 'https://staging-express.delhivery.com';

async function testTracking() {
  console.log('Testing tracking with different auth methods...');
  
  // Method 1: Authorization header
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/packages/json/`, {
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      params: {
        waybill: '1234567890123',
        verbose: '1'
      }
    });
    console.log('✅ Tracking with Authorization header works:', response.status);
    return true;
  } catch (error) {
    console.log('❌ Tracking with Authorization header failed:', error.response?.status);
  }
  
  // Method 2: Token as parameter
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/packages/json/`, {
      params: {
        waybill: '1234567890123',
        verbose: '1',
        token: API_KEY
      }
    });
    console.log('✅ Tracking with token parameter works:', response.status);
    return true;
  } catch (error) {
    console.log('❌ Tracking with token parameter failed:', error.response?.status);
  }
  
  return false;
}

testTracking();
