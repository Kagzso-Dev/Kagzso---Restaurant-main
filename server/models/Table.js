const { pool } = require('../config/db');

const fmt = (row) => {
    if (!row) return null;
    return {
        _id: row.id,
        number: row.number,
        capacity: row.capacity,
        status: row.status,
        currentOrderId: row.current_order_id || null, // Robustness if column somehow missing but query didn't fail (select *)
        lockedBy: row.locked_by || null,
        reservedAt: row.reserved_at || null,
        reservationExpiresAt: row.reservation_expires_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const Table = {
    async findAll() {
        const [rows] = await pool.query(
            'SELECT * FROM `tables` WHERE id IS NOT NULL AND number IS NOT NULL ORDER BY number'
        );
        return rows.map(fmt);
    },

    async findById(id) {
        const [rows] = await pool.query(
            'SELECT * FROM `tables` WHERE id = ? LIMIT 1', [id]
        );
        return fmt(rows[0]);
    },

    async numberExists(number) {
        const [rows] = await pool.query(
            'SELECT id FROM `tables` WHERE number = ? LIMIT 1', [number]
        );
        return rows.length > 0;
    },

    async create({ number, capacity }) {
        const [result] = await pool.query(
            "INSERT INTO `tables` (number, capacity, status) VALUES (?, ?, 'available')",
            [number, capacity]
        );
        return this.findById(result.insertId);
    },

    async updateById(id, updates) {
        const fieldMap = {
            status: 'status',
            currentOrderId: 'current_order_id',
            lockedBy: 'locked_by',
            reservedAt: 'reserved_at',
            reservationExpiresAt: 'reservation_expires_at',
        };
        const setClauses = [];
        const params = [];
        for (const [key, val] of Object.entries(updates)) {
            const col = fieldMap[key] || key;
            setClauses.push(`\`${col}\` = ?`);
            params.push(val === undefined ? null : val);
        }
        if (!setClauses.length) return this.findById(id);
        params.push(id);
        await pool.query(
            `UPDATE \`tables\` SET ${setClauses.join(', ')} WHERE id = ?`, params
        );
        return this.findById(id);
    },

    // Atomic reserve: only succeeds when table is currently 'available'
    async atomicReserve(id, lockedBy) {
        const [result] = await pool.query(
            `UPDATE \`tables\`
             SET status = 'reserved', locked_by = ?, reserved_at = NOW()
             WHERE id = ? AND status = 'available'`,
            [lockedBy, id]
        );
        if (result.affectedRows === 0) return null;
        return this.findById(id);
    },

    async deleteById(id) {
        await pool.query('DELETE FROM `tables` WHERE id = ?', [id]);
    },

    async findExpiredReservations(cutoff) {
        const [rows] = await pool.query(
            `SELECT * FROM \`tables\`
             WHERE status = 'reserved'
               AND reserved_at < ?
               AND current_order_id IS NULL`,
            [cutoff]
        );
        return rows.map(fmt);
    },
};

module.exports = Table;
