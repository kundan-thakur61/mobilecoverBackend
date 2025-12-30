const express = require('express');
const { body, param, validationResult } = require('express-validator');

const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');

const {
  upload, // multer instance
  uploadImage,
  uploadBase64Image,
  uploadProductImage,
  uploadMockupTemplate,
  deleteUploadedImage,
} = require('../controllers/uploadController');

const router = express.Router();

/* -----------------------------
   Async handler (safe wrapper)
-------------------------------- */
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    const result = await fn(req, res, next);
    if (!res.headersSent) {
      res.json({ success: true, data: result });
    }
  } catch (err) {
    next(err);
  }
};

/* -----------------------------
   Validation handler
-------------------------------- */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: errors.array()[0].msg,
      details: errors.array(),
    });
  }
  next();
};

/* -----------------------------
   ObjectId validator
-------------------------------- */
const isObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(value);

/* =====================================================
   ROUTES
===================================================== */

/**
 * Upload image(s)
 * - Auth required
 * - Rate limited
 * - Accepts:
 *   field "image"  (single)
 *   field "images" (multiple)
 */
router.post(
  '/image',
  authMiddleware,
  uploadLimiter,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  asyncHandler(uploadImage)
);

/**
 * Upload base64 image (custom designs)
 */
router.post(
  '/base64',
  authMiddleware,
  uploadLimiter,
  body('image')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('image (base64) is required'),
  handleValidation,
  asyncHandler(uploadBase64Image)
);

/**
 * Upload product variant image (ADMIN)
 */
router.post(
  '/product/:productId/variant/:variantId',
  authMiddleware,
  adminMiddleware,
  param('productId')
    .custom(isObjectId)
    .withMessage('Invalid productId'),
  param('variantId')
    .custom(isObjectId)
    .withMessage('Invalid variantId'),
  handleValidation,
  upload.single('image'),
  asyncHandler(uploadProductImage)
);

/**
 * Upload mockup template (ADMIN)
 */
router.post(
  '/mockup/:productId',
  authMiddleware,
  adminMiddleware,
  param('productId')
    .custom(isObjectId)
    .withMessage('Invalid productId'),
  handleValidation,
  upload.single('mockup'),
  asyncHandler(uploadMockupTemplate)
);

/**
 * Delete uploaded image (Cloudinary)
 * publicId must be URL-encoded from frontend
 */
router.delete(
  '/:publicId',
  authMiddleware,
  param('publicId')
    .trim()
    .notEmpty()
    .withMessage('publicId is required'),
  handleValidation,
  asyncHandler(deleteUploadedImage)
);
 

module.exports = router;
