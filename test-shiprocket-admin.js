const axios = require('axios');

const axiosInstance = axios.create({
  timeout: 10000,
  validateStatus: function () {
    return true; // Resolve for all status codes
  }
});

async function testEndpoints() {
  const baseURL = 'http://localhost:4000/api';
  
  try {
    // Step 1: Login as admin to get token
    console.log('\n=== STEP 0: Getting Admin Token ===');
    console.log('Attempting login to:', baseURL + '/auth/login');
    
    const loginRes = await axiosInstance.post(baseURL + '/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    }).catch(err => {
      console.log('Request error:', err.message);
      console.log('Response:', err.response?.status, err.response?.data);
      throw err;
    });
    
    const adminToken = loginRes.data.data.token;
    console.log('✓ Admin token obtained');
    
    const headers = {
      'Authorization': 'Bearer ' + adminToken,
      'Content-Type': 'application/json'
    };
    
    // Get an order ID from database first
    console.log('\nFetching orders...');
    const ordersRes = await axios.get(baseURL + '/admin/orders', { headers });
    const orders = ordersRes.data.data || [];
    
    if (orders.length === 0) {
      console.log('❌ No orders found. Please create an order first.');
      return;
    }
    
    const orderId = orders[0]._id;
    const orderType = 'regular';
    console.log('✓ Using Order ID:', orderId);
    
    // Test 1: Create Shipment
    console.log('\n=== TEST 1: Create Shipment ===');
    try {
      const res1 = await axios.post(baseURL + '/shiprocket/create-shipment', {
        orderId,
        orderType,
        pickupLocation: 'Primary',
        dimensions: { length: 15, breadth: 10, height: 2 },
        weight: 0.15
      }, { headers });
      console.log('✓ SUCCESS');
      console.log(JSON.stringify(res1.data, null, 2));
    } catch (e) {
      console.log('✗ ERROR:', e.response?.data?.message || e.message);
    }
    
    // Test 2: Get Pickup Locations
    console.log('\n=== TEST 2: Get Pickup Locations ===');
    try {
      const res2 = await axios.get(baseURL + '/shiprocket/pickup-locations', { headers });
      console.log('✓ SUCCESS');
      console.log(JSON.stringify(res2.data, null, 2));
    } catch (e) {
      console.log('✗ ERROR:', e.response?.data?.message || e.message);
    }
    
    // Test 3: Get Recommended Couriers
    console.log('\n=== TEST 3: Get Recommended Couriers ===');
    try {
      const res3 = await axios.get(baseURL + '/shiprocket/recommended-couriers/' + orderId + '?orderType=regular', { headers });
      console.log('✓ SUCCESS');
      console.log(JSON.stringify(res3.data, null, 2));
    } catch (e) {
      console.log('✗ ERROR:', e.response?.data?.message || e.message);
    }
    
    // Test 4: Assign Courier
    console.log('\n=== TEST 4: Assign Courier (Auto-select Cheapest) ===');
    try {
      const res4 = await axios.post(baseURL + '/shiprocket/assign-courier', {
        orderId,
        orderType
      }, { headers });
      console.log('✓ SUCCESS');
      console.log(JSON.stringify(res4.data, null, 2));
    } catch (e) {
      console.log('✗ ERROR:', e.response?.data?.message || e.message);
    }
    
    // Test 5: Request Pickup
    console.log('\n=== TEST 5: Request Pickup ===');
    try {
      const res5 = await axios.post(baseURL + '/shiprocket/request-pickup', {
        orderId,
        orderType
      }, { headers });
      console.log('✓ SUCCESS');
      console.log(JSON.stringify(res5.data, null, 2));
    } catch (e) {
      console.log('✗ ERROR:', e.response?.data?.message || e.message);
    }
    
    // Test 6: Generate Label
    console.log('\n=== TEST 6: Generate Shipping Label ===');
    try {
      const res6 = await axios.post(baseURL + '/shiprocket/generate-label', {
        orderId,
        orderType
      }, { headers });
      console.log('✓ SUCCESS');
      console.log(JSON.stringify(res6.data, null, 2));
    } catch (e) {
      console.log('✗ ERROR:', e.response?.data?.message || e.message);
    }
    
    // Test 7: Generate Manifest
    console.log('\n=== TEST 7: Generate Manifest ===');
    try {
      const res7 = await axios.post(baseURL + '/shiprocket/generate-manifest', {
        orderId,
        orderType
      }, { headers });
      console.log('✓ SUCCESS');
      console.log(JSON.stringify(res7.data, null, 2));
    } catch (e) {
      console.log('✗ ERROR:', e.response?.data?.message || e.message);
    }
    
    // Test 8: Check Serviceability
    console.log('\n=== TEST 8: Check Serviceability ===');
    try {
      const res8 = await axios.get(baseURL + '/shiprocket/check-serviceability?pickupPincode=400001&deliveryPincode=110001');
      console.log('✓ SUCCESS');
      console.log(JSON.stringify(res8.data, null, 2));
    } catch (e) {
      console.log('✗ ERROR:', e.response?.data?.message || e.message);
    }
    
    console.log('\n=== ALL TESTS COMPLETED ===\n');
    process.exit(0);
    
  } catch (error) {
    console.log('Setup Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testEndpoints();
