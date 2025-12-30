const mongoose = require('mongoose');

const ThemeCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    minlength: 2,
    maxlength: 160,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 600,
  },
  accentColor: {
    type: String,
    trim: true,
    maxlength: 16,
  },
  textColor: {
    type: String,
    trim: true,
    maxlength: 16,
  },
  coverImage: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ThemeCategory', ThemeCategorySchema);
