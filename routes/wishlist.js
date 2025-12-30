const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { getWishlist, addToWishlist, removeFromWishlist } = require('../controllers/wishlistController');
const { authMiddleware } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

// Get current user's wishlist
router.get('/', authMiddleware, getWishlist);

// Add to wishlist
router.post('/',
  authMiddleware,
  [ body('productId').notEmpty().withMessage('productId is required') ],
  validateRequest,
  addToWishlist
);

// Remove from wishlist
router.delete('/:productId', authMiddleware, removeFromWishlist);

module.exports = router;
