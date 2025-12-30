const mongoose = require('mongoose');

const CollectionImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true,
  },
  publicId: {
    type: String,
    trim: true,
  },
  caption: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  sortOrder: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { _id: true, timestamps: true });

const CollectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 140,
  },
  handle: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    minlength: 1,
    maxlength: 80,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 600,
  },
  tagline: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  accentColor: {
    type: String,
    trim: true,
    maxlength: 20,
  },
  heroImage: {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
    min: 0,
  },
  images: [CollectionImageSchema],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Collection', CollectionSchema);
