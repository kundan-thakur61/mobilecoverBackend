const axios = require('axios');

const BASE_URL = 'http://localhost:4000';

async function testShiprocketEndpoints() {
  console.log('🧪 Testing Shiprocket API Endpoints...\n');

  try {
    console.log('1️⃣ Testing Serviceability Check (Koderma → Delhi)...');
    const response = await axios.get(`${BASE_URL}/api/shiprocket/check-serviceability`, {
      params: {
        pickupPincode: '826001',
        deliveryPincode: '110001'
      }
    });
    
    if (response.data.success) {
      console.log('   ✅ Serviceability check successful!');
      console.log(`   Available Couriers: ${response.data.couriers?.length || 0}`);
      if (response.data.couriers && response.data.couriers.length > 0) {
        console.log('   Top 3 cheapest couriers:');
        response.data.couriers.slice(0, 3).forEach((courier, i) => {
          console.log(`      ${i + 1}. ${courier.courier_name} - ₹${courier.rate} (${courier.etd})`);
        });
      }
    }

    console.log('\n✅ Public endpoints are working!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Visit frontend product page and test pincode checker');
    console.log('   2. Create a test order');
    console.log('   3. Login as admin → Go to /admin/shipments');
    console.log('   4. Create shipment for test order\n');

  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Backend server is not running!');
      console.error('   Start it with: cd backend && npm start');
    } else {
      console.error('   Error:', error.message);
    }
  }
}

testShiprocketEndpoints();
