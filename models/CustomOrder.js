const mongoose = require('mongoose');

const customOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  // productId is optional — custom orders can be free-form without linking to a product
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  variant: {
    color: String,
    price: Number,
    sku: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  imageUrls: [{
    original: {
      url: String,
      publicId: String
    },
    size: String,
    mimeType: String
  }],
  mockupUrl: {
    type: String,
    required: [true, 'Mockup image is required']
  },
  mockupPublicId: String,
  instructions: {
    type: String,
    maxlength: [500, 'Instructions cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  payment: {
    method: {
      type: String,
      enum: ['razorpay'],
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
    paidAt: Date,
    amount: Number
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'in_production', 'shipped', 'delivered'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    maxlength: [500, 'Admin notes cannot exceed 500 characters']
  },
  rejectionReason: String,
  designData: {
    // Store canvas/design data if needed
    canvasData: String,
    transformations: {
      scale: Number,
      rotation: Number,
      position: {
        x: Number,
        y: Number
      }
    },
    companyId: String,
    companyName: String,
    modelId: String,
    modelName: String,
    material: String
  },
  shippingAddress: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  trackingNumber: String,
  estimatedDelivery: Date,
  // Shiprocket integration fields
  shiprocket: {
    shipmentId: Number,
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
customOrderSchema.index({ createdAt: -1 });
customOrderSchema.index({ userId: 1, createdAt: -1 });
customOrderSchema.index({ status: 1, createdAt: -1 });
customOrderSchema.index({ 'payment.razorpayOrderId': 1 });
customOrderSchema.index({ 'payment.razorpayPaymentId': 1 });

// Virtual for custom order number
customOrderSchema.virtual('customOrderNumber').get(function() {
  return `CUST-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Method to update status
customOrderSchema.methods.updateStatus = function(newStatus, adminNotes = '', rejectionReason = '') {
  this.status = newStatus;
  
  if (adminNotes) {
    this.adminNotes = adminNotes;
  }
  
  if (rejectionReason) {
    this.rejectionReason = rejectionReason;
  }
  
  // Update timestamps based on status
  if (newStatus === 'delivered') {
    this.deliveredAt = new Date();
  }
  
  return this.save();
};

// Method to approve custom order
customOrderSchema.methods.approve = function(adminNotes = '', mockupData = null) {
  this.status = 'approved';
  this.adminNotes = adminNotes;
  
  if (mockupData) {
    this.mockupUrl = mockupData.url;
    this.mockupPublicId = mockupData.publicId;
  }
  
  return this.save();
};

// Method to reject custom order
customOrderSchema.methods.reject = function(reason, adminNotes = '') {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.adminNotes = adminNotes;
  
  return this.save();
};

module.exports = mongoose.model('CustomOrder', customOrderSchema);