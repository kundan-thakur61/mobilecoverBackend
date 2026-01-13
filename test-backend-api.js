const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

async function testBackendAPI() {
  console.log('Testing Backend API Endpoints\n');
  console.log('=' .repeat(60));

  const tests = [
    {
      name: 'Health Check (Root)',
      method: 'GET',
      url: 'http://localhost:4000/',
    },
    {
      name: 'Check Serviceability (Public)',
      method: 'GET',
      url: `${BASE_URL}/deliveryone/check-serviceability`,
      params: {
        deliveryPincode: '110001',
        pickupPincode: '400001',
        weight: 0.5
      }
    },
    {
      name: 'Get Mobile Companies (Public)',
      method: 'GET',
      url: `${BASE_URL}/mobile/companies`
    },
    {
      name: 'Get Products (Public)',
      method: 'GET',
      url: `${BASE_URL}/products`,
      params: {
        page: 1,
        limit: 5
      }
    }
  ];

  for (const test of tests) {
    console.log(`\n📍 ${test.name}`);
    console.log(`   ${test.method} ${test.url}`);
    
    try {
      const config = {
        method: test.method,
        url: test.url,
        timeout: 10000
      };

      if (test.params) {
        config.params = test.params;
        console.log(`   Params:`, test.params);
      }

      if (test.data) {
        config.data = test.data;
      }

      if (test.headers) {
        config.headers = test.headers;
      }

      const startTime = Date.now();
      const response = await axios(config);
      const duration = Date.now() - startTime;

      console.log(`   ✅ Status: ${response.status} (${duration}ms)`);
      
      if (typeof response.data === 'object') {
        const preview = JSON.stringify(response.data, null, 2).substring(0, 500);
        console.log(`   Response: ${preview}${preview.length >= 500 ? '...' : ''}`);
      } else {
        console.log(`   Response: ${String(response.data).substring(0, 200)}`);
      }

    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      
      if (error.response) {
        console.log(`   Status: ${error.response.status} ${error.response.statusText}`);
        
        if (error.response.data) {
          const errorData = typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 300)
            : JSON.stringify(error.response.data, null, 2).substring(0, 300);
          console.log(`   Error: ${errorData}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test complete!');
}

// Run tests
testBackendAPI().catch(console.error);
