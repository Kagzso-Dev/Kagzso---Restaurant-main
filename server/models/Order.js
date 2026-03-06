const mongoose = require('mongoose');
const Counter = require('./Counter');

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String },
    tokenNumber: { type: Number, index: true },
    orderType: { type: String, enum: ['dine-in', 'takeaway'], required: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
    customerInfo: {
        name: { type: String },
        phone: { type: String },
    },
    items: [
        {
            menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true, default: 1 },
            notes: { type: String },
            status: {
                type: String,
                enum: ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'],
                default: 'PENDING'
            },
            cancelledBy: { type: String, enum: ['WAITER', 'KITCHEN'] },
            cancelReason: { type: String },
            cancelledAt: { type: Date }
        }
    ],
    orderStatus: {
        type: String,
        enum: ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'],
        default: 'pending',
        index: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'payment_pending', 'paid'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'qr', 'upi', 'credit_card'],
        default: null,
    },
    kotStatus: {
        type: String,
        enum: ['Open', 'Closed'],
        default: 'Open',
        index: true
    },
    totalAmount: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },

    // Analytics Tracking Fields
    waiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    prepStartedAt: { type: Date },
    readyAt: { type: Date },
    completedAt: { type: Date },
    paymentAt: { type: Date },
    paidAt: { type: Date },

    cancelledBy: { type: String, enum: ['WAITER', 'KITCHEN', 'ADMIN'] },
    cancelReason: { type: String },
}, { timestamps: true });

// Core indexes for POS performance
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ tableId: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ waiterId: 1, createdAt: -1 });

// Kitchen: fast open KOT lookup
orderSchema.index({ kotStatus: 1 });
// Search: fast lookup by orderNumber
orderSchema.index({ orderNumber: 1 });
// Search: text index for order number + customer name
orderSchema.index({ orderNumber: 'text', 'customerInfo.name': 'text' });
// Revenue aggregation
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

// Auto-increment Token Number
orderSchema.pre('save', async function () {
    if (!this.isNew) return;

    try {
        const counterKey = 'tokenNumber_global';
        const counter = await Counter.findOneAndUpdate(
            { _id: counterKey },
            { $inc: { sequence_value: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.tokenNumber = counter.sequence_value;
        this.orderNumber = `ORD-${counter.sequence_value}`;
    } catch (error) {
        throw error;
    }
});

module.exports = mongoose.model('Order', orderSchema);

