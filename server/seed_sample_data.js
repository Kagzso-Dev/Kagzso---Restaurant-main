require('dotenv').config();
const { pool, connectDB } = require('./config/db');

async function seedData() {
    try {
        await connectDB();
        const conn = await pool.getConnection();
        console.log('--- Starting Seeder ---');

        // Check tables individually
        const [catCountRes] = await conn.query('SELECT COUNT(*) as count FROM categories');
        const [menuCountRes] = await conn.query('SELECT COUNT(*) as count FROM menu_items');
        const [tableCountRes] = await conn.query('SELECT COUNT(*) as count FROM `tables`');
        const [orderCountRes] = await conn.query('SELECT COUNT(*) as count FROM orders');

        const hasCategories = catCountRes[0].count > 0;
        const hasMenuItems = menuCountRes[0].count > 0;
        const hasTables = tableCountRes[0].count > 0;
        const hasOrders = orderCountRes[0].count > 0;

        if (hasCategories && hasMenuItems && hasTables && hasOrders) {
            console.log('All sample data already exists! Skipping seed to avoid duplicates.');
            conn.release();
            process.exit(0);
        }

        // 1. Seed Categories
        if (!hasCategories) {
            console.log('Seeding categories...');
            const categoriesData = [
                ['Starters'],
                ['Main Course'],
                ['Biryani'],
                ['Chinese'],
                ['Beverages'],
                ['Desserts']
            ];
            await conn.query('INSERT INTO categories (name) VALUES ?', [categoriesData]);
        }

        const [categories] = await conn.query('SELECT id, name FROM categories');
        const catMap = {};
        for (const cat of categories) {
            catMap[cat.name] = cat.id;
        }

        // 2. Seed Menu Items
        if (!hasMenuItems && categories.length > 0) {
            console.log('Seeding menu items...');
            const menuData = [
                ['Chicken 65', 250, catMap['Starters'] || categories[0].id, 0],
                ['Paneer Tikka', 200, catMap['Starters'] || categories[0].id, 1],
                ['Butter Chicken', 350, catMap['Main Course'] || categories[0].id, 0],
                ['Veg Fried Rice', 180, catMap['Chinese'] || categories[0].id, 1],
                ['Chicken Biryani', 280, catMap['Biryani'] || categories[0].id, 0],
                ['Tea', 30, catMap['Beverages'] || categories[0].id, 1],
                ['Coffee', 50, catMap['Beverages'] || categories[0].id, 1],
                ['Ice Cream', 80, catMap['Desserts'] || categories[0].id, 1]
            ];
            await conn.query('INSERT INTO menu_items (name, price, category_id, is_veg) VALUES ?', [menuData]);
        }
        
        const [menuItems] = await conn.query('SELECT id, name, price FROM menu_items');

        // 3. Seed Tables
        if (!hasTables) {
            console.log('Seeding tables...');
            const tableRows = Array.from({ length: 10 }, (_, i) => [i + 1, 4]);
            await conn.query('INSERT INTO `tables` (number, capacity) VALUES ?', [tableRows]);
        }
        
        const [tables] = await conn.query('SELECT id FROM `tables`');

        // 4. Seed Orders, 5. Order Items, 6. Payments
        if (!hasOrders && menuItems.length > 0 && tables.length > 0) {
            console.log('Seeding orders, items, and payments...');
            let currentToken = 201;
            
            for (let i = 0; i < 5; i++) {
                const orderType = i % 2 === 0 ? 'dine-in' : 'takeaway';
                const tableId = orderType === 'dine-in' ? tables[0].id : null;
                const customerName = `Guest ${i + 1}`;
                
                // Pick a couple items
                const item1 = menuItems[i % menuItems.length];
                const item2 = menuItems[(i + 1) % menuItems.length];
                
                const totalAmount = Number(item1.price) + Number(item2.price);
                const tax = Math.round(totalAmount * 0.05); // 5% tax
                const discount = 0;
                const finalAmount = totalAmount + tax - discount;
                
                // insert order
                console.log(`Inserting order ORD-${currentToken}...`);
                const [orderResult] = await conn.query(
                    `INSERT INTO orders
                     (order_number, token_number, order_type, table_id, customer_name,
                      order_status, payment_status, total_amount, tax, discount, final_amount)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        `ORD-${currentToken}`, currentToken, orderType, tableId, customerName,
                        'completed', 'paid', totalAmount, tax, discount, finalAmount
                    ]
                );
                
                const orderId = orderResult.insertId;
                console.log(`Order inserted. Order ID generated: ${orderId}`);
                currentToken++;

                // insert items
                for (const item of [item1, item2]) {
                    await conn.query(
                        `INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, status)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [orderId, item.id, item.name, item.price, 1, 'SERVED']
                    );
                }
                console.log(`Items inserted for order ID: ${orderId}`);

                // insert payment
                await conn.query(
                    `INSERT INTO payments (order_id, payment_method, amount, amount_received, change_amount) VALUES (?, ?, ?, ?, ?)`,
                    [orderId, 'cash', finalAmount, finalAmount, 0]
                );
                console.log(`Payment inserted for order ID: ${orderId}`);
            }
        }

        console.log('--- Seeding Process Finished ---');
        
        const [oCount] = await conn.query('SELECT COUNT(*) as c FROM orders');
        const [oiCount] = await conn.query('SELECT COUNT(*) as c FROM order_items');
        const [pCount] = await conn.query('SELECT COUNT(*) as c FROM payments');
        
        console.log('------------------------------');
        console.log('Verification:');
        console.log(`Orders present: ${oCount[0].c}`);
        console.log(`Order Items present: ${oiCount[0].c}`);
        console.log(`Payments present: ${pCount[0].c}`);
        console.log('------------------------------');

        conn.release();
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed with error:', err.message);
        if (err.sql) {
            console.error('Failed SQL Query:', err.sql);
        }
        process.exit(1);
    }
}

seedData();
