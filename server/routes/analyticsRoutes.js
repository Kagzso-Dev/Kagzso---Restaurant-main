const express = require('express');
const router = express.Router();
const {
    getSummary,
    getHeatmap,
    getWaitersRanking,
    getKitchenPerformance,
    getReport,
    getItemPerformance,
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../utils/cache');

// All analytics routes require authentication
// Restricted to admin only for security
router.use(protect, authorize('admin'));

// Cache TTLs tuned per query complexity:
//   summary/heatmap = expensive aggregation → 60s
//   kitchen/waiters = moderate → 30s
//   report         = variable range → 45s
router.get('/summary', cacheMiddleware(60, 'analytics'), getSummary);
router.get('/heatmap', cacheMiddleware(60, 'analytics'), getHeatmap);
router.get('/waiters', cacheMiddleware(30, 'analytics'), getWaitersRanking);
router.get('/kitchen', cacheMiddleware(30, 'analytics'), getKitchenPerformance);
router.get('/report', cacheMiddleware(45, 'analytics'), getReport);
router.get('/items', cacheMiddleware(45, 'analytics'), getItemPerformance);

module.exports = router;
