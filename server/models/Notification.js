const { pool } = require('../config/db');

/**
 * Notification model — replaces MongoDB Notification collection.
 * The "readBy" array is normalized into a separate `notification_reads` table.
 */
const fmt = (row, userId = null) => row ? {
    _id:           row.id,
    title:         row.title,
    message:       row.message,
    type:          row.type,
    roleTarget:    row.role_target,
    referenceId:   row.reference_id,
    referenceType: row.reference_type,
    // Per-user read status (computed via LEFT JOIN in queries)
    isRead:        userId !== null
        ? (row.is_read_by_me === 1 || row.is_read_by_me === true)
        : (row.is_read === 1 || row.is_read === true),
    createdBy:     row.created_by,
    createdAt:     row.created_at,
} : null;

const Notification = {

    // Check for existing notification of same type+reference (dedup)
    async findExisting(type, referenceId) {
        const [rows] = await pool.query(
            'SELECT id FROM notifications WHERE type = ? AND reference_id = ? LIMIT 1',
            [type, referenceId]
        );
        return rows[0] ? { _id: rows[0].id } : null;
    },

    async create({ title, message, type, roleTarget, referenceId, referenceType, createdBy }) {
        const [result] = await pool.query(
            `INSERT INTO notifications
             (title, message, type, role_target, reference_id, reference_type, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, message, type, roleTarget,
             referenceId  || null,
             referenceType || null,
             createdBy    || null]
        );
        const [rows] = await pool.query(
            'SELECT * FROM notifications WHERE id = ?', [result.insertId]
        );
        return fmt(rows[0]);
    },

    // Fetch notifications visible to this role, with per-user read flag
    async findForUser(userRole, userId, { skip = 0, limit = 20, unreadOnly = false } = {}) {
        let sql = `
            SELECT n.*,
                   CASE WHEN nr.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_read_by_me
            FROM notifications n
            LEFT JOIN notification_reads nr
                   ON n.id = nr.notification_id AND nr.user_id = ?
            WHERE (n.role_target = ? OR n.role_target = 'all')
        `;
        const params = [userId, userRole];
        if (unreadOnly) {
            sql += ' AND nr.user_id IS NULL';
        }
        sql += ' ORDER BY n.created_at DESC';
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(skip)}`;
        const [rows] = await pool.query(sql, params);
        return rows.map(row => fmt(row, userId));
    },

    async countForUser(userRole, userId, unreadOnly = false) {
        let sql = `
            SELECT COUNT(*) AS cnt
            FROM notifications n
            LEFT JOIN notification_reads nr
                   ON n.id = nr.notification_id AND nr.user_id = ?
            WHERE (n.role_target = ? OR n.role_target = 'all')
        `;
        const params = [userId, userRole];
        if (unreadOnly) {
            sql += ' AND nr.user_id IS NULL';
        }
        const [rows] = await pool.query(sql, params);
        return rows[0].cnt;
    },

    // Mark specific notifications as read for a user
    async markAsRead(notificationIds, userId) {
        if (!notificationIds.length) return;
        const values = notificationIds.map(id => [id, userId]);
        await pool.query(
            'INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES ?',
            [values]
        );
    },

    // Mark ALL role-visible notifications as read for a user
    async markAllAsRead(userRole, userId) {
        await pool.query(
            `INSERT IGNORE INTO notification_reads (notification_id, user_id)
             SELECT id, ? FROM notifications
             WHERE (role_target = ? OR role_target = 'all')
               AND id NOT IN (
                   SELECT notification_id FROM notification_reads WHERE user_id = ?
               )`,
            [userId, userRole, userId]
        );
    },
};

module.exports = Notification;
