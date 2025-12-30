const mongoose = require('mongoose');

const customDesignSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String },
  frame: { type: String },
  imgSrc: { type: String, required: true },
  transform: {
    x: Number,
    y: Number,
    scale: Number
  },
  meta: { type: Object },
  notes: { type: String },
}, { timestamps: true });

customDesignSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('CustomDesign', customDesignSchema);
