const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, changePassword } = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public route to get restaurant info (name, currency) before login
router.get('/', getSettings);

router.use(protect);

router.put('/', authorize('admin'), updateSettings);
router.post('/change-password', authorize('admin'), changePassword);

module.exports = router;
