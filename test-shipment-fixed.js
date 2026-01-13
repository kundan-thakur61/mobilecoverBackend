require('dotenv').config();
const delhiveryService = require('./utils/deliveryOne');

async function testShipmentCreation() {
  console.log('🧪 Testing Shipment Creation with Minimal Data');
  
  try {
    // Test with minimal required data
    const minimalOrderData = {
      shipments: [{
        name: 'Test Customer',
        add: '123 Test Street',
        pin: '825418',
        city: 'Koderma',
        state: 'Jharkhand',
        country: 'India',
        phone: '9876543210',
        order: 'TEST-MINIMAL-' + Date.now(),
        payment_mode: 'Prepaid',
        return_pin: '825418',
        return_city: 'Koderma',
        return_phone: '9876543210',
        return_add: 'Cover Ghar, Koderma',
        return_country: 'India',
        products_desc: 'Test Mobile Cover',
        hsn_code: '392690',
        cod_amount: 0,
        order_date: new Date().toISOString().split('T')[0],
        total_amount: 299,
        seller_add: 'Cover Ghar, Koderma',
        seller_name: 'Cover Ghar',
        seller_inv: 'TEST-MINIMAL-' + Date.now(),
        quantity: 1,
        waybill: '',
        // Required fields for Delhivery
        package_weight: 0.15,
        package_length: 15,
        package_breadth: 10,
        package_height: 2,
        shipment_width: 10,
        shipment_height: 2,
        weight: 0.15,
        seller_gst_tin: '27AAAPCG1234C1ZV',
        shipping_mode: 'Surface',
        address_type: 'home'
      }]
    };

    console.log('📦 Sending minimal order data:', JSON.stringify(minimalOrderData, null, 2));
    
    const response = await delhiveryService.createOrder(minimalOrderData);
    
    console.log('✅ Response Status:', response.success);
    console.log('✅ Response Data:', JSON.stringify(response, null, 2));
    
    if (response.success && response.packages && response.packages.length > 0) {
      console.log('🎯 SUCCESS! Shipment created');
      console.log('   Waybill:', response.packages[0].waybill);
      console.log('   Order ID:', response.packages[0].refnum);
    } else {
      console.log('❌ FAILED! Shipment creation failed');
      console.log('   Error:', response.error || response.rmk);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testShipmentCreation();
