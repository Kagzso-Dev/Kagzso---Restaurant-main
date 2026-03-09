const { pool } = require('../config/db');

/**
 * @desc    Calculate revenue growth (today vs yesterday)
 * @route   GET /api/dashboard/growth
 * @access  Private (admin only)
 */
const getGrowth = async (req, res) => {
    try {
        const now = new Date();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart);
        yesterdayEnd.setMilliseconds(-1);

        const [[todayRows], [yestRows]] = await Promise.all([
            pool.query(
                `SELECT SUM(final_amount) AS revenue, COUNT(*) AS count
                 FROM orders
                 WHERE payment_status = 'paid' AND created_at BETWEEN ? AND ?`,
                [todayStart, todayEnd]
            ),
            pool.query(
                `SELECT SUM(final_amount) AS revenue, COUNT(*) AS count
                 FROM orders
                 WHERE payment_status = 'paid' AND created_at BETWEEN ? AND ?`,
                [yesterdayStart, yesterdayEnd]
            ),
        ]);

        const todayRevenue     = parseFloat(todayRows[0]?.revenue) || 0;
        const yesterdayRevenue = parseFloat(yestRows[0]?.revenue)  || 0;
        const todayCount       = todayRows[0]?.count    || 0;
        const yesterdayCount   = yestRows[0]?.count     || 0;

        let growth = 0;
        if (yesterdayRevenue === 0 && todayRevenue > 0) {
            growth = 100;
        } else if (yesterdayRevenue > 0) {
            growth = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
        }
        growth = Math.round(growth * 10) / 10;

        res.json({
            growth,
            today:          todayRevenue,
            yesterday:      yesterdayRevenue,
            todayCount,
            yesterdayCount,
            period:         'daily',
        });
    } catch (error) {
        console.error('[dashboardController] getGrowth error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get today's order stats
 * @route   GET /api/dashboard/stats
 * @access  Private (admin only)
 */
const getStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [[statusRows], [countResult]] = await Promise.all([
            pool.query(
                `SELECT order_status, COUNT(*) AS count, SUM(final_amount) AS revenue
                 FROM orders
                 WHERE created_at >= ?
                 GROUP BY order_status`,
                [today]
            ),
            pool.query('SELECT COUNT(*) AS cnt FROM orders'),
        ]);

        const byStatus = {};
        statusRows.forEach(s => {
            byStatus[s.order_status] = {
                count:   s.count,
                revenue: parseFloat(s.revenue || 0),
            };
        });

        res.json({
            today: {
                active:    (byStatus.pending?.count    || 0)
                         + (byStatus.accepted?.count   || 0)
                         + (byStatus.preparing?.count  || 0)
                         + (byStatus.ready?.count      || 0),
                completed: byStatus.completed?.count   || 0,
                cancelled: byStatus.cancelled?.count   || 0,
                revenue:   byStatus.completed?.revenue || 0,
            },
            allTime: countResult[0].cnt,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getGrowth, getStats };
