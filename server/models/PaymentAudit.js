const mongoose = require('mongoose');

const paymentAuditSchema = new mongoose.Schema({
    // ── Reference ────────────────────────────────────────────────────────────
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        index: true,
    },
    // ── Event Details ────────────────────────────────────────────────────────
    action: {
        type: String,
        enum: [
            'PAYMENT_INITIATED',
            'PAYMENT_PROCESSED',
            'PAYMENT_FAILED',
            'PAYMENT_CANCELLED',
            'PAYMENT_REFUNDED',
            'PAYMENT_VERIFIED',          // webhook/callback verified
            'STATUS_CHANGE',
        ],
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        required: true,
    },
    // ── Financial Data ───────────────────────────────────────────────────────
    amount: { type: Number },
    paymentMethod: { type: String },
    transactionId: { type: String },
    // ── Context ──────────────────────────────────────────────────────────────
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    performedByRole: {
        type: String,
        enum: ['cashier', 'admin'],
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    // ── Error Tracking ───────────────────────────────────────────────────────
    errorMessage: { type: String },
    errorCode: { type: String },
    // ── Metadata ─────────────────────────────────────────────────────────────
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
    timestamps: true,
    // Append-only: prevent updates and deletes for audit integrity
    strict: true,
});

// ── Indexes for audit queries ────────────────────────────────────────────────
paymentAuditSchema.index({ action: 1, createdAt: -1 });
paymentAuditSchema.index({ orderId: 1, createdAt: -1 });
paymentAuditSchema.index({ performedBy: 1, createdAt: -1 });

// ── TTL: keep audit logs for 2 years ─────────────────────────────────────────
paymentAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

module.exports = mongoose.model('PaymentAudit', paymentAuditSchema);

