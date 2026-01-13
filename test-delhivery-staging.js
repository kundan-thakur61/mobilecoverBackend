require('dotenv').config();
const axios = require('axios');

async function testDelhiveryStaging() {
  const apiKey = process.env.DELIVERYONE_API_KEY;
  const baseUrl = process.env.DELIVERYONE_API_BASE_URL || 'https://staging-express.delhivery.com';
  
  console.log('Testing Delhivery Staging Environment');
  console.log('API Key:', apiKey ? '***' + apiKey.slice(-4) : 'NOT SET');
  console.log('Base URL:', baseUrl);
  console.log('');

  if (!apiKey) {
    console.error('DELIVERYONE_API_KEY not found in environment');
    return;
  }

  // Test endpoints for staging environment
  const testEndpoints = [
    {
      name: 'Test Create Order',
      url: `${baseUrl}/api/cmu/create.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${apiKey}`
      },
      data: {
        format: 'json',
        data: JSON.stringify([{
          name: 'Test Customer',
          add: '123 Test Street',
          pin: '110001',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
          phone: '9999999999',
          order: `TEST-${Date.now()}`,
          payment_mode: 'Prepaid',
          return_pin: '400001',
          return_city: 'Mumbai',
          return_phone: '9876543210',
          return_add: 'Test Warehouse, Mumbai',
          return_state: 'Maharashtra',
          return_country: 'India',
          products_desc: 'Test Product',
          hsn_code: '8517',
          cod_amount: '0',
          order_date: new Date().toISOString(),
          total_amount: '500',
          seller_add: 'Test Warehouse',
          seller_name: 'Test Seller',
          seller_inv: `INV-${Date.now()}`,
          quantity: '1',
          waybill: '',
          shipment_width: '10',
          shipment_height: '10',
          weight: '0.5',
          seller_gst_tin: '',
          shipping_mode: 'Surface',
          address_type: 'home'
        }])
      }
    },
    {
      name: 'Fetch Packages (Tracking)',
      url: `${baseUrl}/api/v1/packages/json/`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${apiKey}`
      },
      params: {
        waybill: 'TEST123456789'
      }
    },
    {
      name: 'Pincode Serviceability',
      url: `${baseUrl}/c/api/pin-codes/json/`,
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`
      },
      params: {
        filter_codes: '110001'
      }
    }
  ];

  for (const endpoint of testEndpoints) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      const config = {
        method: endpoint.method,
        url: endpoint.url,
        headers: endpoint.headers || {},
        timeout: 15000
      };

      if (endpoint.params) {
        config.params = endpoint.params;
      }

      if (endpoint.data) {
        config.data = endpoint.data;
      }

      const response = await axios(config);

      console.log('✅ Success!');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));

    } catch (error) {
      console.error('❌ Failed');
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Error:', error.message);
      
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          console.error('Response:', data.substring(0, 500));
        } else {
          console.error('Response:', JSON.stringify(data, null, 2));
        }
      }
    }
  }
}

testDelhiveryStaging();
