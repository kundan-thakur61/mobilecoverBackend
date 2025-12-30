const mongoose = require('mongoose');
const Order = require('./models/Order');

async function testShiprocketFixes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce');
    console.log('Connected to MongoDB');

    // Check if the unique index on shiprocket.shipmentId exists
    const indexes = await mongoose.connection.db.collection('orders').indexes();
    console.log('Current indexes on orders collection:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Check if unique index exists
    const shipmentIdIndex = indexes.find(index =>
      index.key && index.key['shiprocket.shipmentId'] === 1
    );

    if (shipmentIdIndex) {
      console.log('✅ Unique index on shiprocket.shipmentId exists');
      if (shipmentIdIndex.unique) {
        console.log('✅ Index is marked as unique');
      } else {
        console.log('❌ Index exists but is not unique');
      }
    } else {
      console.log('❌ Unique index on shiprocket.shipmentId does not exist');
    }

    // Test creating a sample order to verify the model works
    console.log('\nTesting Order model...');
    const testOrder = new Order({
      userId: new mongoose.Types.ObjectId(),
      items: [{
        productId: 'test-product',
        variantId: 'test-variant',
        title: 'Test Product',
        price: 100,
        quantity: 1
      }],
      total: 100,
      shippingAddress: {
        name: 'Test User',
        phone: '1234567890',
        address1: 'Test Address',
        city: 'Test City',
        state: 'Test State',
        postalCode: '123456',
        country: 'India'
      }
    });

    // Try to save (this should work)
    await testOrder.save();
    console.log('✅ Test order created successfully');

    // Try to create another order with same shipmentId to test uniqueness
    console.log('\nTesting unique index constraint...');
    const duplicateOrder = new Order({
      userId: new mongoose.Types.ObjectId(),
      items: [{
        productId: 'test-product-2',
        variantId: 'test-variant-2',
        title: 'Test Product 2',
        price: 200,
        quantity: 1
      }],
      total: 200,
      shippingAddress: {
        name: 'Test User 2',
        phone: '0987654321',
        address1: 'Test Address 2',
        city: 'Test City 2',
        state: 'Test State 2',
        postalCode: '654321',
        country: 'India'
      },
      shiprocket: {
        shipmentId: 12345 // Same shipmentId
      }
    });

    try {
      await duplicateOrder.save();
      console.log('❌ Duplicate shipmentId was allowed - index not working');
    } catch (error) {
      if (error.code === 11000) {
        console.log('✅ Unique index constraint working - duplicate shipmentId rejected');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Clean up test data
    await Order.deleteMany({ 'items.title': { $in: ['Test Product', 'Test Product 2'] } });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testShiprocketFixes();
