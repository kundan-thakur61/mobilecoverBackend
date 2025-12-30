const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const validator = require('validator');

const {
  createCustomOrder,
  createCustomPayment,
  verifyCustomPayment,
  getMyCustomOrders,
  getCustomOrder,
  getCustomOrderPublic
} = require('../controllers/customOrderController');

const { authMiddleware } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');

// Validation rules
const customOrderValidation = [
  // productId is optional for free-form custom orders; if present must be a valid ObjectId
  body('productId').optional({ nullable: true }).isMongoId().withMessage('Invalid product ID'),
  // Variant can be partial from the frontend (name only). Make fields optional.
  body('variant').custom((v) => (v ? true : false)).withMessage('Variant is required'),
  body('variant.color').optional().trim().isLength({ min: 2 }).withMessage('Color is required'),
  body('variant.price').optional().isFloat({ min: 0 }).withMessage('Price must be positive'),
  body('variant.sku').optional().trim().isLength({ min: 1 }).withMessage('SKU is required'),
  body('quantity').isInt({ min: 1, max: 10 }).withMessage('Quantity must be between 1 and 10'),
  body('imageUrls').isArray({ min: 1 }).withMessage('At least one image is required'),
  // Allow either a hosted URL or a data URL (data:image/png;base64,...)
  body('mockupUrl').custom((value) => {
    if (!value) throw new Error('Valid mockup URL is required');
    if (typeof value !== 'string') throw new Error('Valid mockup URL is required');
    if (/^data:image\/[a-zA-Z]+;base64,/.test(value)) return true;
    if (validator.isURL(value, { require_protocol: true })) return true;
    throw new Error('Valid mockup URL is required');
  }),
  body('instructions').optional().trim().isLength({ max: 500 }).withMessage('Instructions cannot exceed 500 characters'),
  body('shippingAddress.name').trim().isLength({ min: 2, max: 50 }).withMessage('Name is required'),
  // Accept phone numbers 7-15 digits (frontend uses this range)
  body('shippingAddress.phone').matches(/^[0-9]{7,15}$/).withMessage('Invalid phone number'),
  // Accept either 'street' or 'address1' from frontend
  body('shippingAddress.street').optional().trim().isLength({ min: 5 }).withMessage('Street address is required'),
  body('shippingAddress.address1').optional().trim().isLength({ min: 5 }).withMessage('Street address is required'),
  body('shippingAddress.city').trim().isLength({ min: 2 }).withMessage('City is required'),
  body('shippingAddress.state').trim().isLength({ min: 2 }).withMessage('State is required'),
  // Accept postal code or zip code with 3-10 digits
  body('shippingAddress.postalCode').optional().matches(/^[0-9]{3,10}$/).withMessage('Invalid postal code'),
  body('shippingAddress.zipCode').optional().matches(/^[0-9]{3,10}$/).withMessage('Invalid zip code'),
  // Ensure at least one street/address1 and one postal code field exists
  body().custom((body) => {
    const sa = body.shippingAddress || {};
    if (!sa.street && !sa.address1) throw new Error('Street address is required');
    if (!sa.postalCode && !sa.zipCode) throw new Error('Postal code is required');
    return true;
  })
];

const customPaymentVerificationValidation = [
  body('razorpay_order_id').isString().withMessage('Order ID is required'),
  body('razorpay_payment_id').isString().withMessage('Payment ID is required'),
  body('razorpay_signature').isString().withMessage('Signature is required'),
  body('customOrderId').isMongoId().withMessage('Invalid custom order ID')
];

// Routes
router.post('/order', 
  authMiddleware,
  uploadLimiter,
  customOrderValidation,
  validateRequest,
  createCustomOrder
);

router.post('/pay', 
  authMiddleware,
  body('customOrderId').isMongoId().withMessage('Invalid custom order ID'),
  validateRequest,
  createCustomPayment
);

router.post('/pay/verify', 
  authMiddleware,
  customPaymentVerificationValidation,
  validateRequest,
  verifyCustomPayment
);

router.get('/orders', 
  authMiddleware,
  getMyCustomOrders
);

router.get('/orders/:id',
  authMiddleware,
  getCustomOrder
);

// Public route for order success page (no auth required)
router.get('/order/:id', getCustomOrderPublic);

module.exports = router;
