const Table = require('../models/Table');

// ─── VALID STATUS TRANSITIONS ────────────────────────────────────────────────
// occupied → cleaning  : direct path used by paymentController after payment
// occupied → billing   : optional billing step before final payment
// billing  → occupied  : allow reverting from billing back to occupied
const VALID_TRANSITIONS = {
    available: ['reserved', 'occupied'],    // direct seat for walk-in
    reserved: ['occupied', 'available'],
    occupied: ['cleaning'],                // cleaning allowed directly (payment flow)
    cleaning: ['available'],
};

// @desc    Get all tables
// @route   GET /api/tables
// @access  Private
const getTables = async (req, res) => {
    try {
        const tables = await Table.findAll();
        res.json(tables);
    } catch (error) {
        // Handle case where schema might be missing columns during first run
        if (error.code === 'ER_BAD_FIELD_ERROR') {
            console.error('[TableController] Schema mismatch:', error.message);
            return res.status(500).json({
                message: 'Database schema mismatch. Please restart the backend server to run migrations.',
                error: error.message,
            });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a table
// @route   POST /api/tables
// @access  Private (Admin)
const createTable = async (req, res) => {
    const { number, capacity } = req.body;
    try {
        if (await Table.numberExists(number)) {
            return res.status(400).json({ message: 'Table number already exists' });
        }
        const table = await Table.create({ number, capacity });
        res.status(201).json(table);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update table status
// @route   PUT /api/tables/:id
// @access  Private (Admin, Waiter, Cashier)
const updateTable = async (req, res) => {
    const { status } = req.body;
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }

        if (status && status !== table.status) {
            const allowed = VALID_TRANSITIONS[table.status];
            if (!allowed || !allowed.includes(status)) {
                return res.status(400).json({
                    message: `Cannot change table from "${table.status}" to "${status}"`,
                });
            }
        }

        const updates = {};
        if (status) {
            updates.status = status;
            if (status === 'available') {
                updates.lockedBy = null;
                updates.reservedAt = null;
                updates.reservationExpiresAt = null;
                updates.currentOrderId = null;
            }
        }

        const updated = await Table.updateById(req.params.id, updates);
        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: updated._id,
            status: updated.status,
            lockedBy: updated.lockedBy,
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reserve a table (atomic — prevents double-booking)
// @route   PUT /api/tables/:id/reserve
// @access  Private (Waiter, Admin)
const reserveTable = async (req, res) => {
    try {
        const table = await Table.atomicReserve(req.params.id, req.user._id);
        if (!table) {
            const existing = await Table.findById(req.params.id);
            if (!existing) {
                return res.status(404).json({ message: 'Table not found' });
            }
            return res.status(400).json({
                message: `Table is currently "${existing.status}" and cannot be reserved`,
            });
        }
        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: table._id,
            status: 'reserved',
            lockedBy: table.lockedBy,
        });
        res.json(table);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Release a reserved table
// @route   PUT /api/tables/:id/release
// @access  Private (Waiter, Admin)
const releaseTable = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }
        if (table.status !== 'reserved') {
            return res.status(400).json({
                message: `Table is "${table.status}", only reserved tables can be released`,
            });
        }
        const updated = await Table.updateById(req.params.id, {
            status: 'available',
            lockedBy: null,
            reservedAt: null,
            reservationExpiresAt: null,
            currentOrderId: null,
        });
        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: updated._id, status: 'available',
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark table as cleaned
// @route   PUT /api/tables/:id/clean
// @access  Private (Waiter, Admin)
const markTableClean = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }
        if (table.status !== 'cleaning') {
            return res.status(400).json({
                message: `Table is "${table.status}", only tables in "cleaning" can be marked clean`,
            });
        }
        const updated = await Table.updateById(req.params.id, {
            status: 'available',
            lockedBy: null,
            reservedAt: null,
            reservationExpiresAt: null,
            currentOrderId: null,
        });
        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: updated._id, status: 'available',
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Force reset table to available
// @route   PUT /api/tables/:id/force-reset
// @access  Private (Admin only)
const forceResetTable = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }
        const updated = await Table.updateById(req.params.id, {
            status: 'available',
            lockedBy: null,
            reservedAt: null,
            reservationExpiresAt: null,
            currentOrderId: null,
        });
        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: updated._id, status: 'available',
        });
        res.json({ message: 'Table force-reset to available', table: updated });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete table
// @route   DELETE /api/tables/:id
// @access  Private (Admin)
const deleteTable = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }
        if (table.status !== 'available') {
            return res.status(400).json({
                message: `Cannot delete table while status is "${table.status}". Reset it first.`,
            });
        }
        await Table.deleteById(req.params.id);
        res.json({ message: 'Table removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── AUTO-RELEASE expired reservations (runs on a timer) ─────────────────────
// Tables reserved for more than 10 minutes without an order attached are
// automatically returned to 'available'.  This runs every 2 minutes and once
// immediately on startup (see server.js).
const autoReleaseExpiredReservations = async (io) => {
    const TEN_MINUTES = 10 * 60 * 1000;
    const cutoff = new Date(Date.now() - TEN_MINUTES);
    try {
        const expiredTables = await Table.findExpiredReservations(cutoff);
        for (const table of expiredTables) {
            await Table.updateById(table._id, {
                status: 'available',
                lockedBy: null,
                reservedAt: null,
                reservationExpiresAt: null,
            });
            if (io) {
                io.to('restaurant_main').emit('table-updated', {
                    tableId: table._id, status: 'available',
                });
            }
        }
        if (expiredTables.length > 0) {
            console.log(`[AutoRelease] Released ${expiredTables.length} expired reservation(s)`);
        }
    } catch (error) {
        // ER_BAD_FIELD_ERROR = unknown column — schema migration likely pending
        if (error.code === 'ER_BAD_FIELD_ERROR') {
            console.error(
                '[AutoRelease] Schema mismatch detected:', error.message,
                '\n  → The `tables` table is missing required columns.',
                '\n  → Run the ALTER TABLE commands or restart after schema migration.'
            );
        } else {
            console.error('[AutoRelease] Unexpected error:', error.message);
        }
    }
};

module.exports = {
    getTables,
    createTable,
    updateTable,
    reserveTable,
    releaseTable,
    markTableClean,
    forceResetTable,
    deleteTable,
    autoReleaseExpiredReservations,
};
