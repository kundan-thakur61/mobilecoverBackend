/**
 * Test Cloudinary Image Upload
 * Tests if images are being saved to Cloudinary correctly
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  uploadFromBuffer,
  uploadFromBase64,
  deleteImage,
  cloudinary
} = require('./utils/cloudinary');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}═══════════════════════════════════${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}═══════════════════════════════════${colors.reset}\n`)
};

/**
 * Test 1: Check Cloudinary Configuration
 */
async function testCloudinaryConfig() {
  log.section('TEST 1: Cloudinary Configuration Check');

  try {
    const config = cloudinary.config();
    
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      log.error('CLOUDINARY_CLOUD_NAME is not set in .env');
      return false;
    }
    if (!process.env.CLOUDINARY_API_KEY) {
      log.error('CLOUDINARY_API_KEY is not set in .env');
      return false;
    }
    if (!process.env.CLOUDINARY_API_SECRET) {
      log.error('CLOUDINARY_API_SECRET is not set in .env');
      return false;
    }

    log.success(`Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    log.success(`API Key configured: ${process.env.CLOUDINARY_API_KEY.substring(0, 5)}...`);
    log.success(`API Secret configured: ${process.env.CLOUDINARY_API_SECRET.substring(0, 5)}...`);
    
    return true;
  } catch (error) {
    log.error(`Configuration check failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Create a Sample Image and Upload Buffer
 */
async function testBufferUpload() {
  log.section('TEST 2: Buffer Upload to Cloudinary');

  try {
    // Create a simple test image (1x1 pixel red PNG)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x03, 0x00, 0x01, 0x5b, 0x1b, 0xb6, 0xee, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82
    ]);

    log.info('Uploading test image buffer to Cloudinary...');
    const result = await uploadFromBuffer(pngBuffer, {
      folder: 'uploads/test',
      public_id: `test-upload-${Date.now()}`
    });

    log.success(`Image uploaded successfully!`);
    log.info(`Public ID: ${result.public_id}`);
    log.info(`Secure URL: ${result.secure_url}`);
    log.info(`File Size: ${result.bytes} bytes`);
    log.info(`Width x Height: ${result.width} x ${result.height}`);
    log.info(`Resource Type: ${result.resource_type}`);

    // Test deletion
    log.info(`\nDeleting test image...`);
    const deleteResult = await deleteImage(result.public_id);
    log.success(`Image deleted successfully!`);

    return true;
  } catch (error) {
    log.error(`Buffer upload test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Base64 Upload
 */
async function testBase64Upload() {
  log.section('TEST 3: Base64 Upload to Cloudinary');

  try {
    // Create base64 PNG (red 1x1 pixel)
    const base64String = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    log.info('Uploading base64 image to Cloudinary...');
    const result = await uploadFromBase64(base64String, {
      folder: 'uploads/test',
      public_id: `test-base64-${Date.now()}`
    });

    log.success(`Base64 image uploaded successfully!`);
    log.info(`Public ID: ${result.public_id}`);
    log.info(`Secure URL: ${result.secure_url}`);
    log.info(`File Size: ${result.bytes} bytes`);

    // Test deletion
    log.info(`\nDeleting test image...`);
    const deleteResult = await deleteImage(result.public_id);
    log.success(`Image deleted successfully!`);

    return true;
  } catch (error) {
    log.error(`Base64 upload test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Upload from Local File
 */
async function testFileUpload() {
  log.section('TEST 4: Upload from Local File');

  try {
    // Check if any test files exist
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      log.warn(`Local uploads directory not found: ${uploadsDir}`);
      log.warn('Skipping local file upload test');
      return null;
    }

    const files = fs.readdirSync(uploadsDir);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));

    if (imageFiles.length === 0) {
      log.warn('No image files found in uploads directory');
      return null;
    }

    const testFile = imageFiles[0];
    const filePath = path.join(uploadsDir, testFile);
    log.info(`Found local image file: ${testFile}`);

    const buffer = fs.readFileSync(filePath);
    log.info(`File size: ${buffer.length} bytes`);

    log.info('Uploading to Cloudinary...');
    const result = await uploadFromBuffer(buffer, {
      folder: 'uploads/test',
      public_id: `test-file-${Date.now()}`
    });

    log.success(`File uploaded successfully!`);
    log.info(`Public ID: ${result.public_id}`);
    log.info(`Secure URL: ${result.secure_url}`);

    return true;
  } catch (error) {
    log.error(`File upload test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Verify Upload Folder
 */
async function testUploadFolder() {
  log.section('TEST 5: Check Upload Resources in Cloudinary');

  try {
    log.info('Fetching resources from "uploads" folder...');
    
    const response = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'uploads/',
      max_results: 10
    });

    if (response.resources && response.resources.length > 0) {
      log.success(`Found ${response.resources.length} images in uploads folder!`);
      response.resources.slice(0, 5).forEach((resource, i) => {
        log.info(`  ${i + 1}. ${resource.public_id} (${resource.bytes} bytes)`);
      });
    } else {
      log.warn('No images found in uploads folder');
    }

    return true;
  } catch (error) {
    log.error(`Failed to check upload folder: ${error.message}`);
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log('\n\n');
  log.section('🚀 CLOUDINARY UPLOAD TEST SUITE');

  const results = {
    configTest: false,
    bufferTest: false,
    base64Test: false,
    fileTest: null,
    folderTest: false
  };

  // Run tests
  results.configTest = await testCloudinaryConfig();
  
  if (!results.configTest) {
    log.error('Configuration test failed. Cannot proceed with upload tests.');
    printSummary(results);
    process.exit(1);
  }

  results.bufferTest = await testBufferUpload();
  results.base64Test = await testBase64Upload();
  results.fileTest = await testFileUpload();
  results.folderTest = await testUploadFolder();

  // Print summary
  printSummary(results);
}

/**
 * Print Test Summary
 */
function printSummary(results) {
  log.section('📊 TEST SUMMARY');

  console.log(`Configuration Check: ${results.configTest ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);
  console.log(`Buffer Upload Test: ${results.bufferTest ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);
  console.log(`Base64 Upload Test: ${results.base64Test ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);
  console.log(`File Upload Test: ${results.fileTest === null ? colors.yellow + '⊘ SKIPPED' : (results.fileTest ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED')}${colors.reset}`);
  console.log(`Upload Folder Check: ${results.folderTest ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);

  const passedTests = Object.values(results).filter(r => r === true).length;
  const totalTests = Object.values(results).filter(r => r !== null).length;

  log.section(`RESULT: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    log.success('All tests passed! ✨ Images are being saved to Cloudinary correctly.');
  } else {
    log.error('Some tests failed. Please check the configuration and logs above.');
  }

  process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
