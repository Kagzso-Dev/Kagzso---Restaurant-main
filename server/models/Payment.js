const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'qr', 'upi', 'credit_card'],
        required: true,
    },
    transactionId: {
        type: String,
        default: null,
        trim: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    amountReceived: {
        type: Number,
        default: 0,
        min: 0,
    },
    change: {
        type: Number,
        default: 0,
        min: 0,
    },
    cashierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
}, { timestamps: true });

// Prevent duplicate payments per order
paymentSchema.index({ orderId: 1 }, { unique: true });

// Fast lookups for analytics
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ paymentMethod: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

