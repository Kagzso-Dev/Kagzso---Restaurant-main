const Order        = require('../models/Order');
const Payment      = require('../models/Payment');
const PaymentAudit = require('../models/PaymentAudit');
const Table        = require('../models/Table');
const { createAndEmitNotification } = require('./notificationController');
const logger       = require('../utils/logger');
const { invalidateCache }           = require('../utils/cache');

const rawTableId = (tableId) =>
    tableId && typeof tableId === 'object' ? tableId._id : tableId;

/**
 * @desc    Initiate payment — locks order into payment_pending
 * @route   POST /api/payments/:orderId/initiate
 * @access  Cashier, Admin
 */
const initiatePayment = async (req, res) => {
    const { orderId } = req.params;
    try {
        const preCheck = await Order.findById(orderId);
        if (!preCheck)                           return res.status(404).json({ message: 'Order not found' });
        if (preCheck.paymentStatus === 'paid')   return res.status(400).json({ message: 'Order is already paid' });
        if (preCheck.orderStatus   !== 'ready')  return res.status(400).json({ message: 'Payment not allowed. Kitchen process not completed.' });

        // Atomic: only transition pending → payment_pending
        const order = await Order.atomicPaymentStatusUpdate(orderId, 'pending', 'payment_pending');
        if (!order) {
            const existing = await Order.findById(orderId);
            if (!existing)                                return res.status(404).json({ message: 'Order not found' });
            if (existing.paymentStatus === 'paid')        return res.status(400).json({ message: 'Order is already paid' });
            if (existing.paymentStatus === 'payment_pending') {
                return res.json({ success: true, message: 'Payment already initiated', order: existing });
            }
            return res.status(400).json({ message: 'Cannot initiate payment for this order' });
        }

        req.app.get('socketio').to('restaurant_main').emit('order-updated', order);
        res.json({ success: true, message: 'Payment initiated — order locked', order });

        PaymentAudit.create({
            orderId,
            action:         'PAYMENT_INITIATED',
            status:         'success',
            amount:         order.finalAmount,
            performedBy:    req.userId,
            performedByRole: req.role,
            ipAddress:      req.ip,
            userAgent:      req.get('user-agent'),
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
        const order = await Order.atomicPaymentStatusUpdate(orderId, 'payment_pending', 'pending');
        if (!order) {
            return res.status(400).json({ message: 'No pending payment to cancel' });
        }
        req.app.get('socketio').to('restaurant_main').emit('order-updated', order);
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
    const { orderId }                             = req.params;
    const { paymentMethod, amountReceived, transactionId } = req.body;

    if (!paymentMethod || !['cash', 'qr', 'upi', 'credit_card'].includes(paymentMethod)) {
        return res.status(400).json({ message: 'Invalid payment method' });
    }
    if (['qr', 'upi', 'credit_card'].includes(paymentMethod) &&
        (!transactionId || !transactionId.trim())) {
        return res.status(400).json({
            message: `Transaction ID is required for ${paymentMethod.toUpperCase()} payments`,
        });
    }

    try {
        const order = await Order.findById(orderId);
        if (!order)                              return res.status(404).json({ message: 'Order not found' });
        if (order.paymentStatus === 'paid')      return res.json({ success: true, message: 'Payment already processed', order });
        if (order.orderStatus   !== 'ready')     return res.status(400).json({ message: 'Payment not allowed. Kitchen process not completed.' });
        if (!['pending', 'payment_pending'].includes(order.paymentStatus)) {
            return res.status(400).json({ message: 'Order is not eligible for payment' });
        }

        const orderTotal = order.finalAmount || 0;
        const received   = (amountReceived != null && !isNaN(Number(amountReceived))) ? Number(amountReceived) : 0;

        if (paymentMethod === 'cash' && received < orderTotal) {
            return res.status(400).json({
                message: `Insufficient amount. Received ${received}, required ${orderTotal}`,
            });
        } else if (paymentMethod !== 'cash' && received !== orderTotal) {
            return res.status(400).json({
                message: `Amount mismatch. Paid ${received}, required ${orderTotal}`,
            });
        }

        const existingPayment = await Payment.findByOrderId(orderId);
        if (existingPayment) {
            return res.status(400).json({ message: 'A payment record already exists for this order' });
        }

        const change  = paymentMethod === 'cash'
            ? Math.round((received - orderTotal) * 100) / 100
            : 0;

        const payment = await Payment.create({
            orderId:        order._id,
            paymentMethod,
            transactionId:  transactionId?.trim() || null,
            amount:         orderTotal,
            amountReceived: received,
            change,
            cashierId:      req.userId,
        });

        const updatedOrder = await Order.updateById(orderId, {
            paymentStatus: 'paid',
            paymentMethod,
            orderStatus:   'completed',
            kotStatus:     'Closed',
            paymentAt:     new Date(),
            completedAt:   order.completedAt || new Date(),
        });

        if (order.orderType === 'dine-in' && order.tableId) {
            const tid = rawTableId(order.tableId);
            await Table.updateById(tid, { status: 'cleaning', currentOrderId: null });
            req.app.get('socketio').to('restaurant_main').emit('table-updated', {
                tableId: tid, status: 'cleaning',
            });
        }

        req.app.get('socketio').to('restaurant_main').emit('order-updated',   updatedOrder);
        req.app.get('socketio').to('restaurant_main').emit('order-completed', updatedOrder);
        req.app.get('socketio').to('restaurant_main').emit('payment-success', {
            orderId:       order._id,
            orderNumber:   order.orderNumber,
            paymentMethod,
            amount:        orderTotal,
            change,
        });

        createAndEmitNotification(req.app.get('socketio'), {
            title:         `Payment Received — Order #${order.orderNumber}`,
            message:       `${paymentMethod.toUpperCase()} payment of ${(orderTotal || 0).toFixed(2)} processed`,
            type:          'PAYMENT_SUCCESS',
            roleTarget:    'admin',
            referenceId:   order._id,
            referenceType: 'payment',
            createdBy:     req.userId,
        });

        PaymentAudit.create({
            orderId:        order._id,
            paymentId:      payment._id,
            action:         'PAYMENT_PROCESSED',
            status:         'success',
            amount:         orderTotal,
            paymentMethod,
            transactionId:  payment.transactionId,
            performedBy:    req.userId,
            performedByRole: req.role,
            ipAddress:      req.ip,
            userAgent:      req.get('user-agent'),
            metadata:       { change, orderNumber: order.orderNumber },
        }).catch(e => logger.error('Audit log failed', { error: e.message }));

        logger.info('Payment processed', {
            orderId:      order._id,
            orderNumber:  order.orderNumber,
            amount:       orderTotal,
            paymentMethod,
            cashierId:    req.userId,
        });

        invalidateCache('dashboard');
        invalidateCache('analytics');

        res.json({
            success: true,
            message: 'Payment processed successfully',
            order:   updatedOrder,
            payment: {
                _id:            payment._id,
                paymentMethod:  payment.paymentMethod,
                amount:         payment.amount,
                amountReceived: payment.amountReceived,
                change:         payment.change,
                transactionId:  payment.transactionId,
            },
        });
    } catch (error) {
        PaymentAudit.create({
            orderId:        req.params.orderId,
            action:         'PAYMENT_FAILED',
            status:         'failed',
            errorMessage:   error.message,
            errorCode:      error.code ? String(error.code) : undefined,
            performedBy:    req.userId,
            performedByRole: req.role,
            ipAddress:      req.ip,
        }).catch(e => logger.error('Audit log failed', { error: e.message }));

        // MySQL duplicate entry error (race condition)
        if (error.code === 'ER_DUP_ENTRY') {
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
        const payment = await Payment.findByOrderIdWithCashier(orderId);
        if (!payment) {
            return res.status(404).json({ message: 'No payment record found' });
        }
        res.json(payment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { initiatePayment, cancelPayment, processPayment, getPaymentByOrder };
