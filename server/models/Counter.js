const { pool } = require('../config/db');

/**
 * Counter — atomic sequence generator (replaces MongoDB Counter collection).
 * Uses INSERT ... ON DUPLICATE KEY UPDATE for race-condition-safe increments.
 */
const Counter = {
    async getNextSequence(key) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO counters (id, sequence_value) VALUES (?, 1)
                 ON DUPLICATE KEY UPDATE sequence_value = sequence_value + 1`,
                [key]
            );
            const [rows] = await conn.query(
                'SELECT sequence_value FROM counters WHERE id = ?', [key]
            );
            await conn.commit();
            return rows[0].sequence_value;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },
};

module.exports = Counter;
