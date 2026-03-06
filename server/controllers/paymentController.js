const Order = require('../models/Order');
const Payment = require('../models/Payment');
const PaymentAudit = require('../models/PaymentAudit');
const Table = require('../models/Table');
const mongoose = require('mongoose');
const { createAndEmitNotification } = require('./notificationController');
const logger = require('../utils/logger');
const { invalidateCache } = require('../utils/cache');

/**
 * @desc    Initiate payment — locks order into PAYMENT_PENDING
 * @route   POST /api/payments/:orderId/initiate
 * @access  Cashier, Admin
 */
const initiatePayment = async (req, res) => {
    const { orderId } = req.params;

    try {
        // ── Kitchen-completion gate: block payment unless order is ready ──
        const preCheck = await Order.findOne({
            _id: orderId,
        });

        if (!preCheck) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (preCheck.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'Order is already paid' });
        }
        if (preCheck.orderStatus !== 'ready') {
            return res.status(400).json({
                message: 'Payment not allowed. Kitchen process not completed.',
            });
        }

        // Atomic update: only transition from pending → payment_pending
        const order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                paymentStatus: 'pending', // Only if not already in payment flow
            },
            { $set: { paymentStatus: 'payment_pending' } },
            { new: true }
        ).populate('tableId', 'number');

        if (!order) {
            // Check if order exists at all
            const existing = await Order.findOne({
                _id: orderId,
            });

            if (!existing) {
                return res.status(404).json({ message: 'Order not found' });
            }
            if (existing.paymentStatus === 'paid') {
                return res.status(400).json({ message: 'Order is already paid' });
            }
            if (existing.paymentStatus === 'payment_pending') {
                // Already in payment flow — allow the cashier to proceed
                return res.json({
                    success: true,
                    message: 'Payment already initiated',
                    order: existing,
                });
            }
            return res.status(400).json({ message: 'Cannot initiate payment for this order' });
        }

        // Emit real-time update
        const room = 'restaurant_main';
        req.app.get('socketio').to(room).emit('order-updated', order);

        res.json({
            success: true,
            message: 'Payment initiated — order locked',
            order,
        });

        // ── Audit: PAYMENT_INITIATED ──
        PaymentAudit.create({
            orderId,
            action: 'PAYMENT_INITIATED',
            status: 'success',
            amount: order.finalAmount,
            performedBy: req.userId,
            performedByRole: req.role,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        }).catch(e => logger.error('Audit log failed', { error: e.message }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Cancel initiated payment — reverts order to pending
 * @route   POST /api/payments/:orderId/cancel
 * @access  Cashier, Admin
 */
const cancelPayment = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: orderId,
                paymentStatus: 'payment_pending',
            },
            { $set: { paymentStatus: 'pending' } },
            { new: true }
        );

        if (!order) {
            return res.status(400).json({ message: 'No pending payment to cancel' });
        }

        const room = 'restaurant_main';
        req.app.get('socketio').to(room).emit('order-updated', order);

        // ── Cache: Invalidate dashboard/analytics ──
        invalidateCache('dashboard');
        invalidateCache('analytics');

        res.json({ success: true, message: 'Payment cancelled', order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Process payment (Cash / QR / UPI / Credit Card)
 * @route   POST /api/payments/:orderId/process
 * @access  Cashier, Admin
 */
const processPayment = async (req, res) => {
    const { orderId } = req.params;
    const { paymentMethod, amountReceived, transactionId } = req.body;

    // ── Input Validation ──────────────────────────────────────────
    if (!paymentMethod || !['cash', 'qr', 'upi', 'credit_card'].includes(paymentMethod)) {
        return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Transaction ID required for non-cash methods
    if (['qr', 'upi', 'credit_card'].includes(paymentMethod)) {
        if (!transactionId || !transactionId.trim()) {
            return res.status(400).json({
                message: `Transaction ID is required for ${paymentMethod.toUpperCase()} payments`,
            });
        }
    }

    try {
        // ── Fetch & Validate Order ────────────────────────────────
        const order = await Order.findOne({
            _id: orderId,
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Prevent double payment
        if (order.paymentStatus === 'paid') {
            return res.json({
                success: true,
                message: 'Payment already processed',
                order,
            });
        }

        // ── Kitchen-completion gate: block unless order is ready ──
        if (order.orderStatus !== 'ready') {
            return res.status(400).json({
                message: 'Payment not allowed. Kitchen process not completed.',
            });
        }

        // Order must be in payment_pending or pending state
        if (!['pending', 'payment_pending'].includes(order.paymentStatus)) {
            return res.status(400).json({ message: 'Order is not eligible for payment' });
        }

        const orderTotal = order.finalAmount;

        // ── Amount Validation (Server-side — don't trust frontend) ─
        const received = Number(amountReceived) || 0;

        if (paymentMethod === 'cash') {
            if (received < orderTotal) {
                return res.status(400).json({
                    message: `Insufficient amount. Received ₹${received}, required ₹${orderTotal}`,
                });
            }
        } else {
            // QR / UPI / Credit Card — must match exactly
            if (received !== orderTotal) {
                return res.status(400).json({
                    message: `Amount mismatch. Paid ₹${received}, required ₹${orderTotal}`,
                });
            }
        }

        // ── Check for duplicate payment record ────────────────────
        const existingPayment = await Payment.findOne({ orderId: order._id });
        if (existingPayment) {
            return res.status(400).json({
                message: 'A payment record already exists for this order',
            });
        }

        // ── Create Payment Record ─────────────────────────────────
        const change = paymentMethod === 'cash' ? Math.round((received - orderTotal) * 100) / 100 : 0;

        const payment = await Payment.create({
            orderId: order._id,
            paymentMethod,
            transactionId: transactionId?.trim() || null,
            amount: orderTotal,
            amountReceived: received,
            change,
            cashierId: req.userId,
        });

        // ── Update Order Status ───────────────────────────────────
        order.paymentStatus = 'paid';
        order.paymentMethod = paymentMethod;
        order.orderStatus = 'completed';
        order.kotStatus = 'Closed';
        order.paymentAt = new Date();
        order.completedAt = order.completedAt || new Date();

        await order.save();

        // ── Table Lifecycle: occupied → cleaning ──────────────────
        if (order.orderType === 'dine-in' && order.tableId) {
            const table = await Table.findOne({
                _id: order.tableId,
            });
            if (table) {
                table.status = 'cleaning';
                table.currentOrderId = null;
                await table.save();
                req.app.get('socketio').to('restaurant_main').emit('table-updated', {
                    tableId: table._id,
                    status: 'cleaning',
                });
            }
        }

        // ── Real-time Events ──────────────────────────────────────
        const room = 'restaurant_main';
        req.app.get('socketio').to(room).emit('order-updated', order);
        req.app.get('socketio').to(room).emit('order-completed', order);
        req.app.get('socketio').to(room).emit('payment-success', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            paymentMethod,
            amount: orderTotal,
            change,
        });

        // ── Auto-notify admin: PAYMENT_SUCCESS ──
        createAndEmitNotification(req.app.get('socketio'), {
            title: `Payment Received — Order #${order.orderNumber}`,
            message: `${paymentMethod.toUpperCase()} payment of ₹${orderTotal.toFixed(2)} processed`,
            type: 'PAYMENT_SUCCESS',
            roleTarget: 'admin',
            referenceId: order._id,
            referenceType: 'payment',
            createdBy: req.userId,
        });

        // ── Audit: PAYMENT_PROCESSED ──
        PaymentAudit.create({
            orderId: order._id,
            paymentId: payment._id,
            action: 'PAYMENT_PROCESSED',
            status: 'success',
            amount: orderTotal,
            paymentMethod,
            transactionId: payment.transactionId,
            performedBy: req.userId,
            performedByRole: req.role,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: {
                change,
                orderNumber: order.orderNumber,
            },
        }).catch(e => logger.error('Audit log failed', { error: e.message }));

        logger.info('Payment processed', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            amount: orderTotal,
            paymentMethod,
            cashierId: req.userId,
        });

        // ── Cache: Invalidate dashboard/analytics ──
        invalidateCache('dashboard');
        invalidateCache('analytics');

        res.json({
            success: true,
            message: 'Payment processed successfully',
            order,
            payment: {
                _id: payment._id,
                paymentMethod: payment.paymentMethod,
                amount: payment.amount,
                amountReceived: payment.amountReceived,
                change: payment.change,
                transactionId: payment.transactionId,
            },
        });
    } catch (error) {
        // ── Audit: PAYMENT_FAILED ──
        PaymentAudit.create({
            orderId: req.params.orderId,
            action: 'PAYMENT_FAILED',
            status: 'failed',
            errorMessage: error.message,
            errorCode: error.code ? String(error.code) : undefined,
            performedBy: req.userId,
            performedByRole: req.role,
            ipAddress: req.ip,
        }).catch(e => logger.error('Audit log failed', { error: e.message }));

        // Handle MongoDB duplicate key error (race condition safety net)
        if (error.code === 11000) {
            return res.status(400).json({
                message: 'Duplicate payment detected. This order may already be paid.',
            });
        }
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get payment details for an order
 * @route   GET /api/payments/:orderId
 * @access  Cashier, Admin
 */
const getPaymentByOrder = async (req, res) => {
    const { orderId } = req.params;

    try {
        const payment = await Payment.findOne({
            orderId,
        }).populate('cashierId', 'username role');

        if (!payment) {
            return res.status(404).json({ message: 'No payment record found' });
        }

        res.json(payment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    initiatePayment,
    cancelPayment,
    processPayment,
    getPaymentByOrder,
};
