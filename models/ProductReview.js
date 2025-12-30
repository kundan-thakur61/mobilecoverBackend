const mongoose = require('mongoose');

const productReviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: 120
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1500
  },
  status: {
    type: String,
    enum: ['published', 'hidden'],
    default: 'published'
  },
  metadata: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    source: {
      type: String,
      trim: true,
      maxlength: 120
    }
  }
}, {
  timestamps: true
});

productReviewSchema.index({ product: 1, user: 1 }, { unique: true });
productReviewSchema.index({ product: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ProductReview', productReviewSchema);
