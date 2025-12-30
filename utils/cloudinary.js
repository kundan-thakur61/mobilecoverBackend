const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const logger = require('./logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const COMMON_OPTIONS = {
  resource_type: 'image',
  allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif'],
  transformation: [
    { quality: 'auto:good' },
    { fetch_format: 'auto' },
    { flags: 'strip_profile' }
  ]
};

const uploadFromBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'mobile-covers',
        ...COMMON_OPTIONS,
        ...options
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error', error);
          return reject(new Error('Image upload failed'));
        }
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

const uploadFromBase64 = (base64String, options = {}) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      base64String,
      {
        folder: options.folder || 'mobile-covers',
        ...COMMON_OPTIONS,
        ...options
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary base64 upload error', error);
          return reject(new Error('Base64 image upload failed'));
        }
        resolve(result);
      }
    );
  });
};

const deleteImage = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        logger.error('Cloudinary delete error', error);
        return reject(new Error('Image delete failed'));
      }
      resolve(result);
    });
  });
};

const getTransformedUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    ...transformations
  });
};

module.exports = {
  cloudinary,
  uploadFromBuffer,
  uploadFromBase64,
  deleteImage,
  getTransformedUrl 
};
