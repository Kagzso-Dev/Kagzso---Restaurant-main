const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String },
    color: { type: String, default: '#f97316' }, // Default brand orange
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

// Unique category name
categorySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);

