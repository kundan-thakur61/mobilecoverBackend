const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  model: {
    type: String,
    required: [true, 'Phone model is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['Glossy Metal', 'Glossy Metal + Gel'],
    required: [true, 'Product type is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  variants: [{
    color: {
      type: String,
      required: [true, 'Color is required']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0
    },
    images: [{
      url: String,
      publicId: String,
      isPrimary: { type: Boolean, default: false }
    }],
    sku: {
      type: String,
      // make SKU optional on the schema level; controller will generate when missing
      required: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  mockupTemplateUrl: {
    type: String,
    required: [function() { return this.category === 'Customizable'; }, 'Mockup template is required for custom orders']
  },
  mockupTemplatePublicId: String,
  category: {
    type: String,
    enum: ['Designer', 'Plain', 'Customizable'],
    default: 'Designer'
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  trending: {
    type: Boolean,
    default: false
  },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
productSchema.index({ brand: 1, model: 1 });
productSchema.index({ 'variants.sku': 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ featured: -1, createdAt: -1 });

// Virtual for getting active variants only
productSchema.virtual('activeVariants').get(function() {
  return this.variants.filter(variant => variant.isActive && variant.stock > 0);
});

// Method to check if product has stock
productSchema.methods.hasStock = function() {
  return this.variants.some(variant => variant.isActive && variant.stock > 0);
};

// Method to get variant by SKU
productSchema.methods.getVariantBySku = function(sku) {
  return this.variants.find(variant => variant.sku === sku);
};

module.exports = mongoose.model('Product', productSchema);