const express = require('express');
const router = express.Router();
const { getGrowth, getStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../utils/cache');

// All dashboard routes require auth
router.use(protect);

// @route   GET /api/dashboard/growth
// @desc    Today vs yesterday revenue growth percentage
// @access  Admin only
router.get('/growth', authorize('admin'), cacheMiddleware(15, 'dashboard'), getGrowth);

// @route   GET /api/dashboard/stats
// @desc    Today's order summary (active, completed, cancelled, revenue)
// @access  Admin only
router.get('/stats', authorize('admin'), cacheMiddleware(15, 'dashboard'), getStats);

module.exports = router;
