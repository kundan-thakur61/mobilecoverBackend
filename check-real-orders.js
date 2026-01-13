require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');
const User = require('./models/User');

async function checkOrders() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Find recent orders
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name email');

    console.log(`Found ${orders.length} recent orders:\n`);

    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order._id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Payment: ${order.payment?.status || 'N/A'}`);
      console.log(`   Total: ₹${order.total}`);
      console.log(`   Customer: ${order.userId?.name || 'N/A'}`);
      console.log(`   Shipping: ${order.shippingAddress?.city || 'N/A'}, ${order.shippingAddress?.postalCode || 'N/A'}`);
      console.log(`   Created: ${order.createdAt}`);
      
      if (order.deliveryOne?.waybill) {
        console.log(`   ✅ Shipment: ${order.deliveryOne.waybill} (${order.deliveryOne.status})`);
      } else {
        console.log(`   ⚠️  No shipment created yet`);
      }
      console.log('');
    });

    // Count orders by status
    const statusCounts = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('Orders by Status:');
    statusCounts.forEach(({ _id, count }) => {
      console.log(`   ${_id}: ${count}`);
    });

    // Count shipments
    const withShipment = await Order.countDocuments({ 'deliveryOne.waybill': { $exists: true } });
    const totalOrders = await Order.countDocuments();
    
    console.log(`\nShipments: ${withShipment}/${totalOrders} orders have shipments created`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkOrders();
