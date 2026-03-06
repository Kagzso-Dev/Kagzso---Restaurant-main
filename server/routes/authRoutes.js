const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.get('/me', protect, getMe);

// Only admin can register new users
router.post('/register', protect, authorize('admin'), registerUser);

module.exports = router;
