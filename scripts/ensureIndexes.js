/**
 * Database Index Initialization Script
 * Run on startup to ensure all performance-critical indexes exist.
 * 
 * Usage: Called automatically from index.js after MongoDB connection,
 *        or manually: node scripts/ensureIndexes.js
 */

const logger = require('../utils/logger');

const ensureAllIndexes = async () => {
  try {
    const Product = require('../models/Product');
    const Order = require('../models/Order');
    const Collection = require('../models/Collection');
    const User = require('../models/User');

    // Product indexes for common queries
    await Product.collection.createIndex(
      { isActive: 1, category: 1, brand: 1 },
      { background: true, name: 'idx_active_category_brand' }
    ).catch(() => {});

    await Product.collection.createIndex(
      { isActive: 1, featured: 1 },
      { background: true, name: 'idx_active_featured' }
    ).catch(() => {});

    await Product.collection.createIndex(
      { isActive: 1, trending: 1 },
      { background: true, name: 'idx_active_trending' }
    ).catch(() => {});

    await Product.collection.createIndex(
      { isActive: 1, createdAt: -1 },
      { background: true, name: 'idx_active_created' }
    ).catch(() => {});

    // Text index for search
    await Product.collection.createIndex(
      { title: 'text', brand: 'text', model: 'text', description: 'text' },
      { background: true, name: 'idx_product_search', weights: { title: 10, brand: 5, model: 5, description: 1 } }
    ).catch(() => {});

    // Order indexes
    await Order.collection.createIndex(
      { user: 1, createdAt: -1 },
      { background: true, name: 'idx_user_orders' }
    ).catch(() => {});

    await Order.collection.createIndex(
      { status: 1, createdAt: -1 },
      { background: true, name: 'idx_order_status' }
    ).catch(() => {});

    // Collection indexes
    await Collection.collection.createIndex(
      { isActive: 1, handle: 1 },
      { background: true, name: 'idx_collection_active_handle' }
    ).catch(() => {});

    // User indexes
    await User.collection.createIndex(
      { email: 1 },
      { unique: true, background: true, name: 'idx_user_email' }
    ).catch(() => {});

    logger.info('All performance indexes ensured successfully');
  } catch (error) {
    logger.error('Failed to ensure indexes:', error.message);
  }
};

module.exports = { ensureAllIndexes };

// Run directly if called as script
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce')
    .then(async () => {
      await ensureAllIndexes();
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
