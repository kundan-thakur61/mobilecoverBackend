require('dotenv').config();
const shiprocketService = require('./utils/shiprocket');

async function testRealAPI() {
  console.log('🧪 Testing Real Shiprocket API Implementation\n');
  console.log('API Key:', process.env.SHIPROCKET_EMAIL ? '***' + process.env.SHIPROCKET_EMAIL.slice(-4) : 'NOT SET');
  console.log('Base URL:', process.env.SHIPROCKET_API_BASE_URL || 'apiv2.shiprocket.in');
  console.log('');

  try {
    console.log('1️⃣ Testing Serviceability Check...');
    const serviceability = await shiprocketService.checkServiceability(
      '400001',
      '110001',
      0.5,
      0
    );
    console.log('✅ Serviceability Check Result:');
    console.log(JSON.stringify(serviceability, null, 2));
  } catch (error) {
    console.error('❌ Serviceability Check Failed:');
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  try {
    console.log('2️⃣ Testing Get Pickup Locations...');
    const locations = await shiprocketService.getPickupLocations();
    console.log('✅ Pickup Locations:');
    console.log(JSON.stringify(locations, null, 2));
  } catch (error) {
    console.error('❌ Get Pickup Locations Failed:');
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  try {
    console.log('3️⃣ Testing Create Order (Test Order)...');
    const orderData = {
      orderId: `TEST-${Date.now()}`,
      orderDate: new Date().toISOString().split('T')[0],
      billingCustomerName: 'Test',
      billingLastName: 'Customer',
      billingAddress: '123 Test Street',
      billingCity: 'Delhi',
      billingPincode: '110001',
      billingState: 'Delhi',
      billingCountry: 'India',
      billingEmail: 'test@example.com',
      billingPhone: '9999999999',
      shippingIsBilling: true,
      orderItems: [{
        name: 'Test Mobile Cover',
        sku: 'TEST-SKU-001',
        units: 1,
        selling_price: 500,
        hsn: 392690
      }],
      paymentMethod: 'Prepaid',
      subTotal: 500,
      length: 15,
      breadth: 10,
      height: 2,
      weight: 0.15
    };

    const createResult = await shiprocketService.createOrder(orderData);
    console.log('✅ Create Order Result:');
    console.log(JSON.stringify(createResult, null, 2));
    
    console.log('\n📊 Full Response Details:');
    console.log(createResult);
  } catch (error) {
    console.error('❌ Create Order Failed:');
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testRealAPI();
