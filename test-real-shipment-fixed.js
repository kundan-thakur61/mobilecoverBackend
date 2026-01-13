require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');
const delhiveryService = require('./utils/deliveryOne');

async function testRealOrderShipment() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce');
    console.log('✅ Connected to MongoDB');

    // Find the actual order from the error log
    const orderId = '6963958b663e353e899d9114';
    console.log(`📦 Looking for order: ${orderId}`);
    
    const order = await Order.findById(orderId).populate('userId');
    
    if (!order) {
      console.log('❌ Order not found, creating test order...');
      // Create a test order with the same structure
      const testOrder = new Order({
        _id: orderId,
        userId: '693cf9a129545f7e0c5d61b6',
        items: [{
          title: 'Mobile Cover',
          sku: 'COVER-001',
          quantity: 1,
          price: 299,
          productId: new mongoose.Types.ObjectId(),
          variantId: new mongoose.Types.ObjectId()
        }],
        total: 299,
        payment: {
          status: 'paid'
        },
        shippingAddress: {
          name: 'kundan thakur',
          address1: 'Phulwaria',
          city: 'Koderma',
          state: 'Jharkhand',
          postalCode: '825418',
          country: 'India',
          phone: '9876543210'
        },
        status: 'processing'
      });
      
      await testOrder.save();
      console.log('✅ Test order created');
      
      // Use the test order
      testShipmentCreation(testOrder);
    } else {
      console.log('✅ Found existing order');
      testShipmentCreation(order);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function testShipmentCreation(order) {
  try {
    console.log('📦 Preparing shipment data...');
    
    // Prepare order items exactly like the controller does
    const orderItems = order.items.map(item => {
      const rawSku = item.sku || item.variantId?.toString() || item.productId?.toString() || 'SKU-NA';
      let sku = String(rawSku).trim();
      
      if (sku.length > 50) {
        sku = sku.slice(-40);
      }

      return {
        name: item.title || 'Mobile Cover',
        sku: sku,
        units: item.quantity,
        quantity: item.quantity,
        selling_price: item.price,
        discount: 0,
        tax: 0,
        hsn: 392690
      };
    });

    // Split customer name
    const fullName = order.shippingAddress?.name || 'Customer';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Prepare Delhivery order data
    const delhiveryOrderData = {
      orderId: `ORD-${order._id}`,
      orderDate: order.createdAt.toISOString().split('T')[0],
      pickupLocation: 'Primary',
      billingCustomerName: firstName,
      billingLastName: lastName,
      billingAddress: order.shippingAddress?.address1 || order.shippingAddress?.street,
      billingAddress2: order.shippingAddress?.address2 || '',
      billingCity: order.shippingAddress?.city,
      billingPincode: order.shippingAddress?.postalCode || order.shippingAddress?.zipCode,
      billingState: order.shippingAddress?.state,
      billingCountry: order.shippingAddress?.country || 'India',
      billingEmail: order.userId?.email || order.shippingAddress?.email || 'customer@example.com',
      billingPhone: order.shippingAddress?.phone || '0000000000',
      shippingIsBilling: true,
      orderItems: orderItems,
      paymentMethod: order.payment?.status === 'paid' ? 'Prepaid' : 'COD',
      subTotal: order.total,
      length: 15,
      breadth: 10,
      height: 2,
      weight: 0.15
    };

    console.log('🚀 Creating shipment with Delhivery...');
    const result = await delhiveryService.createOrder(delhiveryOrderData);
    
    console.log('✅ Shipment created successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // Update order with shipment details
    order.deliveryOne = {
      shipmentId: result.shipment_id,
      waybill: result.waybill,
      awbCode: result.waybill,
      orderId: result.order_id,
      status: result.status,
      statusCode: result.status,
      lastSyncedAt: new Date(),
      remarks: result.remarks
    };
    
    order.trackingNumber = result.waybill;
    await order.save();
    
    console.log('✅ Order updated with shipment details');
    console.log('🎉 Delhivery integration test completed successfully!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Shipment creation failed:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
    process.exit(1);
  }
}

testRealOrderShipment();
