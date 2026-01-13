const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const Collection = require('../models/Collection');
const logger = require('../utils/logger');
const { uploadFromBuffer } = require('../utils/cloudinary');

const uploadsDir = path.join(__dirname, '../public/uploads');

const normalizeHandle = (value = '') => (
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
};

const isObjectId = (value = '') => {
  if (typeof value !== 'string') return false;
  return value.length === 24 && /^[0-9a-fA-F]{24}$/.test(value);
};

const cleanUrl = (u) => {
  if (!u) return '';
  if (typeof u !== 'string') return '';
  const v = u.trim();
  if (!v) return '';
  // normalize obvious invalid uploads path
  if (v === '/uploads/undefined' || v.endsWith('/undefined') || v.includes('/uploads/undefined')) return '';
  return v;
};



const sanitizeCollectionForClient = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : JSON.parse(JSON.stringify(doc));
  // heroImage may be { url, publicId } or a string in some code paths
  if (!obj.heroImage) obj.heroImage = { url: '' };
  if (typeof obj.heroImage === 'string') {
    obj.heroImage = { url: cleanUrl(obj.heroImage) };
  } else {
    obj.heroImage.url = cleanUrl(obj.heroImage.url);
  }

  if (Array.isArray(obj.images)) {
    obj.images = obj.images.map((img) => ({
      ...img,
      url: cleanUrl(img?.url || img?.secure_url || img?.path || img?.publicUrl || ''),
    })).filter(img => img.url && img.url.startsWith('http'));
  } else {
    obj.images = [];
  }

  return obj;
};

const findCollectionByIdentifier = async (identifier) => {
  if (!identifier) return null;
  if (isObjectId(identifier)) {
    const doc = await Collection.findById(identifier);
    if (doc) return doc;
  }
  const handle = normalizeHandle(identifier);
  if (!handle) return null;
  
  // First, try to find by exact handle
  let collection = await Collection.findOne({ handle });
  
  // If not found, try with fallback prefix (e.g., 'krishna-theme' -> 'fallback-krishna-theme')
  if (!collection) {
    const fallbackHandle = `fallback-${handle}`;
    collection = await Collection.findOne({ handle: fallbackHandle });
  }
  
  // If still not found, try removing 'fallback-' prefix if present
  if (!collection && handle.startsWith('fallback-')) {
    const strippedHandle = handle.substring(9); // Remove 'fallback-' prefix
    if (strippedHandle) {
      collection = await Collection.findOne({ handle: strippedHandle });
    }
  }
  
  // If still not found, try some common fallback mappings
  if (!collection) {
    // Try mapping known aliases
    const commonMappings = {
      'anime-theme': 'custom-studio',
      'custom-studio': 'anime-theme',
      'krishna-theme': 'dreamy-pastels',
      'dreamy-pastels': 'krishna-theme',
      'marble-theme': 'gilded-marble',
      'gilded-marble': 'marble-theme',
      'cricketer-theme': 'quotes-club',
      'quotes-club': 'cricketer-theme',
      'cute-theme': 'midnight-bloom',
      'midnight-bloom': 'cute-theme',
      'aesthetic-theme': 'aurora-pulse',
      'aurora-pulse': 'aesthetic-theme',
      'flower-theme': 'cosmic-doodles',
      'cosmic-doodles': 'flower-theme',
      'footballer-theme': 'footballer',
      'footballer': 'footballer-theme',
      'football-theme': 'footballer-theme',
    };
    
    const mappedHandle = commonMappings[handle];
    if (mappedHandle) {
      collection = await Collection.findOne({ handle: mappedHandle });
    }
  }

  return collection;
};

const listCollectionsPublic = async (req, res, next) => {
  try {
    const query = { isActive: true };
    if (req.query.handle) {
      const handle = normalizeHandle(req.query.handle);
      if (handle) query.handle = handle;
    }
    const items = await Collection.find(query).sort({ sortOrder: 1, createdAt: -1 });
    const safe = items.map(sanitizeCollectionForClient);
    res.json({ success: true, data: { collections: safe } });
  } catch (err) {
    logger.error('listCollectionsPublic', err);
    next(err);
  }
};

const listCollectionsAdmin = async (req, res, next) => {
  try {
    const query = {};
    const activeFilter = parseBoolean(req.query.active);
    if (activeFilter !== undefined) {
      query.isActive = activeFilter;
    }
    const items = await Collection.find(query).sort({ sortOrder: 1, createdAt: -1 });
    const safe = items.map(sanitizeCollectionForClient);
    res.json({ success: true, data: { collections: safe } });
  } catch (err) {
    logger.error('listCollectionsAdmin', err);
    next(err);
  }
};

const getCollectionByHandle = async (req, res, next) => {
  try {
    const identifier = req.params.handle || req.params.id;
    const collection = await findCollectionByIdentifier(identifier);
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    res.json({ success: true, data: { collection: sanitizeCollectionForClient(collection) } });
  } catch (err) {
    logger.error('getCollectionByHandle', err);
    next(err);
  }
};

const createCollection = async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    const handle = normalizeHandle(req.body.handle || req.body.slug || req.body.identifier || title);
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!handle) {
      return res.status(400).json({ success: false, message: 'Handle is required' });
    }

    const existing = await Collection.findOne({ handle });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Handle already exists' });
    }

    const payload = {
      title,
      handle,
      description: typeof req.body.description === 'string' ? req.body.description.trim() : undefined,
      tagline: typeof req.body.tagline === 'string' ? req.body.tagline.trim() : undefined,
      accentColor: typeof req.body.accentColor === 'string' ? req.body.accentColor.trim() : undefined,
      sortOrder: Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0,
    };

    const activeFlag = parseBoolean(req.body.isActive);
    if (activeFlag !== undefined) payload.isActive = activeFlag;

    if (req.body.heroImage) {
      payload.heroImage = req.body.heroImage;
    }

    const created = new Collection(payload);
    await created.save();
    res.status(201).json({ success: true, data: sanitizeCollectionForClient(created) });
  } catch (err) {
    logger.error('createCollection', err);
    next(err);
  }
};

const updateCollection = async (req, res, next) => {
  try {
    const { handle } = req.params;
    const collection = await findCollectionByIdentifier(handle);
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    const payload = {};

    if (req.body.title !== undefined) payload.title = typeof req.body.title === 'string' ? req.body.title.trim() : req.body.title;
    if (req.body.description !== undefined) payload.description = typeof req.body.description === 'string' ? req.body.description.trim() : req.body.description;
    if (req.body.tagline !== undefined) payload.tagline = typeof req.body.tagline === 'string' ? req.body.tagline.trim() : req.body.tagline;
    if (req.body.accentColor !== undefined) payload.accentColor = typeof req.body.accentColor === 'string' ? req.body.accentColor.trim() : req.body.accentColor;
    if (req.body.heroImage !== undefined) payload.heroImage = req.body.heroImage;
    if (req.body.sortOrder !== undefined) payload.sortOrder = Number(req.body.sortOrder) || 0;

    if (req.body.handle !== undefined || req.body.slug !== undefined) {
      const nextHandle = normalizeHandle(req.body.handle || req.body.slug || '');
      if (!nextHandle) {
        return res.status(400).json({ success: false, message: 'Handle must be a non-empty string' });
      }
      const existing = await Collection.findOne({ handle: nextHandle, _id: { $ne: collection._id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Handle already exists' });
      }
      payload.handle = nextHandle;
    }

    const activeFlag = parseBoolean(req.body.isActive);
    if (activeFlag !== undefined) payload.isActive = activeFlag;

    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, message: 'No collection fields provided for update' });
    }

    Object.assign(collection, payload);
    await collection.save();

    res.json({ success: true, data: sanitizeCollectionForClient(collection) });
  } catch (err) {
    logger.error('updateCollection', err);
    next(err);
  }
};

const deleteCollection = async (req, res, next) => {
  try {
    const { handle } = req.params;
    const doc = await findCollectionByIdentifier(handle);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    await Collection.findByIdAndDelete(doc._id);

    // Remove stored files for images and hero image (best-effort)
    const filesToRemove = [];
    if (doc.heroImage?.publicId) filesToRemove.push(doc.heroImage.publicId);
    doc.images.forEach((img) => {
      if (img.publicId) filesToRemove.push(img.publicId);
    });

    await Promise.all(filesToRemove.map(async (publicId) => {
      const filePath = path.join(uploadsDir, publicId);
      try {
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        logger.warn('deleteCollection: unable to delete file', { filePath, error: unlinkErr.message });
      }
    }));

    res.json({ success: true, data: sanitizeCollectionForClient(doc) });
  } catch (err) {
    logger.error('deleteCollection', err);
    next(err);
  }
};

const mapFilesToImages = (files = [], captions = []) => (
  files.map((file, index) => ({
    url: file && file.filename ? `/uploads/${file.filename}` : '',
    publicId: file && (file.filename || file.originalname) ? (file.filename || file.originalname) : '',
    caption: Array.isArray(captions) ? (captions[index] || '') : captions,
    sortOrder: index,
  }))
);

const resolveCaptions = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [raw];
    } catch (err) {
      return [raw];
    }
  }
  return [];
};

const addCollectionImages = async (req, res, next) => {
  try {
    const { handle } = req.params;
    const files = Array.isArray(req.files) ? req.files : (req.files?.images || []);
    if (!files || !files.length) {
      return res.status(400).json({ success: false, message: 'At least one image is required' });
    }

    const collection = await findCollectionByIdentifier(handle);
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    const captions = resolveCaptions(req.body.captions);
    const startIndex = collection.images.length;

    // Upload each file buffer to Cloudinary and build image objects from results
    const payload = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      // Ensure we have a buffer to upload
      if (!file || !file.buffer) {
        throw new Error('Invalid file upload payload');
      }

      const result = await uploadFromBuffer(file.buffer, { folder: 'uploads' });

      payload.push({
        url: result.secure_url || `/uploads/${file.filename || ''}`,
        publicId: result.public_id || file.filename || file.originalname || '',
        caption: Array.isArray(captions) ? (captions[i] || '') : captions,
        sortOrder: startIndex + i,
      });
    }

    collection.images.push(...payload);
    await collection.save();

    res.status(201).json({ success: true, data: sanitizeCollectionForClient(collection) });
  } catch (err) {
    logger.error('addCollectionImages', err);
    next(err);
  }
};

const removeCollectionImage = async (req, res, next) => {
  try {
    const { handle, imageId } = req.params;
    const collection = await findCollectionByIdentifier(handle);
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    const target = collection.images.id(imageId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const publicId = target.publicId;
    collection.images.pull({ _id: imageId });
    await collection.save();

    if (publicId) {
      const filePath = path.join(uploadsDir, publicId);
      try {
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        logger.warn('removeCollectionImage: unable to delete file', { filePath, error: unlinkErr.message });
      }
    }

    res.json({ success: true, data: sanitizeCollectionForClient(collection) });
  } catch (err) {
    logger.error('removeCollectionImage', err);
    next(err);
  }
};

module.exports = {
  listCollectionsPublic,
  listCollectionsAdmin,
  getCollectionByHandle,
  createCollection,
  updateCollection,
  deleteCollection,
  addCollectionImages,
  removeCollectionImage,
  findCollectionByIdentifier,
};
