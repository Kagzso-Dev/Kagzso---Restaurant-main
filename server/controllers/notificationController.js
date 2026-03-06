const Notification = require('../models/Notification');

// ─── Helper: emit notification to role-specific room ──────────────────────────
const emitNotification = (io, roleTarget, notification) => {
    const room = 'restaurant_main';
    io.to(room).emit('new-notification', {
        notification,
        roleTarget,
    });
};

// ─── Helper: create + emit a notification ─────────────────────────────────────
const createAndEmitNotification = async (io, data) => {
    try {
        if (data.referenceId) {
            const existing = await Notification.findOne({
                type: data.type,
                referenceId: data.referenceId,
            });
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

/**
 * @desc    Get notifications
 */
const getNotifications = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const unreadOnly = req.query.unread === 'true';

        const userRole = req.role;
        const userId = req.userId;

        const filter = {
            $or: [
                { roleTarget: userRole },
                { roleTarget: 'all' },
            ],
        };

        if (unreadOnly) {
            filter['readBy.userId'] = { $ne: userId };
        }

        const [notifications, total] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter),
        ]);

        const enriched = notifications.map(n => ({
            ...n,
            isRead: n.readBy?.some(r => r.userId?.toString() === userId) || false,
        }));

        res.json({
            success: true,
            notifications: enriched,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error('[Notification] GET error:', err);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
};

/**
 * @desc    Get unread count
 */
const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            $or: [
                { roleTarget: req.role },
                { roleTarget: 'all' },
            ],
            'readBy.userId': { $ne: req.userId },
        });

        res.json({ success: true, count });
    } catch (err) {
        console.error('[Notification] Unread count error:', err);
        res.status(500).json({ message: 'Failed to get unread count' });
    }
};

/**
 * @desc    Mark read
 */
const markAsRead = async (req, res) => {
    try {
        const { notificationIds } = req.body;

        if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
            return res.status(400).json({ message: 'notificationIds array is required' });
        }

        await Notification.updateMany(
            {
                _id: { $in: notificationIds },
                'readBy.userId': { $ne: req.userId },
            },
            {
                $addToSet: {
                    readBy: { userId: req.userId, readAt: new Date() },
                },
            }
        );

        const room = 'restaurant_main';
        req.app.get('socketio').to(room).emit('notifications-read', {
            notificationIds,
            userId: req.userId,
            role: req.role,
        });

        res.json({ success: true, message: 'Notifications marked as read' });
    } catch (err) {
        console.error('[Notification] Mark read error:', err);
        res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
};

/**
 * @desc    Mark all read
 */
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                $or: [
                    { roleTarget: req.role },
                    { roleTarget: 'all' },
                ],
                'readBy.userId': { $ne: req.userId },
            },
            {
                $addToSet: {
                    readBy: { userId: req.userId, readAt: new Date() },
                },
            }
        );

        const room = 'restaurant_main';
        req.app.get('socketio').to(room).emit('notifications-read-all', {
            userId: req.userId,
            role: req.role,
        });

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        console.error('[Notification] Mark all read error:', err);
        res.status(500).json({ message: 'Failed to mark all as read' });
    }
};

/**
 * @desc    Create offer notification
 */
const createOfferNotification = async (req, res) => {
    try {
        const { title, message, roleTarget } = req.body;

        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required' });
        }

        const validTargets = ['kitchen', 'admin', 'waiter', 'cashier', 'all'];
        const target = validTargets.includes(roleTarget) ? roleTarget : 'all';

        const notification = await Notification.create({
            title: title.trim(),
            message: message.trim(),
            type: 'OFFER_ANNOUNCEMENT',
            roleTarget: target,
            createdBy: req.userId,
        });

        const io = req.app.get('socketio');
        emitNotification(io, target, notification);

        res.status(201).json({
            success: true,
            message: 'Offer notification sent',
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
