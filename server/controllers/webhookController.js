/**
 * ─── Payment Webhook Controller ──────────────────────────────────────────────
 * Handles asynchronous payment confirmations from gateways (Razorpay, Stripe, etc).
 */
const Order        = require('../models/Order');
const Payment      = require('../models/Payment');
const PaymentAudit = require('../models/PaymentAudit');
const logger       = require('../utils/logger');
const { invalidateCache } = require('../utils/cache');
const crypto       = require('crypto');

const handleRazorpayWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Signature verification
    if (secret) {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');
        if (signature !== expectedSignature) {
            logger.warn('Invalid webhook signature detected', { signature, ip: req.ip });
            return res.status(400).json({ status: 'invalid_signature' });
        }
    }

    const { event, payload } = req.body;
    logger.info(`Payment webhook received: ${event}`, { event });

    try {
        if (event === 'payment.captured') {
            const paymentEntity = payload.payment.entity;
            const orderId       = paymentEntity.notes.orderId;

            const order = await Order.findById(orderId);
            if (!order) {
                logger.error('Order not found for webhook', { orderId });
                return res.status(200).json({ status: 'order_not_found' });
            }
            if (order.paymentStatus === 'paid') {
                return res.status(200).json({ status: 'already_processed' });
            }

            await Order.updateById(orderId, {
                paymentStatus: 'paid',
                orderStatus:   'completed',
                paymentAt:     new Date(),
            });

            await Payment.create({
                orderId:        order._id,
                paymentMethod:  'online',
                transactionId:  paymentEntity.id,
                amount:         paymentEntity.amount / 100,
                amountReceived: paymentEntity.amount / 100,
                cashierId:      null,
            });

            await PaymentAudit.create({
                orderId:     order._id,
                action:      'PAYMENT_VERIFIED',
                status:      'success',
                amount:      paymentEntity.amount / 100,
                performedBy: order.waiterId,
                metadata:    { gateway: 'razorpay', event },
            });

            invalidateCache('dashboard');
            invalidateCache('analytics');

            const updatedOrder = await Order.findById(orderId);
            const io = req.app.get('socketio');
            if (io) {
                io.to('restaurant_main').emit('order-updated',   updatedOrder);
                io.to('restaurant_main').emit('payment-success', { orderId: order._id });
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (err) {
        logger.error('Webhook processing failed', { error: err.message });
        res.status(500).json({ status: 'error' });
    }
};

module.exports = { handleRazorpayWebhook };
