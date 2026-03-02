const express = require('express');
const {
  listCollectionsPublic,
  getCollectionByHandle,
} = require('../controllers/collectionController');
const { apiCache } = require('../middleware/apiCache');

const router = express.Router();

// Public GET routes — cached for 5 minutes to reduce TTFB
router.get('/', apiCache(300), listCollectionsPublic);
router.get('/:handle', apiCache(300), getCollectionByHandle);

module.exports = router;
