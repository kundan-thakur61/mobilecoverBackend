require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.DELHIVERY_API_KEY || process.env.DELIVERYONE_API_KEY;

console.log('🔍 Testing Delhivery API Endpoints');
console.log('===================================');
console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);

const testEndpoints = [
  {
    name: 'Production API - Waybill Tracking',
    url: 'https://track.delhivery.com/api/v1/packages/json/',
    method: 'GET',
    params: { waybill: '1234567890123', verbose: '1' }
  },
  {
    name: 'Production API - Serviceability',
    url: 'https://track.delhivery.com/c/api/pincode_serviceability.json',
    method: 'GET',
    params: { format: 'json', token: API_KEY, pickup_pin: '400001', delivery_pin: '110001' }
  },
  {
    name: 'Staging API - Waybill Tracking',
    url: 'https://staging-express.delhivery.com/api/v1/packages/json/',
    method: 'GET',
    params: { waybill: '1234567890123', verbose: '1' }
  },
  {
    name: 'Staging API - Warehouse List',
    url: 'https://staging-express.delhivery.com/api/backend/clientwarehouse/all/',
    method: 'GET'
  },
  {
    name: 'Alternative Staging - Create Order',
    url: 'https://staging-express.delhivery.com/api/cmu/create.json',
    method: 'POST',
    data: { format: 'json', data: '{}' }
  }
];

async function testEndpoint(endpoint) {
  console.log(`\n🧪 Testing: ${endpoint.name}`);
  console.log(`   URL: ${endpoint.url}`);
  
  try {
    const config = {
      method: endpoint.method,
      url: endpoint.url,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    // Add auth header for endpoints that need it
    if (endpoint.url.includes('/api/backend/') || endpoint.url.includes('/api/cmu/')) {
      config.headers.Authorization = `Token ${API_KEY}`;
    }
    
    // Add params
    if (endpoint.params) {
      config.params = endpoint.params;
    }
    
    // Add data for POST requests
    if (endpoint.data) {
      config.data = endpoint.data;
      // For form data
      if (endpoint.url.includes('/api/cmu/create.json')) {
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const params = new URLSearchParams();
        params.append('format', 'json');
        params.append('data', JSON.stringify({
          shipments: [{
            name: 'Test Customer',
            add: '123 Test Street',
            pin: '400001',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            phone: '9876543210',
            order: 'TEST-ORDER-123',
            payment_mode: 'Prepaid',
            products_desc: 'Test Product',
            hsn_code: '392690',
            cod_amount: 0,
            order_date: new Date().toISOString().split('T')[0],
            total_amount: 100,
            seller_add: 'Test Seller Address',
            seller_name: 'Test Seller',
            seller_inv: 'TEST-INV-123',
            quantity: 1,
            weight: 0.5
          }]
        }));
        config.data = params;
      }
    }
    
    const response = await axios(config);
    
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   ✅ Response Type: ${typeof response.data}`);
    
    if (typeof response.data === 'object') {
      console.log(`   ✅ Response Keys: ${Object.keys(response.data).join(', ')}`);
    } else if (typeof response.data === 'string' && response.data.length < 200) {
      console.log(`   ✅ Response: ${response.data}`);
    }
    
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.response?.status || 'NO_RESPONSE'}`);
    console.log(`   ❌ Message: ${error.response?.data || error.message}`);
    
    if (error.response?.status === 401) {
      console.log(`   💡 This suggests the API key is invalid or the auth method is wrong`);
    } else if (error.response?.status === 404) {
      console.log(`   💡 This suggests the endpoint doesn't exist or URL is wrong`);
    } else if (error.response?.status === 403) {
      console.log(`   💡 This suggests permissions issue or account not active`);
    }
    
    return { success: false, status: error.response?.status, error: error.message };
  }
}

async function main() {
  console.log('\nTesting different Delhivery API endpoints...\n');
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    const result = await testEndpoint(endpoint);
    results.push({ ...endpoint, result });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY OF RESULTS');
  console.log('='.repeat(60));
  
  const workingEndpoints = results.filter(r => r.result.success);
  const failedEndpoints = results.filter(r => !r.result.success);
  
  console.log(`\n✅ Working Endpoints (${workingEndpoints.length}):`);
  workingEndpoints.forEach(endpoint => {
    console.log(`   - ${endpoint.name} (Status: ${endpoint.result.status})`);
  });
  
  console.log(`\n❌ Failed Endpoints (${failedEndpoints.length}):`);
  failedEndpoints.forEach(endpoint => {
    console.log(`   - ${endpoint.name} (Status: ${endpoint.result.status || 'TIMEOUT'})`);
  });
  
  if (workingEndpoints.length > 0) {
    console.log(`\n🎯 RECOMMENDATION:`);
    console.log(`Use the working endpoints above for your integration.`);
    console.log(`Update your .env file with the correct base URL.`);
  } else {
    console.log(`\n⚠️  CRITICAL ISSUE:`);
    console.log(`No endpoints are working. Check:`);
    console.log(`1. API key validity`);
    console.log(`2. Account status with Delhivery`);
    console.log(`3. Network connectivity`);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
