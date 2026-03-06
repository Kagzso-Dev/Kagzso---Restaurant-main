const express = require('express');
const router = express.Router();
const {
    getTables,
    createTable,
    updateTable,
    reserveTable,
    releaseTable,
    markTableClean,
    forceResetTable,
    deleteTable,
} = require('../controllers/tableController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// CRUD
router.route('/')
    .get(getTables)
    .post(authorize('admin'), createTable);

router.route('/:id')
    .put(authorize('admin', 'waiter', 'cashier'), updateTable)
    .delete(authorize('admin'), deleteTable);

// ── Table Lifecycle Endpoints ────────────────────────────────────────────────
router.put('/:id/reserve', authorize('waiter', 'admin'), reserveTable);
router.put('/:id/release', authorize('waiter', 'admin'), releaseTable);
router.put('/:id/cancel-reservation', authorize('waiter', 'admin'), releaseTable); // alias for /release
router.put('/:id/clean', authorize('waiter', 'admin'), markTableClean);
router.put('/:id/force-reset', authorize('admin'), forceResetTable);

module.exports = router;
