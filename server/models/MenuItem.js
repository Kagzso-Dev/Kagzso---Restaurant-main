const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    image: { type: String },
    availability: { type: Boolean, default: true },
    isVeg: { type: Boolean, default: true },
}, { timestamps: true });

// Index for menu queries
menuItemSchema.index({ availability: 1, category: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);

