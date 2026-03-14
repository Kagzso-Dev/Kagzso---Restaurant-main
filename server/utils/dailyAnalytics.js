/**
 * dailyAnalytics.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utility to aggregate order data from the `orders` table and upsert
 * per-day snapshots into `daily_analytics`.
 *
 * Called after every significant order lifecycle event:
 *   - order created
 *   - order status updated (completed / cancelled)
 *   - payment processed
 *
 * Also exposed as a backfill function so all historical dates can be
 * populated in one shot on server startup or via a manual API trigger.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool } = require('../config/db');

/**
 * Aggregate and upsert daily analytics for one specific date.
 * If `date` is omitted, defaults to today (CURDATE()).
 *
 * The query counts/sums directly from the `orders` table so the data
 * is always accurate and never stale.
 *
 * @param {string|Date|null} date  - 'YYYY-MM-DD', JS Date, or null for today
 * @returns {Promise<void>}
 */
async function refreshDailyAnalytics(date = null) {
    try {
        // Normalise the date parameter to a 'YYYY-MM-DD' string (or CURDATE())
        let dateExpr;
        if (!date) {
            dateExpr = 'CURDATE()';
        } else {
            // Accept JS Date or ISO string
            const iso = date instanceof Date
                ? date.toISOString().slice(0, 10)
                : String(date).slice(0, 10);
            dateExpr = `'${iso}'`;
        }

        const sql = `
            INSERT INTO daily_analytics
                (date, total_orders, completed_orders, cancelled_orders,
                 total_revenue, avg_order_value,
                 dine_in_orders, takeaway_orders,
                 cash_revenue, digital_revenue)
            SELECT
                ${dateExpr}                                       AS date,
                COUNT(*)                                          AS total_orders,
                SUM(order_status = 'completed')                   AS completed_orders,
                SUM(order_status = 'cancelled')                   AS cancelled_orders,
                COALESCE(SUM(final_amount), 0)                    AS total_revenue,
                COALESCE(AVG(final_amount), 0)                    AS avg_order_value,
                SUM(order_type = 'dine-in')                       AS dine_in_orders,
                SUM(order_type = 'takeaway')                      AS takeaway_orders,
                COALESCE(SUM(CASE WHEN payment_method = 'cash'
                    THEN final_amount ELSE 0 END), 0)             AS cash_revenue,
                COALESCE(SUM(CASE WHEN payment_method IN ('qr','upi','credit_card','online')
                    THEN final_amount ELSE 0 END), 0)             AS digital_revenue
            FROM orders
            WHERE DATE(created_at) = ${dateExpr}
            ON DUPLICATE KEY UPDATE
                total_orders     = VALUES(total_orders),
                completed_orders = VALUES(completed_orders),
                cancelled_orders = VALUES(cancelled_orders),
                total_revenue    = VALUES(total_revenue),
                avg_order_value  = VALUES(avg_order_value),
                dine_in_orders   = VALUES(dine_in_orders),
                takeaway_orders  = VALUES(takeaway_orders),
                cash_revenue     = VALUES(cash_revenue),
                digital_revenue  = VALUES(digital_revenue)
        `;

        const [result] = await pool.query(sql);
        console.log(`[dailyAnalytics] Refreshed ${dateExpr} — affectedRows: ${result.affectedRows}`);
    } catch (err) {
        // Log but never throw — analytics refresh must never break the main flow
        console.error('[dailyAnalytics] refreshDailyAnalytics failed:', err.message);
    }
}

/**
 * Backfill `daily_analytics` for ALL dates that have orders but no
 * analytics row yet (or for all dates if `forceAll` is true).
 *
 * This is run once on server startup and can also be triggered via API.
 *
 * @param {boolean} forceAll  - if true, re-aggregate every date (not just missing)
 * @returns {Promise<{processed: number, skipped: number}>}
 */
async function backfillDailyAnalytics(forceAll = false) {
    try {
        console.log(`[dailyAnalytics] Starting backfill (forceAll=${forceAll})…`);

        // Get all distinct dates that have orders
        const [dateDates] = await pool.query(
            `SELECT DISTINCT DATE(created_at) AS d FROM orders ORDER BY d`
        );

        if (!dateDates.length) {
            console.log('[dailyAnalytics] No orders found — backfill skipped.');
            return { processed: 0, skipped: 0 };
        }

        // Get dates already in daily_analytics
        const [existingRows] = await pool.query(
            `SELECT date FROM daily_analytics`
        );
        const existingDates = new Set(
            existingRows.map(r => {
                const d = r.date instanceof Date ? r.date : new Date(r.date);
                return d.toISOString().slice(0, 10);
            })
        );

        let processed = 0;
        let skipped = 0;

        for (const row of dateDates) {
            const d = row.d instanceof Date ? row.d : new Date(row.d);
            const iso = d.toISOString().slice(0, 10);

            if (!forceAll && existingDates.has(iso)) {
                skipped++;
                continue;
            }

            await refreshDailyAnalytics(iso);
            processed++;
        }

        console.log(`[dailyAnalytics] Backfill complete — processed: ${processed}, skipped: ${skipped}`);
        return { processed, skipped };
    } catch (err) {
        console.error('[dailyAnalytics] backfillDailyAnalytics failed:', err.message);
        return { processed: 0, skipped: 0 };
    }
}

module.exports = { refreshDailyAnalytics, backfillDailyAnalytics };
