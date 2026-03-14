const { pool } = require('../config/db');

// ── Label formatter ───────────────────────────────────────────────────────────
// SELECT expressions must exactly match GROUP BY expressions in MySQL
// ONLY_FULL_GROUP_BY (strict mode default since 5.7.5).
// We select the raw numeric/date value and format it here in Node.js.
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatGroupLabel(raw, range) {
    if (raw === null || raw === undefined) return String(raw);
    if (range === 'year') {
        // raw = MONTH() integer 1-12
        return FULL_MONTHS[(parseInt(raw) - 1)] ?? String(raw);
    }
    if (range === 'week' || range === 'month') {
        // raw = DATE() → JS Date object or 'YYYY-MM-DD' string from mysql2
        const iso = raw instanceof Date
            ? raw.toISOString().slice(0, 10)
            : String(raw).slice(0, 10);
        const [, m, d] = iso.split('-');
        return `${d} ${SHORT_MONTHS[parseInt(m) - 1]}`;
    }
    // 'today' / default: raw = HOUR() integer 0-23
    return String(raw).padStart(2, '0') + ':00';
}

// ── Shared helper: converts a range string into a start Date ────────────────
function rangeStart(range) {
    const now = new Date();
    switch (range) {
        case 'today':
            { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
        case 'week':
            { const d = new Date(now); d.setDate(now.getDate() - 7); d.setHours(0, 0, 0, 0); return d; }
        case 'month':
            { const d = new Date(now); d.setDate(now.getDate() - 30); d.setHours(0, 0, 0, 0); return d; }
        case 'year':
            { const d = new Date(now); d.setFullYear(now.getFullYear() - 1); d.setHours(0, 0, 0, 0); return d; }
        default:
            return null; // no date filter — all time
    }
}

/**
 * @desc    Comprehensive analytics summary (revenue, order count, avg value)
 * @route   GET /api/analytics/summary?range=today|week|month|year
 */
const getSummary = async (req, res) => {
    try {
        const { startDate, endDate, range } = req.query;
        const now = new Date();
        let start, end = new Date(now);

        const rs = rangeStart(range);
        if (rs) {
            start = rs;
        } else {
            start = new Date(startDate || new Date().setDate(new Date().getDate() - 30));
            end = new Date(endDate || now);
        }

        const [rows] = await pool.query(
            `SELECT SUM(final_amount) AS totalRevenue,
                    COUNT(*)          AS orderCount,
                    AVG(final_amount) AS avgOrderValue
             FROM orders
             WHERE payment_status = 'paid' AND created_at BETWEEN ? AND ?`,
            [start, end]
        );

        const r = rows[0];
        const result = r?.totalRevenue != null ? {
            totalRevenue: parseFloat(r.totalRevenue),
            orderCount: parseInt(r.orderCount),
            avgOrderValue: parseFloat(r.avgOrderValue),
        } : { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 };
        console.log(`[analyticsController] getSummary MySQL result (range=${range}):`, result);
        res.json(result);
    } catch (error) {
        console.error('[analyticsController] getSummary error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Hourly revenue distribution (all hours of day), filtered by range
 * @route   GET /api/analytics/heatmap?type=hourly|daily&range=today|week|month|year
 */
const getHeatmap = async (req, res) => {
    try {
        const { type, range } = req.query;
        const start = rangeStart(range);
        const whereClause = start
            ? `WHERE payment_status = 'paid' AND created_at >= ?`
            : `WHERE payment_status = 'paid'`;
        const params = start ? [start] : [];

        let sql;
        if (type === 'hourly') {
            sql = `SELECT HOUR(created_at)  AS hour,
                          SUM(final_amount) AS revenue,
                          COUNT(*)          AS count
                   FROM orders
                   ${whereClause}
                   GROUP BY HOUR(created_at)
                   ORDER BY hour`;
        } else {
            sql = `SELECT DAYOFWEEK(created_at) AS day,
                          SUM(final_amount)     AS revenue,
                          COUNT(*)              AS count
                   FROM orders
                   ${whereClause}
                   GROUP BY DAYOFWEEK(created_at)
                   ORDER BY day`;
        }

        const [rows] = await pool.query(sql, params);
        res.json(rows.map(r => ({ ...r, revenue: parseFloat(r.revenue || 0) })));
    } catch (error) {
        console.error('[analyticsController] getHeatmap error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Waiter productivity ranking, filtered by range
 * @route   GET /api/analytics/waiters?range=today|week|month|year
 */
const getWaitersRanking = async (req, res) => {
    try {
        const { range } = req.query;
        const start = rangeStart(range);
        const dateFilter = start ? 'AND o.created_at >= ?' : '';
        const params = start ? [start] : [];

        const [rows] = await pool.query(
            `SELECT u.username                                                AS waiterName,
                    COUNT(*)                                                  AS totalOrders,
                    SUM(o.final_amount)                                       AS totalRevenue,
                    AVG(TIMESTAMPDIFF(SECOND, o.created_at, o.completed_at)) / 60
                                                                              AS avgCompletionTime
             FROM orders o
             JOIN users u ON o.waiter_id = u.id
             WHERE o.waiter_id IS NOT NULL
               AND o.payment_status = 'paid'
               ${dateFilter}
             GROUP BY o.waiter_id, u.username
             ORDER BY totalRevenue DESC`,
            params
        );
        res.json(rows.map(r => ({
            ...r,
            totalRevenue: parseFloat(r.totalRevenue || 0),
            avgCompletionTime: parseFloat(r.avgCompletionTime || 0),
        })));
    } catch (error) {
        console.error('[analyticsController] getWaitersRanking error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Kitchen prep time — grouped by range
 *          today  → per hour  (label = "14:00")
 *          week/month → per day   (label = "11 Mar")
 *          year   → per month (label = "March")
 *          default→ per hour  (all time)
 * @route   GET /api/analytics/kitchen?range=today|week|month|year
 */
const getKitchenPerformance = async (req, res) => {
    try {
        const { range } = req.query;
        const start = rangeStart(range);
        const dateFilter = start ? 'AND created_at >= ?' : '';
        const params = start ? [start] : [];

        let groupBy;
        switch (range) {
            case 'week':
            case 'month':  groupBy = 'DATE(created_at)';  break;
            case 'year':   groupBy = 'MONTH(created_at)'; break;
            case 'today':
            default:       groupBy = 'HOUR(created_at)';  break;
        }

        const [rows] = await pool.query(
            `SELECT ${groupBy} AS label,
                    AVG(TIMESTAMPDIFF(SECOND,
                        COALESCE(prep_started_at, created_at),
                        COALESCE(ready_at, completed_at))) / 60 AS avgPrepTime,
                    COUNT(*) AS ordersCompleted,
                    SUM(CASE
                        WHEN TIMESTAMPDIFF(SECOND,
                            COALESCE(prep_started_at, created_at),
                            COALESCE(ready_at, completed_at)) > 1200
                        THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) AS delayRate
             FROM orders
             WHERE payment_status = 'paid'
               AND completed_at IS NOT NULL
               ${dateFilter}
             GROUP BY ${groupBy}
             ORDER BY ${groupBy}`,
            params
        );
        res.json(rows.map(r => ({
            label:           formatGroupLabel(r.label, range),
            avgPrepTime:     parseFloat(r.avgPrepTime     || 0),
            ordersCompleted: parseInt(r.ordersCompleted   || 0),
            delayRate:       parseFloat(r.delayRate       || 0),
        })));
    } catch (error) {
        console.error('[analyticsController] getKitchenPerformance error:', error.message);
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
        let startDate, groupBy;

        switch (range) {
            case 'today':
                startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
                groupBy = 'HOUR(created_at)';
                break;
            case 'week':
                startDate = new Date(now); startDate.setDate(now.getDate() - 7); startDate.setHours(0, 0, 0, 0);
                groupBy = 'DATE(created_at)';
                break;
            case 'month':
                startDate = new Date(now); startDate.setDate(now.getDate() - 30); startDate.setHours(0, 0, 0, 0);
                groupBy = 'DATE(created_at)';
                break;
            case 'year':
                startDate = new Date(now); startDate.setFullYear(now.getFullYear() - 1); startDate.setHours(0, 0, 0, 0);
                groupBy = 'MONTH(created_at)';
                break;
            default:
                return res.status(400).json({
                    message: 'Invalid range. Use today, week, month, or year.',
                });
        }

        const [rows] = await pool.query(
            `SELECT ${groupBy} AS label,
                    SUM(final_amount) AS revenue,
                    COUNT(*)          AS orders
             FROM orders
             WHERE payment_status = 'paid' AND created_at >= ?
             GROUP BY ${groupBy}
             ORDER BY ${groupBy}`,
            [startDate]
        );

        res.json(rows.map(r => ({
            label:   formatGroupLabel(r.label, range),
            revenue: parseFloat(r.revenue || 0),
            orders:  parseInt(r.orders    || 0),
        })));
    } catch (error) {
        console.error('[analyticsController] getReport error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Per-item performance: orders sold, revenue, avg prep time
 * @route   GET /api/analytics/items?range=today|week|month|year
 */
const getItemPerformance = async (req, res) => {
    try {
        const { range } = req.query;
        const start = rangeStart(range);
        const dateFilter = start ? 'AND o.created_at >= ?' : '';
        const params = start ? [start] : [];

        const [rows] = await pool.query(
            `SELECT
                oi.name                                                          AS itemName,
                SUM(oi.quantity)                                                 AS totalOrders,
                SUM(oi.price * oi.quantity)                                      AS totalRevenue,
                AVG(TIMESTAMPDIFF(SECOND,
                    COALESCE(o.prep_started_at, o.created_at),
                    COALESCE(o.ready_at, o.completed_at))) / 60                 AS avgPrepTime
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE o.payment_status = 'paid'
               AND oi.status != 'CANCELLED'
               ${dateFilter}
             GROUP BY oi.name
             ORDER BY totalRevenue DESC
             LIMIT 50`,
            params
        );

        res.json(rows.map(r => ({
            itemName: r.itemName,
            totalOrders: parseInt(r.totalOrders || 0),
            totalRevenue: parseFloat(r.totalRevenue || 0),
            avgPrepTime: parseFloat(r.avgPrepTime || 0),
        })));
    } catch (error) {
        console.error('[analyticsController] getItemPerformance error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getSummary, getHeatmap, getWaitersRanking, getKitchenPerformance, getReport, getItemPerformance };
