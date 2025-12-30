const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

const defaultUploadsDir = path.join(__dirname, '../public/uploads');
const envUploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : null;
const candidateDirs = [envUploadsDir, defaultUploadsDir].filter(Boolean);

let uploadsDir;
   

for (const dir of candidateDirs) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    uploadsDir = dir;
    break;
  } catch (error) {
    logger.warn(`Uploads directory ${dir} is not writable. Falling back.`, { error: error.message });
  }
}

if (!uploadsDir) {
  const fallbackDir = path.join(os.tmpdir(), 'copadmob-uploads');
  fs.mkdirSync(fallbackDir, { recursive: true });
  uploadsDir = fallbackDir;
  logger.warn(`Using temporary uploads directory at ${fallbackDir}. Files will not persist across deploys.`);
}

module.exports = { uploadsDir };
