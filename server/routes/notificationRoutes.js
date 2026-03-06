const express = require('express');
const router = express.Router();
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    createOfferNotification,
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All notification routes require authentication
router.use(protect);

// ── Read routes (all roles) ──────────────────────────────────────────────────
router.get('/', authorize('admin', 'waiter', 'kitchen', 'cashier'), getNotifications);
router.get('/unread-count', authorize('admin', 'waiter', 'kitchen', 'cashier'), getUnreadCount);

// ── Write routes ─────────────────────────────────────────────────────────────
router.put('/read', authorize('admin', 'waiter', 'kitchen', 'cashier'), markAsRead);
router.put('/read-all', authorize('admin', 'waiter', 'kitchen', 'cashier'), markAllAsRead);

// ── Admin-only: offer/announcement ─────────────────────────────────────────
router.post('/offer', authorize('admin'), createOfferNotification);

module.exports = router;
