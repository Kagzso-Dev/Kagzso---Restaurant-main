const Order  = require('../models/Order');
const Table  = require('../models/Table');
const { createAndEmitNotification } = require('./notificationController');
const { invalidateCache }           = require('../utils/cache');

// Helper: extract raw table ID from either the populated object or plain value
const rawTableId = (tableId) =>
    tableId && typeof tableId === 'object' ? tableId._id : tableId;

// @desc    Get all orders (filtered by role/status/kotStatus)
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 50, kotStatus, status } = req.query;
        const filter = {};

        if (kotStatus) {
            filter.kotStatus = kotStatus === 'Open' ? { $ne: 'Closed' } : kotStatus;
        }
        if (status) {
            filter.orderStatus = status;
        }
        // Kitchen only sees active orders by default
        if (req.role === 'kitchen' && !kotStatus) {
            filter.orderStatus = { $in: ['pending', 'accepted', 'preparing', 'ready'] };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [orders, total] = await Promise.all([
            Order.find(filter, { skip, limit: parseInt(limit) }),
            Order.count(filter),
        ]);

        res.json({
            orders,
            pagination: {
                total,
                page:  parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (Waiter, Cashier, Admin)
const createOrder = async (req, res) => {
    const { orderType, tableId, customerInfo, items, totalAmount, tax, discount, finalAmount } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No order items' });
    }

    try {
        // Validate table availability before creating order
        if (orderType === 'dine-in' && tableId) {
            const table = await Table.findById(tableId);
            if (!table) {
                return res.status(404).json({ message: 'Table not found' });
            }
            if (!['available', 'reserved'].includes(table.status)) {
                return res.status(400).json({
                    message: `Table is currently "${table.status}" and cannot be booked`,
                });
            }
        }

        const createdOrder = await Order.create({
            orderType, tableId, customerInfo, items,
            totalAmount, tax, discount, finalAmount,
            waiterId: req.userId,
        });

        // Transition table → occupied
        if (orderType === 'dine-in' && tableId) {
            await Table.updateById(tableId, {
                status:         'occupied',
                currentOrderId: createdOrder._id,
                reservedAt:     null,
            });
            const table = await Table.findById(tableId);
            req.app.get('socketio').to('restaurant_main').emit('table-updated', {
                tableId:  table._id,
                status:   'occupied',
                lockedBy: table.lockedBy,
            });
        }

        req.app.get('socketio').to('restaurant_main').emit('new-order', createdOrder);

        createAndEmitNotification(req.app.get('socketio'), {
            title:         `New Order #${createdOrder.orderNumber}`,
            message:       `${createdOrder.items.length} item(s) — ${createdOrder.orderType === 'dine-in' ? 'Dine-In' : 'Takeaway'}`,
            type:          'NEW_ORDER',
            roleTarget:    'kitchen',
            referenceId:   createdOrder._id,
            referenceType: 'order',
            createdBy:     req.userId,
        });

        invalidateCache('dashboard');
        invalidateCache('analytics');
        res.status(201).json(createdOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Kitchen, Admin, Cashier)
const updateOrderStatus = async (req, res) => {
    const { status } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (req.role === 'kitchen' && status === 'completed') {
            return res.status(403).json({ message: 'Kitchen cannot mark orders as completed' });
        }
        if (status === 'cancelled' &&
            ['preparing', 'ready'].includes(order.orderStatus) &&
            req.role !== 'admin') {
            return res.status(403).json({ message: 'Only admin can cancel after preparation starts' });
        }

        const updates = { orderStatus: status };
        if (status === 'completed' && order.paymentStatus === 'paid') updates.kotStatus = 'Closed';
        if (status === 'preparing' && !order.prepStartedAt) updates.prepStartedAt = new Date();
        if (status === 'ready'     && !order.readyAt)       updates.readyAt       = new Date();
        if (status === 'completed' && !order.completedAt)   updates.completedAt   = new Date();

        const updatedOrder = await Order.updateById(req.params.id, updates);

        // Table lifecycle: completed + paid → cleaning
        if (status === 'completed' &&
            order.paymentStatus === 'paid' &&
            order.orderType === 'dine-in' &&
            order.tableId) {
            const tid = rawTableId(order.tableId);
            await Table.updateById(tid, { status: 'cleaning', currentOrderId: null });
            req.app.get('socketio').to('restaurant_main').emit('table-updated', {
                tableId: tid, status: 'cleaning',
            });
        }

        req.app.get('socketio').to('restaurant_main').emit('order-updated', updatedOrder);

        if (status === 'ready') {
            createAndEmitNotification(req.app.get('socketio'), {
                title:         `Order #${order.orderNumber} Ready`,
                message:       'Order is ready for pickup/serving',
                type:          'ORDER_READY',
                roleTarget:    'waiter',
                referenceId:   order._id,
                referenceType: 'order',
                createdBy:     req.userId,
            });
        }

        invalidateCache('dashboard');
        invalidateCache('analytics');
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update individual item status
// @route   PUT /api/orders/:id/items/:itemId/status
// @access  Private (Kitchen, Admin)
const updateItemStatus = async (req, res) => {
    const { status }        = req.body;
    const { id, itemId }    = req.params;
    try {
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const item = await Order.getItemById(id, itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        if (item.status === 'CANCELLED') {
            return res.status(400).json({ message: 'Cannot update status of a cancelled item' });
        }

        const updatedOrder = await Order.updateItemStatus(id, itemId, status);
        req.app.get('socketio').to('restaurant_main').emit('itemUpdated',    updatedOrder);
        req.app.get('socketio').to('restaurant_main').emit('order-updated',  updatedOrder);

        invalidateCache('dashboard');
        invalidateCache('analytics');
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Quick payment (inline, without full payment controller flow)
// @route   PUT /api/orders/:id/payment
// @access  Private (Cashier, Admin)
const processPayment = async (req, res) => {
    const { paymentMethod, amountPaid } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.paymentStatus === 'paid') {
            return res.json({ success: true, message: 'Payment already processed', order });
        }
        if (order.orderStatus !== 'ready') {
            return res.status(400).json({
                message: 'Payment not allowed. Kitchen process not completed.',
            });
        }

        const updatedOrder = await Order.updateById(req.params.id, {
            paymentStatus: 'paid',
            paymentMethod: paymentMethod || 'cash',
            orderStatus:   'completed',
            kotStatus:     'Closed',
            paymentAt:     new Date(),
            paidAt:        new Date(),
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

        res.json({ success: true, message: 'Payment successful & token closed', order: updatedOrder });

        invalidateCache('dashboard');
        invalidateCache('analytics');
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel entire order
// @route   PUT /api/orders/:id/cancel
// @access  Private (Waiter, Kitchen, Admin)
const cancelOrder = async (req, res) => {
    const { reason } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (['completed', 'cancelled'].includes(order.orderStatus)) {
            return res.status(400).json({
                message: `Cannot cancel an order that is already ${order.orderStatus}`,
            });
        }

        // Role-based cancellation rules
        if (req.role === 'waiter') {
            if (order.orderStatus !== 'pending') {
                return res.status(403).json({ message: 'Waiters can only cancel pending orders' });
            }
        } else if (req.role === 'kitchen') {
            if (!['pending', 'accepted', 'preparing'].includes(order.orderStatus)) {
                return res.status(403).json({
                    message: 'Kitchen can only cancel orders that are pending or being prepared',
                });
            }
        } else if (!['waiter', 'kitchen', 'admin'].includes(req.role)) {
            return res.status(403).json({ message: 'Your role is not authorized to cancel orders' });
        }

        const updatedOrder = await Order.updateById(req.params.id, {
            orderStatus:  'cancelled',
            kotStatus:    'Closed',
            cancelledBy:  req.role.toUpperCase(),
            cancelReason: reason || 'No reason provided',
        });

        if (order.orderType === 'dine-in' && order.tableId) {
            const tid = rawTableId(order.tableId);
            await Table.updateById(tid, { status: 'available', currentOrderId: null });
            req.app.get('socketio').to('restaurant_main').emit('table-updated', {
                tableId: tid, status: 'available',
            });
        }

        req.app.get('socketio').to('restaurant_main').emit('orderCancelled', updatedOrder);
        req.app.get('socketio').to('restaurant_main').emit('order-updated',  updatedOrder);

        invalidateCache('dashboard');
        invalidateCache('analytics');
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel individual item from order
// @route   PUT /api/orders/:orderId/items/:itemId/cancel
// @access  Private (Waiter, Kitchen)
const cancelOrderItem = async (req, res) => {
    const { id: orderId, itemId } = req.params;
    const { reason }              = req.body;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const item = await Order.getItemById(orderId, itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const currentStatus = item.status?.toUpperCase();
        if (currentStatus === 'CANCELLED') {
            return res.status(400).json({ message: 'Item is already cancelled' });
        }
        if (req.role === 'waiter' && ['PREPARING', 'READY'].includes(currentStatus)) {
            return res.status(403).json({
                message: 'Waiters cannot cancel items that are preparing or ready',
            });
        }

        // Cancel the item
        let updatedOrder = await Order.cancelItem(orderId, itemId, {
            cancelledBy:  req.role.toUpperCase(),
            cancelReason: reason || 'Item cancelled',
        });

        // Recalculate order totals from remaining active items
        const activeItems    = updatedOrder.items.filter(i => i.status !== 'CANCELLED');
        const newTotalAmount = activeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

        let newTax = 0;
        if (order.totalAmount > 0) {
            const taxRate = order.tax / order.totalAmount;
            newTax = Math.round(newTotalAmount * taxRate * 100) / 100;
        }
        const newFinalAmount = newTotalAmount + newTax - order.discount;

        const orderUpdates = { totalAmount: newTotalAmount, tax: newTax, finalAmount: newFinalAmount };

        if (activeItems.length === 0) {
            orderUpdates.orderStatus = 'cancelled';
            orderUpdates.kotStatus   = 'Closed';
        }

        updatedOrder = await Order.updateById(orderId, orderUpdates);

        if (activeItems.length === 0 && order.orderType === 'dine-in' && order.tableId) {
            const tid = rawTableId(order.tableId);
            await Table.updateById(tid, { status: 'available', currentOrderId: null });
            req.app.get('socketio').to('restaurant_main').emit('table-updated', {
                tableId: tid, status: 'available',
            });
        }

        req.app.get('socketio').to('restaurant_main').emit('itemUpdated',   updatedOrder);
        req.app.get('socketio').to('restaurant_main').emit('order-updated', updatedOrder);
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Search orders by orderNumber, customerName, or tableNumber
// @route   GET /api/orders/search?q=<query>
// @access  Private (admin, cashier, waiter)
const searchOrders = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.json({ orders: [] });
        const orders = await Order.search(q);
        res.json({ orders });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createOrder,
    getOrders,
    searchOrders,
    updateOrderStatus,
    updateItemStatus,
    processPayment,
    cancelOrder,
    cancelOrderItem,
};
