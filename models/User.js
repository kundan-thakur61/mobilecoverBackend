const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  // Google OAuth fields
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows null values while maintaining uniqueness
  },
  profilePicture: {
    type: String
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'google'
  },
  // Password is now optional (not required for Google OAuth users)
  passwordHash: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  addresses: [{
    name: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false }
  }],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  phone: {
    type: String,
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  upiId: {
    type: String,
    trim: true,
    match: [/^\S+@\S+$/, 'Please enter a valid UPI ID']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

// Hash password before saving (only for local auth)
userSchema.pre('save', async function(next) {
  // Skip if no password or using Google auth
  if (!this.passwordHash || this.authProvider === 'google') return next();
  if (!this.isModified('passwordHash') || this.passwordHash.startsWith('$2a$')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Remove password from JSON response
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  delete userObject.googleId; // Don't expose Google ID
  return userObject;
};

// Index for Google ID lookup
userSchema.index({ googleId: 1 });

module.exports = mongoose.model('User', userSchema);