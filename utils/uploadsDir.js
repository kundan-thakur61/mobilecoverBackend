const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('./logger');

const defaultUploadsPath = path.join(__dirname, '../public/uploads');

const computeUploadsDir = () => {
  const envUploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : null;
  const candidateDirs = [envUploadsDir, defaultUploadsPath].filter(Boolean);

  for (const dir of candidateDirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (dirError) {
      logger.warn(`Uploads directory ${dir} is not writable. Falling back.`, { error: dirError.message });
    }
  }

  

  const fallbackDir = path.join(os.tmpdir(), 'copadmob-uploads');
  fs.mkdirSync(fallbackDir, { recursive: true });
  logger.warn(`Using temporary uploads directory at ${fallbackDir}. Files will not persist across deploys.`);
  return fallbackDir;
};


let cachedUploadsDir;

const resolveUploadsDir = () => {
  if (cachedUploadsDir) {
    return cachedUploadsDir;
  }

  try {
    const { uploadsDir: configuredUploadsDir } = require('../config/uploadsPath');
    if (configuredUploadsDir) {
      cachedUploadsDir = configuredUploadsDir;
      return cachedUploadsDir;
    }
    logger.warn('config/uploadsPath.js returned an empty uploadsDir. Falling back to default resolver.');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
    logger.warn('config/uploadsPath.js not found. Using default resolver for uploads directory.');
  }

  cachedUploadsDir = computeUploadsDir();
  return cachedUploadsDir;
};

module.exports = {
  computeUploadsDir,
  defaultUploadsPath,
  resolveUploadsDir
};
