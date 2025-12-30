// controllers/uploadController.js
const multer = require('multer');
const path = require('path');
const {
  uploadFromBuffer,
  uploadFromBase64,
  deleteImage
} = require('../utils/cloudinary');
const Product = require('../models/Product');

/**
 * Multer configuration
 * - memoryStorage is REQUIRED for Cloudinary
 */
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/heic',
  'image/heif'
];

const allowedExt = /jpeg|jpg|png|webp|gif|svg|heic|heif/;

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok =
      allowedMimeTypes.includes(file.mimetype) &&
      allowedExt.test(ext);

    if (!ok) {
      const err = new Error(
        'Unsupported file type. Allowed: jpg, jpeg, png, webp, gif, svg, heic, heif'
      );
      err.statusCode = 400;
      return cb(err);
    }

    cb(null, true);
  }
});

/* =====================================================
   UPLOAD NORMAL IMAGE(S) → CLOUDINARY
   ===================================================== */
async function uploadImage(req) {
  const fromFields =
    req.files && typeof req.files === 'object'
      ? [...(req.files.images || []), ...(req.files.image || [])]
      : [];

  const files = fromFields.length
    ? fromFields
    : req.file
    ? [req.file]
    : [];

  if (!files.length) {
    const err = new Error(
      'No files uploaded. Field name must be "image" or "images".'
    );
    err.statusCode = 400;
    throw err;
  }

  const uploadedFiles = [];

  for (const file of files) {
    const result = await uploadFromBuffer(file.buffer, {
      folder: 'uploads'
    });

    uploadedFiles.push({
      originalname: file.originalname,
      size: file.size,
      url: result.secure_url,
      publicId: result.public_id
    });
  }

  return {
    count: uploadedFiles.length,
    files: uploadedFiles
  };
}

/* =====================================================
   UPLOAD BASE64 IMAGE (CANVAS / CUSTOM DESIGN)
   ===================================================== */
async function uploadBase64Image(req) {
  const dataUri = req.body?.image;
  if (!dataUri) {
    const err = new Error('No image (base64) provided');
    err.statusCode = 400;
    throw err;
  }

  const matches = dataUri.match(
    /^data:(image\/[a-zA-Z]+);base64,(.+)$/
  );
  if (!matches) {
    const err = new Error('Invalid base64 image format');
    err.statusCode = 400;
    throw err;
  }

  const buffer = Buffer.from(matches[2], 'base64');

  const result = await uploadFromBase64(dataUri, {
    folder: 'custom-designs'
  });
  

  return {
    size: buffer.length,
    url: result.secure_url,
    publicId: result.public_id
  };
}

/* =====================================================
   UPLOAD PRODUCT VARIANT IMAGE (ADMIN)
   ===================================================== */
async function uploadProductImage(req) {
  const { productId, variantId } = req.params;
  const file = req.file;

  if (!file) {
    const err = new Error('No image uploaded (field name should be "image")');
    err.statusCode = 400;
    throw err;
  }

  const result = await uploadFromBuffer(file.buffer, {
    folder: 'product-images'
  });

  const product = await Product.findById(productId);
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  const variant = product.variants.id(variantId);
  if (!variant) {
    const err = new Error('Variant not found');
    err.statusCode = 404;
    throw err;
  }

  variant.images.push({
    url: result.secure_url,
    publicId: result.public_id,
    isPrimary: variant.images.length === 0
  });

  await product.save();

  return {
    originalname: file.originalname,
    size: file.size,
    url: result.secure_url,
    publicId: result.public_id,
    variantId
  };
}

/* =====================================================
   UPLOAD MOCKUP TEMPLATE (ADMIN)
   ===================================================== */
async function uploadMockupTemplate(req) {
  const file = req.file;
  if (!file) {
    const err = new Error('No mockup uploaded (field name should be "mockup")');
    err.statusCode = 400;
    throw err;
  }

  const result = await uploadFromBuffer(file.buffer, {
    folder: 'mockups'
  });

  return {
    originalname: file.originalname,
    size: file.size,
    url: result.secure_url,
    publicId: result.public_id
  };
}

/* =====================================================
   DELETE IMAGE FROM CLOUDINARY
   ===================================================== */
async function deleteUploadedImage(req) {
  const { publicId } = req.params;
  if (!publicId) {
    const err = new Error('publicId is required');
    err.statusCode = 400;
    throw err;
  }

  await deleteImage(publicId);

  return {
    deleted: true,
    publicId
  };
}

module.exports = {
  upload,
  uploadImage,
  uploadBase64Image,
  uploadProductImage,
  uploadMockupTemplate,
  deleteUploadedImage
};
