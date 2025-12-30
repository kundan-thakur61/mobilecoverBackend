const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  getAllOrders,
  updateOrderStatus
} = require('../controllers/orderController');

const {
  getAllCustomOrders,
  approveCustomOrder,
  rejectCustomOrder,
  updateCustomOrderStatus,
  deleteCustomOrder
} = require('../controllers/customOrderController');

const {
  getDashboardOverview
} = require('../controllers/adminController');

const {
  listCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  listModels,
  createModel,
  updateModel,
  deleteModel,
  addModelFrames,
  removeModelFrame,
  listThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  activateTheme,
  listThemeCategories,
  createThemeCategory,
  updateThemeCategory,
  deleteThemeCategory
} = require('../controllers/mobileController');

const {
  listCollectionsAdmin,
  createCollection,
  updateCollection,
  deleteCollection,
  addCollectionImages,
  removeCollectionImage,
} = require('../controllers/collectionController');

const {
  getAllUsers,
  updateUserRole,
  deleteUser
} = require('../controllers/userController');

const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { upload } = require('../controllers/uploadController');

router.get('/overview',
  authMiddleware,
  adminMiddleware,
  getDashboardOverview
);

// Admin user management
router.get('/users',
  authMiddleware,
  adminMiddleware,
  getAllUsers
);

router.put('/users/:id/role',
  authMiddleware,
  adminMiddleware,
  [
    body('role').isIn(['user', 'admin']).withMessage('Invalid role')
  ],
  validateRequest,
  updateUserRole
);

router.delete('/users/:id',
  authMiddleware,
  adminMiddleware,
  deleteUser
);

// Admin order management
router.get('/orders', 
  authMiddleware,
  adminMiddleware,
  getAllOrders
);

router.put('/orders/:id/status', 
  authMiddleware,
  adminMiddleware,
  [
    body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status'),
    body('trackingNumber').optional().trim().isLength({ min: 5, max: 50 }),
    body('notes').optional().trim().isLength({ max: 500 })
  ],
  validateRequest,
  updateOrderStatus
);

// Admin custom order management
router.get('/custom-orders', 
  authMiddleware,
  adminMiddleware,
  getAllCustomOrders
);

router.put('/custom/:id/approve', 
  authMiddleware,
  adminMiddleware,
  [
    body('adminNotes').optional().trim().isLength({ max: 500 }),
    body('mockupUrl').optional().isURL(),
    body('mockupPublicId').optional().trim()
  ],
  validateRequest,
  approveCustomOrder
);

router.put('/custom/:id/reject', 
  authMiddleware,
  adminMiddleware,
  [
    body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Rejection reason is required'),
    body('adminNotes').optional().trim().isLength({ max: 500 })
  ],
  validateRequest,
  rejectCustomOrder
);

router.put('/custom/:id/status', 
  authMiddleware,
  adminMiddleware,
  [
    body('status').isIn(['pending', 'approved', 'rejected', 'in_production', 'shipped', 'delivered']).withMessage('Invalid status'),
    body('trackingNumber').optional().trim().isLength({ min: 5, max: 50 }),
    body('notes').optional().trim().isLength({ max: 500 })
  ],
  validateRequest,
  updateCustomOrderStatus
);

router.delete('/custom/:id',
  authMiddleware,
  adminMiddleware,
  deleteCustomOrder
);

// Mobile company & model admin endpoints
router.get('/mobile/companies',
  authMiddleware,
  adminMiddleware,
  listCompanies
);

router.post('/mobile/companies',
  authMiddleware,
  adminMiddleware,
  createCompany
);

router.put('/mobile/companies/:id',
  authMiddleware,
  adminMiddleware,
  updateCompany
);

router.delete('/mobile/companies/:id',
  authMiddleware,
  adminMiddleware,
  deleteCompany
);

router.get('/mobile/models',
  authMiddleware,
  adminMiddleware,
  listModels
);

router.post('/mobile/models',
  authMiddleware,
  adminMiddleware,
  createModel
);

router.put('/mobile/models/:id',
  authMiddleware,
  adminMiddleware,
  updateModel
);

router.delete('/mobile/models/:id',
  authMiddleware,
  adminMiddleware,
  deleteModel
);

router.post('/mobile/models/:id/frames',
  authMiddleware,
  adminMiddleware,
  upload.array('frames', 10),
  addModelFrames
);

router.delete('/mobile/models/:id/frames/:frameId',
  authMiddleware,
  adminMiddleware,
  removeModelFrame
);

// Theme management
router.get('/themes/categories',
  authMiddleware,
  adminMiddleware,
  listThemeCategories
);

router.post('/themes/categories',
  authMiddleware,
  adminMiddleware,
  createThemeCategory
);

router.put('/themes/categories/:id',
  authMiddleware,
  adminMiddleware,
  updateThemeCategory
);

router.delete('/themes/categories/:id',
  authMiddleware,
  adminMiddleware,
  deleteThemeCategory
);

router.get('/themes',
  authMiddleware,
  adminMiddleware,
  listThemes
);

router.post('/themes',
  authMiddleware,
  adminMiddleware,
  createTheme
);

router.put('/themes/:id',
  authMiddleware,
  adminMiddleware,
  updateTheme
);

router.delete('/themes/:id',
  authMiddleware,
  adminMiddleware,
  deleteTheme
);

router.put('/themes/:id/activate',
  authMiddleware,
  adminMiddleware,
  activateTheme
);

// Collection gallery management
router.get('/collections',
  authMiddleware,
  adminMiddleware,
  listCollectionsAdmin
);

router.post('/collections',
  authMiddleware,
  adminMiddleware,
  createCollection
);

router.put('/collections/:id',
  authMiddleware,
  adminMiddleware,
  updateCollection
);

router.delete('/collections/:id',
  authMiddleware,
  adminMiddleware,
  deleteCollection
);

router.post('/collections/:id/images',
  authMiddleware,
  adminMiddleware,
  upload.array('images', 20),
  addCollectionImages
);

router.delete('/collections/:id/images/:imageId',
  authMiddleware,
  adminMiddleware,
  removeCollectionImage
);

module.exports = router;