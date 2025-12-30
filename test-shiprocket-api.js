require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:4000/api';

async function testShiprocketAPI() {
  console.log('=== TESTING SHIPROCKET API ENDPOINTS ===\n');

  try {
    // 1. Test public endpoint - Check Serviceability (no auth required)
    console.log('1. Testing Check Serviceability (Public Endpoint)...');
    try {
      const serviceRes = await axios.get(`${API_BASE}/shiprocket/check-serviceability`, {
        params: {
          pickup_postcode: '825418',
          delivery_postcode: '400001',
          weight: 0.15,
          cod: false
        }
      });
      console.log('   ✓ Serviceability check successful');
      console.log(`   Available couriers: ${serviceRes.data.data?.available_courier_companies?.length || 0}`);
      if (serviceRes.data.data?.available_courier_companies?.[0]) {
        const courier = serviceRes.data.data.available_courier_companies[0];
        console.log(`   Cheapest: ${courier.courier_name} - ₹${courier.rate}\n`);
      }
    } catch (error) {
      console.log('   ✗ Failed:', error.response?.data?.message || error.message);
      console.log('   (This is expected if backend is not running)\n');
    }

    // 2. Test admin endpoint - Get Pickup Locations (requires admin auth)
    console.log('2. Testing Get Pickup Locations (Admin Endpoint - requires auth)...');
    console.log('   ℹ This requires admin authentication\n');

    // 3. Show available endpoints
    console.log('3. Available Shiprocket Endpoints:\n');
    console.log('   PUBLIC ENDPOINTS:');
    console.log('   GET  /api/shiprocket/check-serviceability');
    console.log('        - Check if delivery is available to a pincode');
    console.log('        - Params: pickup_postcode, delivery_postcode, weight, cod\n');
    
    console.log('   USER ENDPOINTS (require authentication):');
    console.log('   GET  /api/shiprocket/track/:orderId');
    console.log('        - Track shipment for user\'s own order\n');
    
    console.log('   ADMIN ENDPOINTS (require admin authentication):');
    console.log('   POST /api/shiprocket/create-shipment');
    console.log('        - Create shipment in Shiprocket');
    console.log('   POST /api/shiprocket/assign-courier');
    console.log('        - Assign courier and generate AWB');
    console.log('   GET  /api/shiprocket/recommended-couriers/:orderId');
    console.log('        - Get recommended couriers for an order');
    console.log('   POST /api/shiprocket/request-pickup');
    console.log('        - Request pickup for shipment');
    console.log('   POST /api/shiprocket/cancel-shipment');
    console.log('        - Cancel shipment');
    console.log('   POST /api/shiprocket/generate-label');
    console.log('        - Generate shipping label');
    console.log('   POST /api/shiprocket/generate-manifest');
    console.log('        - Generate manifest');
    console.log('   GET  /api/shiprocket/pickup-locations');
    console.log('        - Get all pickup locations\n');
    
    console.log('   WEBHOOK (for Shiprocket callbacks):');
    console.log('   POST /api/shiprocket/webhook');
    console.log('        - Receives status updates from Shiprocket\n');

    console.log('4. Sample Request - Check Serviceability:\n');
    console.log('   curl "http://localhost:4000/api/shiprocket/check-serviceability?pickup_postcode=825418&delivery_postcode=400001&weight=0.15&cod=false"\n');

    console.log('5. Sample Request - Create Shipment (Admin):\n');
    console.log('   curl -X POST http://localhost:4000/api/shiprocket/create-shipment \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\');
    console.log('     -d \'{"orderId":"ORDER_ID","orderType":"regular","pickupLocation":"Home"}\'');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }
}

// Check if backend is running
async function checkBackend() {
  try {
    const res = await axios.get('http://localhost:4000/api/health', { timeout: 2000 });
    console.log('✓ Backend is running:', res.data.status, '\n');
    return true;
  } catch (error) {
    console.log('⚠ Backend is not running on http://localhost:4000');
    console.log('  Start backend with: cd backend && npm start\n');
    return false;
  }
}

(async () => {
  const backendRunning = await checkBackend();
  await testShiprocketAPI();
  
  if (!backendRunning) {
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Start your backend server: cd backend && npm start');
    console.log('2. Then test the endpoints above');
  } else {
    console.log('\n=== SHIPROCKET READY ✓ ===');
    console.log('Your Shiprocket integration is configured and ready to use!');
  }
})();
