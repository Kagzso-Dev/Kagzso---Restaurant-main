const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    searchOrders,
    updateOrderStatus,
    updateItemStatus,
    processPayment,
    cancelOrder,
    cancelOrderItem,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All order routes require valid JWT
router.use(protect);

// ── Search (must be BEFORE /:id to avoid "search" being treated as an ID) ───
router.get('/search', authorize('admin', 'cashier', 'waiter'), searchOrders);

router.route('/')
    .post(authorize('waiter', 'admin', 'cashier'), createOrder)
    .get(authorize('kitchen', 'cashier', 'admin', 'waiter'), getOrders);

router.route('/:id/status')
    .put(authorize('kitchen', 'admin', 'cashier'), updateOrderStatus);

router.route('/:id/cancel')
    .put(authorize('waiter', 'kitchen', 'admin'), cancelOrder);

router.route('/:id/items/:itemId/status')
    .put(authorize('kitchen', 'admin'), updateItemStatus);

router.route('/:id/items/:itemId/cancel')
    .put(authorize('waiter', 'kitchen', 'admin'), cancelOrderItem);

router.route('/:id/payment')
    .put(authorize('cashier', 'admin'), processPayment);

module.exports = router;
