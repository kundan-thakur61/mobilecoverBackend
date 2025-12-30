const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addVariant,
  updateVariant,
  deleteVariant
} = require('../controllers/productController');
const {
  getProductReviews,
  createProductReview,
  updateProductReview,
  deleteProductReview
} = require('../controllers/productReviewController');

const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const validateRequest = require('../middleware/validateRequest');

// Public routes
router.get('/', getProducts);
router.get('/:id', getProduct);
router.get('/:id/reviews', optionalAuth, getProductReviews);

// Admin only routes
router.post('/', 
  authMiddleware,
  adminMiddleware,
  [
    body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
    body('brand').trim().isLength({ min: 2, max: 50 }).withMessage('Brand is required'),
    body('model').trim().isLength({ min: 2, max: 50 }).withMessage('Model is required'),
    body('type').isIn(['Glossy Metal', 'Glossy Metal + Gel']).withMessage('Invalid product type'),
    body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    body('category').optional().isIn(['Designer', 'Plain', 'Customizable']).withMessage('Invalid category'),
    body('featured').optional().isBoolean().withMessage('Featured must be a boolean')
  ],
  validateRequest,
  createProduct
);

router.put('/:id', 
  authMiddleware,
  adminMiddleware,
  [
    body('title').optional().trim().isLength({ min: 3, max: 100 }),
    body('brand').optional().trim().isLength({ min: 2, max: 50 }),
    body('model').optional().trim().isLength({ min: 2, max: 50 }),
    body('type').optional().isIn(['Glossy Metal', 'Glossy Metal + Gel']),
    body('description').optional().trim().isLength({ min: 10, max: 1000 }),
    body('category').optional().isIn(['Designer', 'Plain', 'Customizable']),
    body('featured').optional().isBoolean()
  ],
  validateRequest,
  updateProduct
);

router.delete('/:id', 
  authMiddleware,
  adminMiddleware,
  deleteProduct
);

router.post('/:id/reviews',
  authMiddleware,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('title').optional().trim().isLength({ min: 3, max: 120 }).withMessage('Title must be between 3 and 120 characters'),
    body('comment').optional().trim().isLength({ min: 10, max: 1500 }).withMessage('Comment must be between 10 and 1500 characters')
  ],
  validateRequest,
  createProductReview
);

router.put('/:id/reviews/:reviewId',
  authMiddleware,
  [
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('title').optional().trim().isLength({ min: 3, max: 120 }).withMessage('Title must be between 3 and 120 characters'),
    body('comment').optional().trim().isLength({ min: 10, max: 1500 }).withMessage('Comment must be between 10 and 1500 characters')
  ],
  validateRequest,
  updateProductReview
);

router.delete('/:id/reviews/:reviewId',
  authMiddleware,
  deleteProductReview
);

// Variant routes
router.post('/:id/variants', 
  authMiddleware,
  adminMiddleware,
  [
    body('color').trim().isLength({ min: 2, max: 30 }).withMessage('Color is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('sku').trim().isLength({ min: 3, max: 50 }).withMessage('SKU is required')
  ],
  validateRequest,
  addVariant
);

router.put('/:id/variants/:variantId', 
  authMiddleware,
  adminMiddleware,
  [
    body('color').optional().trim().isLength({ min: 2, max: 30 }),
    body('price').optional().isFloat({ min: 0 }),
    body('stock').optional().isInt({ min: 0 }),
    body('sku').optional().trim().isLength({ min: 3, max: 50 }),
    body('isActive').optional().isBoolean()
  ],
  validateRequest,
  updateVariant
);

router.delete('/:id/variants/:variantId', 
  authMiddleware,
  adminMiddleware,
  deleteVariant
);

module.exports = router;