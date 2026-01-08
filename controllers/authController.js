const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const logger = require('../utils/logger');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Return a safe user payload (omit sensitive/internal fields)
const safeUserPayload = (user) => {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : user;
  return {
    id: u._id || u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    upiId: u.upiId || null,
    profilePicture: u.profilePicture || null,
    authProvider: u.authProvider || 'google',
    addresses: u.addresses || [],
    isActive: u.isActive,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  };
};

/**
 * Google OAuth Authentication
 * POST /api/auth/google
 * Verifies Google ID token and creates/logs in user
 */
const googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
    }

    // Verify the Google ID token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
    } catch (verifyError) {
      logger.error('Google token verification failed:', verifyError);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture, email_verified } = payload;

    // Check if user exists by Google ID or email
    let user = await User.findOne({
      $or: [{ googleId }, { email }]
    });

    if (user) {
      // Existing user - update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        if (picture && !user.profilePicture) {
          user.profilePicture = picture;
        }
        await user.save();
        logger.info('Linked Google account to existing user:', { userId: user._id, email });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }
    } else {
      // New user - create account
      user = new User({
        name,
        email,
        googleId,
        profilePicture: picture,
        authProvider: 'google',
        emailVerified: email_verified,
        isActive: true
      });

      await user.save();
      logger.info('New user registered via Google:', { userId: user._id, email });
    }

    // Generate JWT token
    const token = generateToken(user);

    logger.info('User authenticated via Google:', { userId: user._id, email: user.email });

    res.json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: safeUserPayload(user),
        token
      }
    });
  } catch (error) {
    logger.error('Google auth error:', error);
    next(error);
  }
};

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      passwordHash: password,
      phone
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    logger.info('User registered:', { userId: user._id, email: user.email });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: safeUserPayload(user),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user);

    logger.info('User logged in:', { userId: user._id, email: user.email });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: safeUserPayload(user),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');

    res.json({
      success: true,
      data: { user: safeUserPayload(user) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const updates = {};
    
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (req.body.upiId !== undefined) updates.upiId = req.body.upiId;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: safeUserPayload(user) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add or update address
 * POST /api/auth/address
 */
const updateAddress = async (req, res, next) => {
  try {
    const { name, phone, street, city, state, zipCode, country = 'India', isDefault = false } = req.body;
    
    const user = await User.findById(req.user.id);
    
    const newAddress = {
      name,
      phone,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault
    };
    
    // If this is the default address, unset other default addresses
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }
    
    // Add new address
    user.addresses.push(newAddress);
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Address added successfully',
      data: { addresses: user.addresses }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete address
 * DELETE /api/auth/address/:addressId
 */
const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    
    const user = await User.findById(req.user.id);
    
    // Remove address (avoid relying on subdocument.remove())
    user.addresses = user.addresses.filter(a => a._id.toString() !== addressId);
    await user.save();
    
    res.json({
      success: true,
      message: 'Address deleted successfully',
      data: { addresses: user.addresses }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  googleAuth,
  login,
  getMe,
  updateProfile,
  updateAddress,
  deleteAddress
};