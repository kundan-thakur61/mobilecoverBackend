const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Request validation middleware
 * Checks for validation errors and sends appropriate response
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errDetails = errors.array().map(err => ({ field: err.param, message: err.msg, value: err.value }));
    // Log validation errors and a truncated request body for local debugging
    try {
      const bodyPreview = JSON.stringify(req.body, null, 2).slice(0, 1000);
      logger.warn('Request validation failed', { path: req.path, method: req.method, errors: errDetails, bodyPreview });
    } catch (logErr) {
      logger.warn('Request validation failed (could not stringify body)', { path: req.path, method: req.method, errors: errDetails });
    }

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errDetails
    });
  }
  
  next();
};

module.exports = validateRequest;