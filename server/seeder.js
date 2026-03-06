/**
 * Single Restaurant Seeder
 * Creates:
 *   1. Demo Branch: "Main Branch"
 *   2. Staff users: Admin, Waiter, Kitchen, Cashier
 *   3. Categories, MenuItems, Tables
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/db');
const User = require('./models/User');
const Table = require('./models/Table');
const MenuItem = require('./models/MenuItem');
const Category = require('./models/Category');
const Setting = require('./models/Setting');
const Counter = require('./models/Counter');
const Order = require('./models/Order');

dotenv.config();

const hash = async (pw) => bcrypt.hash(pw, await bcrypt.genSalt(10));

const importData = async () => {
    try {
        await connectDB();
        console.log('🗑  Clearing existing data...');
        await Promise.all([
            User.deleteMany(),
            Table.deleteMany(),
            MenuItem.deleteMany(),
            Category.deleteMany(),
            Setting.deleteMany(),
            Counter.deleteMany(),
            Order.deleteMany(),
        ]);

        console.log('👥 Creating staff...');
        await User.insertMany([
            { username: 'admin', password: await hash('admin123'), role: 'admin' },
            { username: 'waiter', password: await hash('waiter123'), role: 'waiter' },
            { username: 'kitchen', password: await hash('kitchen123'), role: 'kitchen' },
            { username: 'cashier', password: await hash('cashier123'), role: 'cashier' },
        ]);

        console.log('⚙️  Creating settings...');
        await Setting.create({
            restaurantName: 'KAGSZO',
            currency: 'INR',
            currencySymbol: '₹',
            taxRate: 5,
            gstNumber: 'GST123456',
        });

        console.log('🍽  Creating menu...');
        const categories = await Category.insertMany([
            { name: 'Starters', description: 'Appetizers' },
            { name: 'Main Course', description: 'Heavy meals' },
            { name: 'Beverages', description: 'Drinks' },
        ]);

        await MenuItem.insertMany([
            { name: 'Paneer Tikka', price: 250, category: categories[0]._id, isVeg: true },
            { name: 'Chicken Wings', price: 300, category: categories[0]._id, isVeg: false },
            { name: 'Butter Chicken', price: 400, category: categories[1]._id, isVeg: false },
            { name: 'Dal Makhani', price: 200, category: categories[1]._id, isVeg: true },
            { name: 'Coke', price: 50, category: categories[2]._id, isVeg: true },
        ]);

        console.log('🪑 Creating tables...');
        const tables = Array.from({ length: 10 }, (_, i) => ({
            number: i + 1,
            capacity: 4,
        }));

        await Table.insertMany(tables);
        const allTables = await Table.find();
        const allItems = await MenuItem.find();
        const adminUser = await User.findOne({ role: 'admin' });
        const waiterUser = await User.findOne({ role: 'waiter' });

        console.log('📝 Creating sample orders...');
        const orders = [];
        const now = new Date();

        // Create some orders for different times today and yesterday
        for (let i = 0; i < 20; i++) {
            const date = new Date(now);
            date.setHours(date.getHours() - (i % 24)); // spread across hours
            if (i > 10) date.setDate(date.getDate() - 1); // some from yesterday

            const item1 = allItems[i % allItems.length];
            const item2 = allItems[(i + 1) % allItems.length];
            const total = item1.price + item2.price;

            orders.push({
                orderNumber: `ORD-${100 + i}`,
                tokenNumber: 100 + i,
                orderType: 'dine-in',
                tableId: allTables[i % allTables.length]._id,
                items: [
                    { menuItemId: item1._id, name: item1.name, price: item1.price, quantity: 1, status: 'SERVED' },
                    { menuItemId: item2._id, name: item2.name, price: item2.price, quantity: 1, status: 'SERVED' },
                ],
                orderStatus: 'completed',
                paymentStatus: 'paid',
                paymentMethod: i % 2 === 0 ? 'cash' : 'upi',
                totalAmount: total,
                finalAmount: total,
                waiterId: waiterUser._id,
                prepStartedAt: new Date(date).setMinutes(date.getMinutes() - 20),
                readyAt: new Date(date).setMinutes(date.getMinutes() - 5),
                paymentAt: date,
                completedAt: date,
                createdAt: date,
            });
        }

        await Order.insertMany(orders);

        console.log('\n✅ Seed complete!\n');
        console.log('═══════════════════════════════════════════');
        console.log('  STAFF LOGIN CREDENTIALS:');
        console.log('─────────────────────────────────────────');
        console.log('  Admin   → admin   / admin123');
        console.log('  Waiter  → waiter  / waiter123');
        console.log('  Kitchen → kitchen / kitchen123');
        console.log('  Cashier → cashier / cashier123');
        console.log('═══════════════════════════════════════════\n');

        process.exit();
    } catch (error) {
        console.error('❌ Seed error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

importData();

