const CustomDesign = require('../models/CustomDesign');
const logger = require('../utils/logger');

/**
 * Create a new saved custom design for the logged-in user
 * POST /api/custom-designs
 */
const createDesign = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, frame, imgSrc, transform = {}, meta = {}, notes = '' } = req.body;

    if (!imgSrc) {
      return res.status(400).json({ success: false, message: 'imgSrc is required' });
    }

    const design = new CustomDesign({ userId, name, frame, imgSrc, transform, meta, notes });
    await design.save();

    logger.info('Custom design saved', { designId: design._id, userId });

    res.status(201).json({ success: true, data: { design } });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing design (only owner)
 * PUT /api/custom-designs/:id
 */
const updateDesign = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;
    const payload = req.body;

    const design = await CustomDesign.findById(id);
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    if (design.userId.toString() !== userId) return res.status(403).json({ success: false, message: 'Access denied' });

    Object.assign(design, payload);
    await design.save();

    logger.info('Custom design updated', { designId: design._id, userId });

    res.json({ success: true, data: { design } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's designs
 * GET /api/custom-designs
 */
const getMyDesigns = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const designs = await CustomDesign.find({ userId }).sort('-createdAt');
    res.json({ success: true, data: { designs } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single design by id (owner only)
 * GET /api/custom-designs/:id
 */
const getDesign = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;
    const design = await CustomDesign.findById(id);
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    if (design.userId.toString() !== userId) return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: { design } });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a design (owner only)
 * DELETE /api/custom-designs/:id
 */
const deleteDesign = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;
    const design = await CustomDesign.findById(id);
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    if (design.userId.toString() !== userId) return res.status(403).json({ success: false, message: 'Access denied' });

    // use findByIdAndDelete to avoid relying on deprecated/removed document.remove()
    await CustomDesign.findByIdAndDelete(id);
    logger.info('Custom design deleted', { designId: id, userId });
    res.json({ success: true, message: 'Design deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createDesign, updateDesign, getMyDesigns, getDesign, deleteDesign };
