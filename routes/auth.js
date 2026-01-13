const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  login,
  register,
  getMe,
  updateProfile,
  updateAddress,
  deleteAddress
} = require('../controllers/authController');

const { authMiddleware } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');

const addressValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('phone')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a valid 10-digit phone number'),
  body('street')
    .optional()
    .trim()
    .isLength({ min: 5 })
    .withMessage('Street address must be at least 5 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('City must be at least 2 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('State must be at least 2 characters'),
  body('zipCode')
    .optional()
    .matches(/^[0-9]{6}$/)
    .withMessage('Please enter a valid 6-digit zip code')
];

// Admin Email/Password Login Route
router.post('/login',
  authLimiter,
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validateRequest,
  login
);

// Google OAuth Route - DISABLED
// router.post('/google', googleAuth);

// Register Route
router.post('/register',
  authLimiter,
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Please enter a valid 10-digit phone number'),
  validateRequest,
  register
);

router.get('/me',
  authMiddleware,
  getMe
);

router.put('/profile', 
  authMiddleware,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a valid 10-digit phone number'),
  validateRequest,
  updateProfile
);

router.post('/address', 
  authMiddleware,
  addressValidation,
  validateRequest,
  updateAddress
);

router.delete('/address/:addressId', 
  authMiddleware,
  deleteAddress
);

module.exports = router;