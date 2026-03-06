const express = require('express');
const router = express.Router();
const { handleRazorpayWebhook } = require('../controllers/webhookController');

// Webhook routes are public but should have their own security (signature verification)
// Use express.json() with specific verification logic if needed for raw body
router.post('/razorpay', handleRazorpayWebhook);

module.exports = router;
