const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * @desc    Get comprehensive analytics summary
 * @route   GET /api/analytics/summary
 */
const getSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {
            paymentStatus: 'paid',
            createdAt: {
                $gte: new Date(startDate || new Date().setDate(new Date().getDate() - 30)),
                $lte: new Date(endDate || new Date())
            }
        };

        const stats = await Order.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$finalAmount' },
                    orderCount: { $sum: 1 },
                    avgOrderValue: { $avg: '$finalAmount' }
                }
            }
        ]);

        res.json(stats[0] || { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get Revenue Heatmap Data
 * @route   GET /api/analytics/heatmap
 */
const getHeatmap = async (req, res) => {
    try {
        const { type } = req.query; // 'hourly' or 'daily'
        const match = {
            paymentStatus: 'paid'
        };

        let groupStage;
        if (type === 'hourly') {
            groupStage = {
                $group: {
                    _id: { hour: { $hour: '$createdAt' } },
                    revenue: { $sum: '$finalAmount' },
                    count: { $sum: 1 }
                }
            };
        } else {
            groupStage = {
                $group: {
                    _id: { day: { $dayOfWeek: '$createdAt' } },
                    revenue: { $sum: '$finalAmount' },
                    count: { $sum: 1 }
                }
            };
        }

        const data = await Order.aggregate([
            { $match: match },
            groupStage,
            { $sort: { '_id.hour': 1, '_id.day': 1 } }
        ]);

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get Waiter Productivity Ranking
 * @route   GET /api/analytics/waiters
 */
const getWaitersRanking = async (req, res) => {
    try {
        const data = await Order.aggregate([
            {
                $match: {
                    waiterId: { $exists: true, $ne: null },
                    orderStatus: 'completed'
                }
            },
            {
                $group: {
                    _id: '$waiterId',
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$finalAmount' },
                    avgCompletionTime: {
                        $avg: { $subtract: ['$completedAt', '$createdAt'] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'waiter'
                }
            },
            { $unwind: '$waiter' },
            {
                $project: {
                    waiterName: '$waiter.username',
                    totalOrders: 1,
                    totalRevenue: 1,
                    avgCompletionTime: { $divide: ['$avgCompletionTime', 60000] } // ms to minutes
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get Kitchen Performance Metrics
 * @route   GET /api/analytics/kitchen
 */
const getKitchenPerformance = async (req, res) => {
    try {
        const data = await Order.aggregate([
            {
                $match: {
                    prepStartedAt: { $exists: true },
                    readyAt: { $exists: true }
                }
            },
            {
                $group: {
                    _id: {
                        hour: { $hour: '$createdAt' },
                        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                    },
                    avgPrepTime: {
                        $avg: { $subtract: ['$readyAt', '$prepStartedAt'] }
                    },
                    ordersCompleted: { $sum: 1 },
                    delayedOrders: {
                        $sum: {
                            $cond: [
                                { $gt: [{ $subtract: ['$readyAt', '$prepStartedAt'] }, 20 * 60000] }, // 20 mins delay threshold
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    hour: '$_id.hour',
                    date: '$_id.day',
                    avgPrepTime: { $divide: ['$avgPrepTime', 60000] },
                    ordersCompleted: 1,
                    delayRate: { $multiply: [{ $divide: ['$delayedOrders', '$ordersCompleted'] }, 100] }
                }
            },
            { $sort: { date: -1, hour: 1 } }
        ]);

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get scalable time-based report
 * @route   GET /api/analytics/report
 */
const getReport = async (req, res) => {
    try {
        const { range } = req.query; // today | week | month | year

        const now = new Date();
        let startDate;
        let groupStage;
        let projectStage;

        switch (range) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                groupStage = {
                    $group: {
                        _id: { $hour: '$createdAt' },
                        revenue: { $sum: '$finalAmount' },
                        orders: { $sum: 1 }
                    }
                };
                projectStage = {
                    $project: {
                        _id: 0,
                        label: { $concat: [{ $toString: '$_id' }, ':00'] },
                        revenue: 1,
                        orders: 1,
                        sortKey: '$_id'
                    }
                };
                break;

            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                groupStage = {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        revenue: { $sum: '$finalAmount' },
                        orders: { $sum: 1 }
                    }
                };
                projectStage = {
                    $project: {
                        _id: 0,
                        label: '$_id',
                        revenue: 1,
                        orders: 1,
                        sortKey: '$_id'
                    }
                };
                break;

            case 'month':
                startDate = new Date(now.setDate(now.getDate() - 30));
                groupStage = {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        revenue: { $sum: '$finalAmount' },
                        orders: { $sum: 1 }
                    }
                };
                projectStage = {
                    $project: {
                        _id: 0,
                        label: '$_id',
                        revenue: 1,
                        orders: 1,
                        sortKey: '$_id'
                    }
                };
                break;

            case 'year':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                groupStage = {
                    $group: {
                        _id: { $month: '$createdAt' },
                        revenue: { $sum: '$finalAmount' },
                        orders: { $sum: 1 }
                    }
                };
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                projectStage = {
                    $project: {
                        _id: 0,
                        label: {
                            $arrayElemAt: [monthNames, { $subtract: ['$_id', 1] }]
                        },
                        revenue: 1,
                        orders: 1,
                        sortKey: '$_id'
                    }
                };
                break;

            default:
                return res.status(400).json({ message: "Invalid range. Use today, week, month, or year." });
        }

        const report = await Order.aggregate([
            {
                $match: {
                    paymentStatus: 'paid',
                    createdAt: { $gte: startDate }
                }
            },
            groupStage,
            projectStage,
            { $sort: { sortKey: 1 } }
        ]);

        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getSummary,
    getHeatmap,
    getWaitersRanking,
    getKitchenPerformance,
    getReport
};
