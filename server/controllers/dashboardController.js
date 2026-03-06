const Order = require('../models/Order');

/**
 * @desc    Calculate revenue growth (today vs yesterday, or this week vs last week)
 * @route   GET /api/dashboard/growth
 * @access  Private (admin only)
 *
 * Uses MongoDB aggregation pipeline with the indexed fields:
 *   { branchId, paymentStatus, createdAt }
 *
 * Returns:
 *   { growth: number, today: number, yesterday: number, period: 'daily' | 'weekly' }
 */
const getGrowth = async (req, res) => {
    try {
        const now = new Date();

        // Today: midnight → now
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Yesterday: full day
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        const yesterdayEnd = new Date(todayStart);
        yesterdayEnd.setMilliseconds(-1);

        // Aggregation: sum finalAmount for paid orders
        const [todayResult, yesterdayResult] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        paymentStatus: 'paid',
                        createdAt: { $gte: todayStart, $lte: todayEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$finalAmount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Order.aggregate([
                {
                    $match: {
                        paymentStatus: 'paid',
                        createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$finalAmount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const todayRevenue = todayResult[0]?.revenue || 0;
        const yesterdayRevenue = yesterdayResult[0]?.revenue || 0;
        const todayCount = todayResult[0]?.count || 0;
        const yesterdayCount = yesterdayResult[0]?.count || 0;

        let growth = 0;
        if (yesterdayRevenue === 0 && todayRevenue > 0) {
            growth = 100;
        } else if (yesterdayRevenue === 0 && todayRevenue === 0) {
            growth = 0;
        } else {
            growth = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
        }

        growth = Math.round(growth * 10) / 10;

        res.json({
            growth,
            today: todayRevenue,
            yesterday: yesterdayRevenue,
            todayCount,
            yesterdayCount,
            period: 'daily',
        });
    } catch (error) {
        console.error('[dashboardController] getGrowth error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get stats
 */
const getStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [todayStats, allTimeCount] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        createdAt: { $gte: today },
                    },
                },
                {
                    $group: {
                        _id: '$orderStatus',
                        count: { $sum: 1 },
                        revenue: { $sum: '$finalAmount' },
                    },
                },
            ]),
            Order.countDocuments({}),
        ]);

        const byStatus = {};
        todayStats.forEach(s => { byStatus[s._id] = { count: s.count, revenue: s.revenue }; });

        res.json({
            today: {
                active: (byStatus.pending?.count || 0) + (byStatus.accepted?.count || 0) + (byStatus.preparing?.count || 0) + (byStatus.ready?.count || 0),
                completed: byStatus.completed?.count || 0,
                cancelled: byStatus.cancelled?.count || 0,
                revenue: byStatus.completed?.revenue || 0,
            },
            allTime: allTimeCount,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getGrowth, getStats };
