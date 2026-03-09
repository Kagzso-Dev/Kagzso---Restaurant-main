/**
 * MySQL Seeder
 * Creates:
 *   1. Staff users: Admin, Waiter, Kitchen, Cashier
 *   2. Categories, MenuItems, Tables
 *   3. Settings, Counters
 *   4. Sample completed orders with order_items
 */

const dotenv  = require('dotenv');
const bcrypt  = require('bcryptjs');
dotenv.config();

const { pool, connectDB } = require('./config/db');

const hash = async (pw) => bcrypt.hash(pw, await bcrypt.genSalt(10));

const importData = async () => {
    try {
        await connectDB();
        const conn = await pool.getConnection();

        console.log('Clearing existing data...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE notification_reads');
        await conn.query('TRUNCATE TABLE notifications');
        await conn.query('TRUNCATE TABLE payment_audits');
        await conn.query('TRUNCATE TABLE payments');
        await conn.query('TRUNCATE TABLE order_items');
        await conn.query('TRUNCATE TABLE orders');
        await conn.query('TRUNCATE TABLE `tables`');
        await conn.query('TRUNCATE TABLE menu_items');
        await conn.query('TRUNCATE TABLE categories');
        await conn.query('TRUNCATE TABLE settings');
        await conn.query('TRUNCATE TABLE counters');
        await conn.query('TRUNCATE TABLE users');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        // ── Users ────────────────────────────────────────────────────────────
        console.log('Creating staff...');
        await conn.query(
            'INSERT INTO users (username, password, role) VALUES ?',
            [[
                ['admin',   await hash('admin123'),   'admin'],
                ['waiter',  await hash('waiter123'),  'waiter'],
                ['kitchen', await hash('kitchen123'), 'kitchen'],
                ['cashier', await hash('cashier123'), 'cashier'],
            ]]
        );
        const [[adminUser]]  = await conn.query('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
        const [[waiterUser]] = await conn.query('SELECT id FROM users WHERE role = ? LIMIT 1', ['waiter']);

        // ── Settings ─────────────────────────────────────────────────────────
        console.log('Creating settings...');
        await conn.query(
            'INSERT INTO settings (restaurant_name, currency, currency_symbol, tax_rate, gst_number) VALUES (?, ?, ?, ?, ?)',
            ['KAGSZO', 'INR', '₹', 5, 'GST123456']
        );

        // ── Counters ─────────────────────────────────────────────────────────
        await conn.query(
            'INSERT INTO counters (id, sequence_value) VALUES (?, 0) ON DUPLICATE KEY UPDATE sequence_value = 0',
            ['tokenNumber_global']
        );

        // ── Categories ───────────────────────────────────────────────────────
        console.log('Creating menu...');
        await conn.query(
            'INSERT INTO categories (name, description) VALUES ?',
            [[
                ['Starters',    'Appetizers'],
                ['Main Course', 'Heavy meals'],
                ['Beverages',   'Drinks'],
            ]]
        );
        const [cats] = await conn.query('SELECT id FROM categories ORDER BY id LIMIT 3');
        const [cat0, cat1, cat2] = cats.map(c => c.id);

        // ── Menu Items ───────────────────────────────────────────────────────
        await conn.query(
            'INSERT INTO menu_items (name, price, category_id, is_veg) VALUES ?',
            [[
                ['Paneer Tikka',  250, cat0, 1],
                ['Chicken Wings', 300, cat0, 0],
                ['Butter Chicken',400, cat1, 0],
                ['Dal Makhani',   200, cat1, 1],
                ['Coke',           50, cat2, 1],
            ]]
        );
        const [menuItems] = await conn.query('SELECT id, name, price FROM menu_items ORDER BY id');

        // ── Tables ───────────────────────────────────────────────────────────
        console.log('Creating tables...');
        const tableRows = Array.from({ length: 10 }, (_, i) => [i + 1, 4]);
        await conn.query('INSERT INTO `tables` (number, capacity) VALUES ?', [tableRows]);
        const [allTables] = await conn.query('SELECT id FROM `tables` ORDER BY id');

        // ── Sample Orders ────────────────────────────────────────────────────
        console.log('Creating sample orders...');
        const now = new Date();

        for (let i = 0; i < 20; i++) {
            const date = new Date(now);
            date.setHours(date.getHours() - (i % 24));
            if (i > 10) date.setDate(date.getDate() - 1);

            const item1   = menuItems[i % menuItems.length];
            const item2   = menuItems[(i + 1) % menuItems.length];
            const total   = item1.price + item2.price;
            const tableId = allTables[i % allTables.length].id;
            const payMethod = i % 2 === 0 ? 'cash' : 'upi';

            const prepStart = new Date(date); prepStart.setMinutes(date.getMinutes() - 20);
            const readyAt   = new Date(date); readyAt.setMinutes(date.getMinutes() - 5);

            const [ordRes] = await conn.query(
                `INSERT INTO orders
                 (order_number, token_number, order_type, table_id, order_status,
                  payment_status, payment_method, total_amount, tax, discount,
                  final_amount, waiter_id, prep_started_at, ready_at,
                  payment_at, completed_at, created_at, kot_status)
                 VALUES (?, ?, 'dine-in', ?, 'completed', 'paid', ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, 'Closed')`,
                [`ORD-${100 + i}`, 100 + i, tableId, payMethod, total, total,
                 waiterUser.id, prepStart, readyAt, date, date, date]
            );

            await conn.query(
                'INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, status) VALUES ?',
                [[
                    [ordRes.insertId, item1.id, item1.name, item1.price, 1, 'SERVED'],
                    [ordRes.insertId, item2.id, item2.name, item2.price, 1, 'SERVED'],
                ]]
            );
        }

        conn.release();

        console.log('\nSeed complete!\n');
        console.log('=========================================');
        console.log('  STAFF LOGIN CREDENTIALS:');
        console.log('-----------------------------------------');
        console.log('  Admin   -> admin   / admin123');
        console.log('  Waiter  -> waiter  / waiter123');
        console.log('  Kitchen -> kitchen / kitchen123');
        console.log('  Cashier -> cashier / cashier123');
        console.log('=========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

importData();
