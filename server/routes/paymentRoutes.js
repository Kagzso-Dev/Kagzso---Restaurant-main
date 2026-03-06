const express = require('express');
const router = express.Router();
const {
    initiatePayment,
    cancelPayment,
    processPayment,
    getPaymentByOrder,
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All payment routes require valid JWT
router.use(protect);

// Initiate payment (lock order)
router.post('/:orderId/initiate', authorize('cashier', 'admin'), initiatePayment);

// Cancel initiated payment (unlock order)
router.post('/:orderId/cancel', authorize('cashier', 'admin'), cancelPayment);

// Process payment (execute)
router.post('/:orderId/process', authorize('cashier', 'admin'), processPayment);

// Get payment record for an order
router.get('/:orderId', authorize('cashier', 'admin'), getPaymentByOrder);

module.exports = router;
