const express = require('express');
const {
  listCollectionsPublic,
  getCollectionByHandle,
} = require('../controllers/collectionController');

const router = express.Router();

router.get('/', listCollectionsPublic);
router.get('/:handle', getCollectionByHandle);

module.exports = router;
