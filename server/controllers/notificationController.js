const Notification = require('../models/Notification');

// ─── Helper: emit to restaurant-wide room ─────────────────────────────────────
const emitNotification = (io, roleTarget, notification) => {
    io.to('restaurant_main').emit('new-notification', { notification, roleTarget });
};

// ─── Helper: create DB record + emit (called from other controllers) ──────────
const createAndEmitNotification = async (io, data) => {
    try {
        if (data.referenceId) {
            const existing = await Notification.findExisting(data.type, data.referenceId);
            if (existing) return existing;
        }
        const notification = await Notification.create(data);
        emitNotification(io, data.roleTarget, notification);
        return notification;
    } catch (err) {
        console.error('[Notification] Create error:', err.message);
        return null;
    }
};

// @desc    Get notifications for the current user's role
const getNotifications = async (req, res) => {
    try {
        const page      = Math.max(1, parseInt(req.query.page)  || 1);
        const limit     = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip      = (page - 1) * limit;
        const unreadOnly = req.query.unread === 'true';

        const [notifications, total] = await Promise.all([
            Notification.findForUser(req.role, req.userId, { skip, limit, unreadOnly }),
            Notification.countForUser(req.role, req.userId, unreadOnly),
        ]);

        res.json({
            success:    true,
            notifications,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error('[Notification] GET error:', err);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
};

// @desc    Get unread notification count
const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countForUser(req.role, req.userId, true);
        res.json({ success: true, count });
    } catch (err) {
        console.error('[Notification] Unread count error:', err);
        res.status(500).json({ message: 'Failed to get unread count' });
    }
};

// @desc    Mark specific notifications as read
const markAsRead = async (req, res) => {
    try {
        const { notificationIds } = req.body;
        if (!notificationIds || !Array.isArray(notificationIds) || !notificationIds.length) {
            return res.status(400).json({ message: 'notificationIds array is required' });
        }
        await Notification.markAsRead(notificationIds, req.userId);
        req.app.get('socketio').to('restaurant_main').emit('notifications-read', {
            notificationIds,
            userId: req.userId,
            role:   req.role,
        });
        res.json({ success: true, message: 'Notifications marked as read' });
    } catch (err) {
        console.error('[Notification] Mark read error:', err);
        res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
};

// @desc    Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        await Notification.markAllAsRead(req.role, req.userId);
        req.app.get('socketio').to('restaurant_main').emit('notifications-read-all', {
            userId: req.userId,
            role:   req.role,
        });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        console.error('[Notification] Mark all read error:', err);
        res.status(500).json({ message: 'Failed to mark all as read' });
    }
};

// @desc    Create and broadcast an offer announcement
const createOfferNotification = async (req, res) => {
    try {
        const { title, message, roleTarget } = req.body;
        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required' });
        }
        const validTargets = ['kitchen', 'admin', 'waiter', 'cashier', 'all'];
        const target       = validTargets.includes(roleTarget) ? roleTarget : 'all';

        const notification = await Notification.create({
            title:      title.trim(),
            message:    message.trim(),
            type:       'OFFER_ANNOUNCEMENT',
            roleTarget: target,
            createdBy:  req.userId,
        });

        emitNotification(req.app.get('socketio'), target, notification);

        res.status(201).json({
            success:      true,
            message:      'Offer notification sent',
            notification,
        });
    } catch (err) {
        console.error('[Notification] Offer create error:', err);
        res.status(500).json({ message: 'Failed to create offer notification' });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    createOfferNotification,
    createAndEmitNotification,
    emitNotification,
};
