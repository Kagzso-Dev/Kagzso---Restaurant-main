/**
 * Migration: Update existing tables from old status values to new lifecycle statuses
 * 
 * Old statuses: 'active', 'inactive', 'occupied'
 * New statuses: 'available', 'reserved', 'occupied', 'billing', 'cleaning'
 * 
 * Run: node scripts/migrateTableStatus.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('tables');

        // Map old statuses to new ones
        const migrations = [
            { from: 'active', to: 'available' },
            { from: 'inactive', to: 'available' },
            // 'occupied' stays as 'occupied' — no change needed
        ];

        for (const { from, to } of migrations) {
            const result = await collection.updateMany(
                { status: from },
                {
                    $set: {
                        status: to,
                        lockedBy: null,
                        reservedAt: null,
                    },
                }
            );
            console.log(`Updated ${result.modifiedCount} tables: "${from}" → "${to}"`);
        }

        // Ensure all tables have the new fields
        const addFieldsResult = await collection.updateMany(
            { lockedBy: { $exists: false } },
            { $set: { lockedBy: null, reservedAt: null } }
        );
        console.log(`Added new fields to ${addFieldsResult.modifiedCount} tables`);

        console.log('Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
