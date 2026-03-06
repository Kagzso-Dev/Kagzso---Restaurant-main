const Table = require('../models/Table');

// ─── VALID STATUS TRANSITIONS ────────────────────────────────────────────────
// Prevents invalid state changes (e.g. jumping from 'cleaning' to 'billing')
const VALID_TRANSITIONS = {
    available: ['reserved'],
    reserved: ['occupied', 'available'],  // occupied when order placed, available on cancel/timeout
    occupied: ['billing'],
    billing: ['cleaning'],                // after payment
    cleaning: ['available'],              // after manual clean confirm
};

// @desc    Get all tables for this branch
// @route   GET /api/tables
// @access  Private
const getTables = async (req, res) => {
    try {
        const tables = await Table.find({}).sort({ number: 1 });
        res.json(tables);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a table
// @route   POST /api/tables
// @access  Private (Admin)
const createTable = async (req, res) => {
    const { number, capacity } = req.body;

    try {
        const tableExists = await Table.findOne({ number });
        if (tableExists) {
            return res.status(400).json({ message: 'Table number already exists' });
        }

        const table = await Table.create({
            number,
            capacity,
            status: 'available',
        });

        res.status(201).json(table);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update table
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

        if (status) table.status = status;
        if (status === 'available') {
            table.lockedBy = null;
            table.reservedAt = null;
            table.currentOrderId = null;
        }

        await table.save();

        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: table._id,
            status: table.status,
            lockedBy: table.lockedBy,
        });

        res.json(table);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reserve a table (Waiter only)
// @route   PUT /api/tables/:id/reserve
// @access  Private (Waiter, Admin)
const reserveTable = async (req, res) => {
    try {
        const table = await Table.findOneAndUpdate(
            {
                _id: req.params.id,
                status: 'available',
            },
            {
                $set: {
                    status: 'reserved',
                    lockedBy: req.user._id,
                    reservedAt: new Date(),
                },
            },
            { new: true }
        );

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

        table.status = 'available';
        table.lockedBy = null;
        table.reservedAt = null;
        table.currentOrderId = null;
        await table.save();

        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: table._id,
            status: 'available',
        });

        res.json(table);
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

        table.status = 'available';
        table.lockedBy = null;
        table.reservedAt = null;
        table.currentOrderId = null;
        await table.save();

        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: table._id,
            status: 'available',
        });

        res.json(table);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Force reset table
// @route   PUT /api/tables/:id/force-reset
// @access  Private (Admin only)
const forceResetTable = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);

        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }

        table.status = 'available';
        table.lockedBy = null;
        table.reservedAt = null;
        table.currentOrderId = null;
        await table.save();

        req.app.get('socketio').to('restaurant_main').emit('table-updated', {
            tableId: table._id,
            status: 'available',
        });

        res.json({ message: 'Table force-reset to available', table });
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

        await table.deleteOne();
        res.json({ message: 'Table removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── AUTO-RELEASE
const autoReleaseExpiredReservations = async (io) => {
    const TEN_MINUTES = 10 * 60 * 1000;
    const cutoff = new Date(Date.now() - TEN_MINUTES);

    try {
        const expiredTables = await Table.find({
            status: 'reserved',
            reservedAt: { $lt: cutoff },
            currentOrderId: null,
        });

        for (const table of expiredTables) {
            table.status = 'available';
            table.lockedBy = null;
            table.reservedAt = null;
            await table.save();

            if (io) {
                io.to('restaurant_main').emit('table-updated', {
                    tableId: table._id,
                    status: 'available',
                });
            }
        }
    } catch (error) {
        console.error('Auto-release error:', error.message);
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
