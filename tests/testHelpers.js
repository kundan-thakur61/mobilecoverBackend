/**
 * Test Helpers for Authentication
 * Since we use Google OAuth for production, tests use direct JWT generation
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generate a valid JWT token for a user (for testing purposes)
 * @param {Object} user - Mongoose User document
 * @returns {string} JWT token
 */
const generateTestToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role || 'user'
    },
    process.env.JWT_SECRET || 'test-jwt-secret-key',
    { expiresIn: '1h' }
  );
};

/**
 * Create a test user and return both user and token
 * @param {Object} userData - User data to create
 * @returns {Promise<{user: Object, token: string}>}
 */
const createTestUser = async (userData = {}) => {
  const defaultData = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    googleId: `google-${Date.now()}`,
    authProvider: 'google',
    isActive: true,
    emailVerified: true
  };

  const user = new User({ ...defaultData, ...userData });
  await user.save();

  const token = generateTestToken(user);

  return { user, token };
};

/**
 * Create a test admin user and return both user and token
 * @param {Object} userData - User data to create
 * @returns {Promise<{user: Object, token: string}>}
 */
const createTestAdmin = async (userData = {}) => {
  return createTestUser({
    ...userData,
    role: 'admin'
  });
};

module.exports = {
  generateTestToken,
  createTestUser,
  createTestAdmin
};
