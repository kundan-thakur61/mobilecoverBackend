
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { orderLimiter } = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');

// Get only custom orders for logged-in user
router.get('/my-custom', 
  authMiddleware,
  require('../controllers/orderController').getMyCustomOrders
);

const {
  createOrder,
  verifyPayment,
  createPaymentOrder,
  getMyOrders,
  getOrder,
  cancelOrder
} = require('../controllers/orderController');

// Validation rules
const orderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('shippingAddress.name').trim().isLength({ min: 2, max: 50 }).withMessage('Name is required'),
  body('shippingAddress.phone').matches(/^[0-9]{7,15}$/).withMessage('Phone must be 7-15 digits'),
  body('shippingAddress.address1').trim().isLength({ min: 5 }).withMessage('Address is required'),
  body('shippingAddress.city').trim().isLength({ min: 2 }).withMessage('City is required'),
  body('shippingAddress.state').trim().isLength({ min: 2 }).withMessage('State is required'),
  body('shippingAddress.postalCode').trim().isLength({ min: 1 }).withMessage('Postal code is required'),
  body('paymentMethod').optional().isIn(['razorpay', 'cod', 'upi']).withMessage('Invalid payment method')
];

const paymentVerificationValidation = [
  body('razorpay_order_id').isString().withMessage('Order ID is required'),
  body('razorpay_payment_id').isString().withMessage('Payment ID is required'),
  body('razorpay_signature').isString().withMessage('Signature is required'),
  body('orderId').isMongoId().withMessage('Invalid order ID')
];

const cancelValidation = [
  body('reason').optional().trim().isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5 and 500 characters')
];

// Routes - Guest checkout allowed
router.post('/', 
  optionalAuth,  // Allow guests
  orderLimiter,
  orderValidation,
  validateRequest,
  createOrder
);

router.post('/pay/create', 
  optionalAuth,  // Allow guests
  body('orderId').isMongoId().withMessage('Invalid order ID'),
  validateRequest,
  createPaymentOrder
);

router.post('/pay/verify', 
  optionalAuth,  // Allow guests
  paymentVerificationValidation,
  validateRequest,
  verifyPayment
);

router.get('/my', 
  authMiddleware,
  getMyOrders
);

router.get('/:id', 
  authMiddleware,
  getOrder
);

router.put('/:id/cancel', 
  authMiddleware,
  cancelValidation,
  validateRequest,
  cancelOrder
);

module.exports = router;