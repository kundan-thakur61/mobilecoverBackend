let mongod;
const logger = require('../utils/logger');

module.exports = async () => {
  if (process.env.NODE_ENV !== 'test') return;

  // Try to start an in-memory MongoDB for faster, isolated tests.
  // If the optional dependency is not installed (e.g. offline), skip gracefully
  // and allow tests to use `process.env.MONGO_TEST_URI` or localhost.
  let MongoMemoryServer;
  try {
    MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
  } catch (err) {
    logger.warn('mongodb-memory-server not installed; skipping in-memory MongoDB. Tests will use configured MongoDB URI.');
    return;
  }

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_TEST_URI = uri;
  logger.info('Started in-memory MongoDB for tests', { uri });

  // Store instance so we can stop it on process exit
  process.__MONGOD__ = mongod;

  // Ensure the mongod is stopped when the process exits
  process.on('exit', async () => {
    try {
      if (process.__MONGOD__) await process.__MONGOD__.stop();
    } catch (e) {
      // ignore
    }
  });
};
