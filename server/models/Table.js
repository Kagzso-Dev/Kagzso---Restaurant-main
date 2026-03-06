const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    number: { type: Number, required: true },
    capacity: { type: Number, required: true },
    status: {
        type: String,
        enum: ['available', 'reserved', 'occupied', 'billing', 'cleaning'],
        default: 'available',
        index: true,
    },
    currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reservedAt: { type: Date, default: null },
    reservedAt: { type: Date, default: null },
}, { timestamps: true });

// Table number unique
tableSchema.index({ number: 1 }, { unique: true });
// Fast lookup for auto-release query
tableSchema.index({ status: 1, reservedAt: 1 });

module.exports = mongoose.model('Table', tableSchema);

