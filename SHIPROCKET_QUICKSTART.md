# Shiprocket Integration - Quick Start Example

This file shows how to integrate Shiprocket automatic shipment creation into your order flow.

## Option 1: Manual Shipment Creation (Admin Dashboard)

Admin creates shipments manually through the admin panel after reviewing orders. No code changes needed - just use the API endpoints provided.

## Option 2: Automatic Shipment Creation

To automatically create shipments when orders are paid, add this code to your order verification:

### In `controllers/orderController.js`

```javascript
const shiprocketHelper = require('../utils/shiprocketHelper');

// In the verifyPayment function, after order is confirmed:

const verifyPayment = async (req, res, next) => {
  try {
    // ... existing payment verification code ...

    // Update order payment details
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    order.status = 'confirmed';

    await order.save();

    // AUTO-CREATE SHIPMENT IN SHIPROCKET (Add this block)
    if (process.env.SHIPROCKET_AUTO_CREATE === 'true') {
      shiprocketHelper.autoCreateShipment(order, {
        orderType: 'regular',
        pickupLocation: 'Primary',
        autoAssignCourier: true,  // Automatically assign cheapest courier
        requestPickup: false       // Set true to auto-request pickup
      }).catch(err => {
        // Log but don't fail the order
        logger.error('Failed to auto-create shipment:', err);
      });
    }

    // ... rest of the code ...
  } catch (error) {
    next(error);
  }
};
```

### In `controllers/customOrderController.js`

```javascript
const shiprocketHelper = require('../utils/shiprocketHelper');

// In the verifyCustomPayment function:

const verifyCustomPayment = async (req, res, next) => {
  try {
    // ... existing payment verification code ...

    customOrder.payment.razorpayPaymentId = razorpay_payment_id;
    customOrder.payment.razorpaySignature = razorpay_signature;
    customOrder.payment.status = 'paid';
    customOrder.payment.paidAt = new Date();

    await customOrder.save();

    // AUTO-CREATE SHIPMENT FOR CUSTOM ORDER (Add this block)
    if (process.env.SHIPROCKET_AUTO_CREATE === 'true') {
      shiprocketHelper.autoCreateShipment(customOrder, {
        orderType: 'custom',
        pickupLocation: 'Primary',
        autoAssignCourier: true,
        requestPickup: false
      }).catch(err => {
        logger.error('Failed to auto-create shipment:', err);
      });
    }

    // ... rest of the code ...
  } catch (error) {
    next(error);
  }
};
```

### Add to `.env` file

```env
# Enable automatic Shiprocket shipment creation
SHIPROCKET_AUTO_CREATE=true
```

## Option 3: Background Job (Recommended for Production)

For production environments, consider using a background job queue (like Bull or Agenda) to handle shipment creation:

```javascript
// Example with Bull queue
const Queue = require('bull');
const shiprocketQueue = new Queue('shiprocket-shipments', process.env.REDIS_URL);

// Add job after payment confirmation
shiprocketQueue.add('create-shipment', {
  orderId: order._id,
  orderType: 'regular'
});

// Process jobs in a separate worker
shiprocketQueue.process('create-shipment', async (job) => {
  const { orderId, orderType } = job.data;
  const Order = require('../models/Order');
  const order = await Order.findById(orderId);
  
  if (order) {
    await shiprocketHelper.autoCreateShipment(order, {
      orderType,
      autoAssignCourier: true
    });
  }
});
```

## Testing Auto-Creation

1. Set up environment variables:
```bash
SHIPROCKET_EMAIL=your@email.com
SHIPROCKET_PASSWORD=yourpassword
SHIPROCKET_AUTO_CREATE=true
```

2. Create a test order through your application

3. Complete payment

4. Check logs:
```
Shiprocket shipment created successfully: { orderId: '...', shipmentId: 12345678, awbCode: 'AWB...' }
```

5. Verify in Shiprocket dashboard that the order appears

## Monitoring Shipments

Create a cron job to sync tracking information:

```javascript
// scripts/syncShipments.js
const cron = require('node-cron');
const Order = require('../models/Order');
const shiprocketHelper = require('../utils/shiprocketHelper');

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Syncing shipment tracking data...');
  
  const activeOrders = await Order.find({
    'shiprocket.awbCode': { $exists: true },
    status: { $in: ['confirmed', 'processing', 'shipped'] }
  });

  for (const order of activeOrders) {
    try {
      await shiprocketHelper.syncTrackingInfo(order);
      console.log(`Updated tracking for order ${order._id}`);
    } catch (err) {
      console.error(`Failed to sync order ${order._id}:`, err.message);
    }
  }
  
  console.log('Sync completed');
});
```

## Common Use Cases

### Case 1: Manual Review Before Shipping
```javascript
// Don't set SHIPROCKET_AUTO_CREATE
// Admin manually creates shipments after reviewing orders
```

### Case 2: Instant Shipping for Small Items
```javascript
// Set SHIPROCKET_AUTO_CREATE=true
// Auto-create and assign courier immediately after payment
autoCreateShipment(order, {
  autoAssignCourier: true,
  requestPickup: true  // Auto-request pickup
});
```

### Case 3: Custom Products Need Approval
```javascript
// Regular orders: Auto-create
// Custom orders: Manual review

// In verifyPayment (regular orders)
if (process.env.SHIPROCKET_AUTO_CREATE === 'true') {
  shiprocketHelper.autoCreateShipment(order, { ... });
}

// In verifyCustomPayment (custom orders)
// Don't auto-create - wait for admin approval
```

### Case 4: Different Pickup Locations by Product Type
```javascript
const pickupLocation = order.items.some(item => item.category === 'premium')
  ? 'Premium Warehouse'
  : 'Primary';

shiprocketHelper.autoCreateShipment(order, {
  pickupLocation,
  autoAssignCourier: true
});
```

## Webhook Notifications

When Shiprocket updates shipment status, your webhook endpoint automatically:
- Updates order status in database
- Emits real-time updates via Socket.IO
- Sends tracking data to users

No additional code needed - webhook handler is already implemented!

## Troubleshooting

### Shipment not created automatically
1. Check `SHIPROCKET_AUTO_CREATE` is set to `true`
2. Verify Shiprocket credentials in `.env`
3. Check logs for errors
4. Ensure order has valid shipping address with pincode

### Courier assignment fails
1. Check if delivery pincode is serviceable
2. Verify pickup location is configured in Shiprocket
3. Check package dimensions and weight
4. Review Shiprocket courier partnerships

### Tracking not updating
1. Verify webhook URL is configured in Shiprocket dashboard
2. Check webhook endpoint is publicly accessible
3. Review webhook logs for errors
4. Manually sync using `syncTrackingInfo` utility

## Support

For detailed API documentation, see [SHIPROCKET_INTEGRATION.md](./SHIPROCKET_INTEGRATION.md)
