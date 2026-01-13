require('dotenv').config();
const delhiveryService = require('./utils/deliveryOne');

async function testDelhiveryAPI() {
  try {
    console.log('🚀 Testing Delhivery API with fixed configuration...');
    
    // Test 1: Check credentials
    console.log('\n1️⃣ Checking API credentials...');
    delhiveryService.validateCredentials();
    console.log('✅ API credentials are valid');
    
    // Test 2: Create a test shipment
    console.log('\n2️⃣ Creating test shipment...');
    const testOrderData = {
      orderId: `TEST-${Date.now()}`,
      orderDate: new Date().toISOString().split('T')[0],
      billingCustomerName: 'Test Customer',
      billingAddress: '123 Test Street',
      billingCity: 'Koderma',
      billingPincode: '825418',
      billingState: 'Jharkhand',
      billingCountry: 'India',
      billingEmail: 'test@example.com',
      billingPhone: '9876543210',
      shippingIsBilling: true,
      orderItems: [{
        name: 'Test Mobile Cover',
        sku: 'TEST-COVER-001',
        units: 1,
        selling_price: 299
      }],
      paymentMethod: 'Prepaid',
      subTotal: 299,
      length: 15,
      breadth: 10,
      height: 2,
      weight: 0.15
    };
    
    const result = await delhiveryService.createOrder(testOrderData);
    console.log('✅ Shipment created successfully:', result);
    
    console.log('\n🎉 Delhivery API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Delhivery API test failed:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  }
}

testDelhiveryAPI();
