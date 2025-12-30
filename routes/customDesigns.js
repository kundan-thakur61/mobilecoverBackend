const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createDesign, updateDesign, getMyDesigns, getDesign, deleteDesign } = require('../controllers/customDesignController');

// Create new design
router.post('/', authMiddleware, [
  body('imgSrc').notEmpty().withMessage('imgSrc is required')
], createDesign);

// Update design
router.put('/:id', authMiddleware, updateDesign);

// Delete design
router.delete('/:id', authMiddleware, deleteDesign);

// Get my designs
router.get('/', authMiddleware, getMyDesigns);

// Get single design
router.get('/:id', authMiddleware, getDesign);

module.exports = router;
