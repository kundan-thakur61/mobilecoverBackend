const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  items: [{
    productId: {
      // allow either an ObjectId (for regular products) or a string (for custom items)
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    variantId: {
      // allow either an ObjectId (regular variant) or a string tag for custom items
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    title: String,
    brand: String,
    model: String,
    material: String,
    color: String,
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    image: String,
    designMeta: mongoose.Schema.Types.Mixed
  }],
  total: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: 0
  },
  shippingAddress: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address1: { type: String, required: true },
    address2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  payment: {
    method: {
      type: String,
      enum: ['razorpay', 'cod', 'upi'],
      default: 'razorpay'
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: Date
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  trackingNumber: String,
  estimatedDelivery: Date,
  notes: String,
  cancellationReason: String,
  // Shiprocket integration fields
  shiprocket: {
    shipmentId: { type: Number, unique: true, sparse: true },
    orderId: Number,
    awbCode: String,
    courierId: Number,
    courierName: String,
    pickupScheduledDate: Date,
    labelUrl: String,
    manifestUrl: String,
    status: String,
    statusCode: Number,
    onHoldReason: String,
    rtoReason: String,
    lastSyncedAt: Date,
    trackingData: {
      currentStatus: String,
      shipmentStatus: String,
      shipmentTrack: [{
        status: String,
        date: Date,
        location: String,
        activity: String
      }],
      pickupDate: Date,
      deliveryDate: Date,
      expectedDeliveryDate: Date,
      weight: Number,
      dimensions: {
        length: Number,
        breadth: Number,
        height: Number
      }
    }
  },
  refundAmount: Number,
  refundStatus: {
    type: String,
    enum: ['none', 'requested', 'processing', 'completed', 'failed'],
    default: 'none'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
orderSchema.index({ createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.razorpayOrderId': 1 });
orderSchema.index({ 'payment.razorpayPaymentId': 1 });

// Unique sparse index on shiprocket.shipmentId to prevent duplicate shipments
orderSchema.index({ 'shiprocket.shipmentId': 1 }, { unique: true, sparse: true });

// Virtual for order number
orderSchema.virtual('orderNumber').get(function() {
  return `ORD-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus, notes = '') {
  this.status = newStatus;
  if (notes) {
    this.notes = notes;
  }
  
  // Update timestamps based on status
  if (newStatus === 'delivered') {
    this.deliveredAt = new Date();
  }
  
  return this.save();
};

// Method to calculate total items
orderSchema.methods.getTotalItems = function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
};

module.exports = mongoose.model('Order', orderSchema);