const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
    },
    type: {
        type: String,
        enum: [
            'NEW_ORDER',
            'ORDER_READY',
            'PAYMENT_SUCCESS',
            'ORDER_CANCELLED',
            'OFFER_ANNOUNCEMENT',
            'SYSTEM_ALERT',
        ],
        required: true,
        index: true,
    },
    roleTarget: {
        type: String,
        enum: ['kitchen', 'admin', 'waiter', 'cashier', 'all'],
        required: true,
        index: true,
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    referenceType: {
        type: String,
        enum: ['order', 'payment', 'offer', null],
        default: null,
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true,
    },
    readBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

// ── Performance Indexes ─────────────────────────────────────────────────────
// Primary query: fetch unread notifications for a specific role
notificationSchema.index({ roleTarget: 1, createdAt: -1 });
// Unread count query
notificationSchema.index({ roleTarget: 1, isRead: 1 });
// Cleanup: auto-expire old notifications after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
// Prevent duplicate notifications for the same reference
notificationSchema.index({ type: 1, referenceId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

