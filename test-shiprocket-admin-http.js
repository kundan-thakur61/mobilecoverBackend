const http = require('http');
const querystring = require('querystring');

async function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n========== SHIPROCKET ADMIN TESTS ==========\n');
  
  try {
    // Test 0: Login
    console.log('TEST 0: Getting Admin Token');
    const loginResp = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    console.log(`Status: ${loginResp.status}`);
    console.log('Response:', JSON.stringify(loginResp.data, null, 2));
    
    if (!loginResp.data.data?.token) {
      console.log('\n❌ Failed to get token. Stopping tests.');
      process.exit(1);
    }
    
    const adminToken = loginResp.data.data.token;
    console.log('✓ Token obtained:', adminToken.substring(0, 20) + '...\n');
    
    // Get orders to find an order ID
    console.log('Fetching orders...');
    const ordersResp = await makeRequest('GET', '/api/admin/orders', null, adminToken);
    console.log(`Status: ${ordersResp.status}`);
    
    const orders = ordersResp.data.data || [];
    if (orders.length === 0) {
      console.log('❌ No orders found. Cannot continue tests.');
      process.exit(1);
    }
    
    const orderId = orders[0]._id;
    console.log('✓ Using Order ID:', orderId + '\n');
    
    // Test 1: Create Shipment
    console.log('TEST 1: Create Shipment');
    const res1 = await makeRequest('POST', '/api/shiprocket/create-shipment', {
      orderId,
      orderType: 'regular',
      pickupLocation: 'Primary',
      dimensions: { length: 15, breadth: 10, height: 2 },
      weight: 0.15
    }, adminToken);
    console.log(`Status: ${res1.status}`);
    if (res1.status === 200) {
      console.log('✓ SUCCESS\n');
    } else {
      console.log('✗ FAILED:', res1.data.message || res1.data, '\n');
    }
    
    // Test 2: Get Pickup Locations
    console.log('TEST 2: Get Pickup Locations');
    const res2 = await makeRequest('GET', '/api/shiprocket/pickup-locations', null, adminToken);
    console.log(`Status: ${res2.status}`);
    if (res2.status === 200) {
      console.log('✓ SUCCESS');
      console.log('Pickup Locations:', JSON.stringify(res2.data.data?.pickupLocations, null, 2), '\n');
    } else {
      console.log('✗ FAILED:', res2.data.message || res2.data, '\n');
    }
    
    // Test 3: Get Recommended Couriers
    console.log('TEST 3: Get Recommended Couriers');
    const res3 = await makeRequest('GET', `/api/shiprocket/recommended-couriers/${orderId}?orderType=regular`, null, adminToken);
    console.log(`Status: ${res3.status}`);
    if (res3.status === 200) {
      console.log('✓ SUCCESS');
      console.log('Couriers:', JSON.stringify(res3.data.data?.couriers, null, 2), '\n');
    } else {
      console.log('✗ FAILED:', res3.data.message || res3.data, '\n');
    }
    
    // Test 4: Assign Courier
    console.log('TEST 4: Assign Courier (Auto-select Cheapest)');
    const res4 = await makeRequest('POST', '/api/shiprocket/assign-courier', {
      orderId,
      orderType: 'regular'
    }, adminToken);
    console.log(`Status: ${res4.status}`);
    if (res4.status === 200) {
      console.log('✓ SUCCESS');
      console.log('Result:', JSON.stringify(res4.data.data, null, 2), '\n');
    } else {
      console.log('✗ FAILED:', res4.data.message || res4.data, '\n');
    }
    
    // Test 5: Request Pickup
    console.log('TEST 5: Request Pickup');
    const res5 = await makeRequest('POST', '/api/shiprocket/request-pickup', {
      orderId,
      orderType: 'regular'
    }, adminToken);
    console.log(`Status: ${res5.status}`);
    if (res5.status === 200) {
      console.log('✓ SUCCESS');
      console.log('Result:', JSON.stringify(res5.data.data, null, 2), '\n');
    } else {
      console.log('✗ FAILED:', res5.data.message || res5.data, '\n');
    }
    
    // Test 6: Generate Label
    console.log('TEST 6: Generate Shipping Label');
    const res6 = await makeRequest('POST', '/api/shiprocket/generate-label', {
      orderId,
      orderType: 'regular'
    }, adminToken);
    console.log(`Status: ${res6.status}`);
    if (res6.status === 200) {
      console.log('✓ SUCCESS');
      console.log('Result:', JSON.stringify(res6.data.data, null, 2), '\n');
    } else {
      console.log('✗ FAILED:', res6.data.message || res6.data, '\n');
    }
    
    // Test 7: Generate Manifest
    console.log('TEST 7: Generate Manifest');
    const res7 = await makeRequest('POST', '/api/shiprocket/generate-manifest', {
      orderId,
      orderType: 'regular'
    }, adminToken);
    console.log(`Status: ${res7.status}`);
    if (res7.status === 200) {
      console.log('✓ SUCCESS');
      console.log('Result:', JSON.stringify(res7.data.data, null, 2), '\n');
    } else {
      console.log('✗ FAILED:', res7.data.message || res7.data, '\n');
    }
    
    // Test 8: Check Serviceability (No auth required)
    console.log('TEST 8: Check Serviceability');
    const res8 = await makeRequest('GET', '/api/shiprocket/check-serviceability?pickupPincode=400001&deliveryPincode=110001');
    console.log(`Status: ${res8.status}`);
    if (res8.status === 200) {
      console.log('✓ SUCCESS');
      console.log('Result:', JSON.stringify(res8.data.data, null, 2), '\n');
    } else {
      console.log('✗ FAILED:', res8.data.message || res8.data, '\n');
    }
    
    console.log('========== ALL TESTS COMPLETED ==========\n');
    process.exit(0);
    
  } catch (error) {
    console.log('\n❌ ERROR:', error.message);
    console.log(error);
    process.exit(1);
  }
}

runTests();
