const { pool } = require('../config/db');

/**
 * @desc    Comprehensive analytics summary (revenue, order count, avg value)
 * @route   GET /api/analytics/summary
 */
const getSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = new Date(startDate || new Date().setDate(new Date().getDate() - 30));
        const end   = new Date(endDate   || new Date());

        const [rows] = await pool.query(
            `SELECT SUM(final_amount)  AS totalRevenue,
                    COUNT(*)           AS orderCount,
                    AVG(final_amount)  AS avgOrderValue
             FROM orders
             WHERE payment_status = 'paid' AND created_at BETWEEN ? AND ?`,
            [start, end]
        );

        const r = rows[0];
        res.json(r?.totalRevenue != null ? {
            totalRevenue:  parseFloat(r.totalRevenue),
            orderCount:    r.orderCount,
            avgOrderValue: parseFloat(r.avgOrderValue),
        } : { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Revenue heatmap (hourly or daily)
 * @route   GET /api/analytics/heatmap?type=hourly|daily
 */
const getHeatmap = async (req, res) => {
    try {
        const { type } = req.query;
        let sql;
        if (type === 'hourly') {
            sql = `SELECT HOUR(created_at)    AS hour,
                          SUM(final_amount)   AS revenue,
                          COUNT(*)            AS count
                   FROM orders
                   WHERE payment_status = 'paid'
                   GROUP BY HOUR(created_at)
                   ORDER BY hour`;
        } else {
            sql = `SELECT DAYOFWEEK(created_at) AS day,
                          SUM(final_amount)     AS revenue,
                          COUNT(*)              AS count
                   FROM orders
                   WHERE payment_status = 'paid'
                   GROUP BY DAYOFWEEK(created_at)
                   ORDER BY day`;
        }
        const [rows] = await pool.query(sql);
        res.json(rows.map(r => ({ ...r, revenue: parseFloat(r.revenue) })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Waiter productivity ranking
 * @route   GET /api/analytics/waiters
 */
const getWaitersRanking = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.username                                           AS waiterName,
                    COUNT(*)                                             AS totalOrders,
                    SUM(o.final_amount)                                  AS totalRevenue,
                    AVG(TIMESTAMPDIFF(SECOND, o.created_at, o.completed_at)) / 60
                                                                         AS avgCompletionTime
             FROM orders o
             JOIN users u ON o.waiter_id = u.id
             WHERE o.waiter_id IS NOT NULL
               AND o.order_status = 'completed'
             GROUP BY o.waiter_id, u.username
             ORDER BY totalRevenue DESC`
        );
        res.json(rows.map(r => ({
            ...r,
            totalRevenue:      parseFloat(r.totalRevenue),
            avgCompletionTime: parseFloat(r.avgCompletionTime),
        })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Kitchen performance metrics (avg prep time, delay rate)
 * @route   GET /api/analytics/kitchen
 */
const getKitchenPerformance = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT HOUR(created_at)  AS hour,
                    DATE(created_at)  AS date,
                    AVG(TIMESTAMPDIFF(SECOND, prep_started_at, ready_at)) / 60 AS avgPrepTime,
                    COUNT(*)          AS ordersCompleted,
                    SUM(CASE WHEN TIMESTAMPDIFF(SECOND, prep_started_at, ready_at) > 1200
                             THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS delayRate
             FROM orders
             WHERE prep_started_at IS NOT NULL
               AND ready_at IS NOT NULL
             GROUP BY HOUR(created_at), DATE(created_at)
             ORDER BY date DESC, hour ASC`
        );
        res.json(rows.map(r => ({
            ...r,
            avgPrepTime: parseFloat(r.avgPrepTime),
            delayRate:   parseFloat(r.delayRate),
        })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Time-based revenue report
 * @route   GET /api/analytics/report?range=today|week|month|year
 */
const getReport = async (req, res) => {
    try {
        const { range } = req.query;
        const now = new Date();
        let startDate, groupBy, labelExpr, sortExpr;

        switch (range) {
            case 'today':
                startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
                groupBy   = 'HOUR(created_at)';
                labelExpr = "CONCAT(HOUR(created_at), ':00')";
                sortExpr  = 'HOUR(created_at)';
                break;
            case 'week':
                startDate = new Date(now); startDate.setDate(now.getDate() - 7);
                groupBy   = "DATE_FORMAT(created_at, '%Y-%m-%d')";
                labelExpr = "DATE_FORMAT(created_at, '%Y-%m-%d')";
                sortExpr  = "DATE_FORMAT(created_at, '%Y-%m-%d')";
                break;
            case 'month':
                startDate = new Date(now); startDate.setDate(now.getDate() - 30);
                groupBy   = "DATE_FORMAT(created_at, '%Y-%m-%d')";
                labelExpr = "DATE_FORMAT(created_at, '%Y-%m-%d')";
                sortExpr  = "DATE_FORMAT(created_at, '%Y-%m-%d')";
                break;
            case 'year':
                startDate = new Date(now); startDate.setFullYear(now.getFullYear() - 1);
                groupBy   = 'MONTH(created_at)';
                labelExpr = 'MONTHNAME(created_at)';
                sortExpr  = 'MONTH(created_at)';
                break;
            default:
                return res.status(400).json({
                    message: 'Invalid range. Use today, week, month, or year.',
                });
        }

        const [rows] = await pool.query(
            `SELECT ${labelExpr} AS label,
                    SUM(final_amount) AS revenue,
                    COUNT(*)          AS orders
             FROM orders
             WHERE payment_status = 'paid' AND created_at >= ?
             GROUP BY ${groupBy}
             ORDER BY ${sortExpr}`,
            [startDate]
        );

        res.json(rows.map(r => ({ ...r, revenue: parseFloat(r.revenue) })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getSummary, getHeatmap, getWaitersRanking, getKitchenPerformance, getReport };
