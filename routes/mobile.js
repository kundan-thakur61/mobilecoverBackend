const express = require('express');
const router = express.Router();

const { listCompanies, listModels, getActiveTheme, getThemeByKey } = require('../controllers/mobileController');

// Root endpoint - mobile API information
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'Mobile API endpoints',
    version: '1.0.0',
    endpoints: {
      companies: '/api/mobile/companies',
      models: '/api/mobile/models',
      activeTheme: '/api/mobile/themes/active',
      themeByKey: '/api/mobile/themes/:key'
    },
    documentation: 'See README.md for API documentation'
  });
});

// Public endpoints: list companies and models
router.get('/companies', listCompanies);
router.get('/models', listModels);

// Also expose current active theme for frontend to consume
router.get('/themes/active', getActiveTheme);

// Public detail by key/slug
router.get('/themes/:key', getThemeByKey);

module.exports = router;
