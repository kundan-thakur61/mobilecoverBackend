require('dotenv').config();
const axios = require('axios');

async function testShiprocket() {
  try {
    console.log('=== SHIPROCKET INTEGRATION TEST ===\n');

    // 1. Authentication
    console.log('1. Testing Authentication...');
    const authRes = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    });
    const token = authRes.data.token;
    console.log('   ✓ Authentication successful');
    console.log('   Token:', token.substring(0, 50) + '...\n');

    // 2. Get Pickup Locations
    console.log('2. Fetching Pickup Locations...');
    const pickupRes = await axios.get('https://apiv2.shiprocket.in/v1/external/settings/company/pickup', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (pickupRes.data.data && pickupRes.data.data.shipping_address) {
      console.log(`   ✓ Found ${pickupRes.data.data.shipping_address.length} pickup location(s):\n`);
      pickupRes.data.data.shipping_address.forEach((loc, i) => {
        console.log(`   ${i + 1}. ${loc.pickup_location}`);
        console.log(`      Address: ${loc.address}, ${loc.city} - ${loc.pin_code}`);
        console.log(`      Phone: ${loc.phone}`);
        console.log(`      Status: ${loc.status}\n`);
      });
    } else {
      console.log('   ⚠ No pickup locations found. You need to add a pickup address in Shiprocket dashboard.\n');
    }

    // 3. Check Serviceability (Delhi to Mumbai)
    console.log('3. Testing Serviceability Check (Delhi to Mumbai)...');
    const serviceRes = await axios.get('https://apiv2.shiprocket.in/v1/external/courier/serviceability/', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        pickup_postcode: '110001',
        delivery_postcode: '400001',
        weight: 0.15, // 150 grams for mobile cover
        cod: 0 // prepaid
      }
    });

    if (serviceRes.data.data && serviceRes.data.data.available_courier_companies) {
      console.log(`   ✓ Found ${serviceRes.data.data.available_courier_companies.length} available couriers:\n`);
      serviceRes.data.data.available_courier_companies.slice(0, 5).forEach((courier, i) => {
        console.log(`   ${i + 1}. ${courier.courier_name}`);
        console.log(`      Rate: ₹${courier.rate}`);
        console.log(`      Estimated Delivery: ${courier.estimated_delivery_days} days`);
        console.log(`      COD: ${courier.cod === 1 ? 'Available' : 'Not Available'}\n`);
      });
    }

    // 4. Get Recent Orders
    console.log('4. Fetching Recent Shiprocket Orders...');
    const ordersRes = await axios.get('https://apiv2.shiprocket.in/v1/external/orders', {
      headers: { Authorization: `Bearer ${token}` },
      params: { per_page: 5 }
    });

    if (ordersRes.data.data && ordersRes.data.data.length > 0) {
      console.log(`   ✓ Found ${ordersRes.data.data.length} recent order(s):\n`);
      ordersRes.data.data.forEach((order, i) => {
        console.log(`   ${i + 1}. Order #${order.channel_order_id}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Total: ₹${order.total}`);
        console.log(`      Created: ${order.created_at}\n`);
      });
    } else {
      console.log('   ℹ No orders found in Shiprocket yet.\n');
    }

    console.log('=== ALL TESTS PASSED ✓ ===');
    console.log('\nYour Shiprocket integration is working correctly!');
    console.log('\nNext steps:');
    console.log('1. Make sure you have at least one pickup location configured');
    console.log('2. Use the /api/shiprocket/check-serviceability endpoint to check delivery availability');
    console.log('3. Create test shipments via /api/shiprocket/create-shipment (admin only)');

  } catch (error) {
    console.error('\n✗ Test Failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testShiprocket();
