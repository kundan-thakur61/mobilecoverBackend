const User = require('../models/User');
const Product = require('../models/Product');
const logger = require('../utils/logger');

/**
 * Get current user's wishlist
 * GET /api/wishlist
 */
const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist', '-mockupTemplatePublicId');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: { wishlist: user.wishlist || [] } });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a product to wishlist
 * POST /api/wishlist
 * body: { productId }
 */
const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'productId is required' });

    const product = await Product.findById(productId).select('_id isActive title');
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const exists = user.wishlist?.some(id => id.toString() === productId.toString());
    if (exists) {
      return res.status(400).json({ success: false, message: 'Product already in wishlist' });
    }

    user.wishlist = user.wishlist || [];
    user.wishlist.push(product._id);
    await user.save();

    logger.info('Added to wishlist', { userId: user._id, productId: product._id });

    res.status(201).json({ success: true, message: 'Added to wishlist', data: { product } });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a product from wishlist
 * DELETE /api/wishlist/:productId
 */
const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.wishlist = (user.wishlist || []).filter(id => id.toString() !== productId.toString());
    await user.save();

    logger.info('Removed from wishlist', { userId: user._id, productId });

    res.json({ success: true, message: 'Removed from wishlist', data: { productId } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
