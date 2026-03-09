/**
 * MySQL Migration: Update existing tables from old status values to new lifecycle statuses
 *
 * Old statuses: 'active', 'inactive'
 * New statuses: 'available', 'reserved', 'occupied', 'billing', 'cleaning'
 *
 * Run: node scripts/migrateTableStatus.js
 */
const path   = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { pool, connectDB } = require('../config/db');

async function migrate() {
    try {
        await connectDB();

        const migrations = [
            { from: 'active',   to: 'available' },
            { from: 'inactive', to: 'available' },
        ];

        for (const { from, to } of migrations) {
            const [result] = await pool.query(
                'UPDATE `tables` SET status = ? WHERE status = ?',
                [to, from]
            );
            console.log(`Updated ${result.affectedRows} tables: "${from}" -> "${to}"`);
        }

        // Ensure locked_by and reserved_at columns are NULL where they might be missing
        const [fixResult] = await pool.query(
            'UPDATE `tables` SET locked_by = NULL, reserved_at = NULL WHERE locked_by IS NOT NULL AND status = ?',
            ['available']
        );
        console.log(`Cleared stale lock data on ${fixResult.affectedRows} tables`);

        console.log('Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
