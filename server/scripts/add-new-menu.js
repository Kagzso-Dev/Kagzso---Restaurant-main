const dotenv = require('dotenv');
dotenv.config();

const { pool, connectDB } = require('./config/db');

const menuToAdd = [
    {
        category: 'Starters',
        items: [
            { name: 'Chicken 65', price: 220, is_veg: 0 },
            { name: 'Paneer Tikka', price: 250, is_veg: 1 },
            { name: 'Gobi Manchurian', price: 180, is_veg: 1 },
            { name: 'Chilli Chicken', price: 240, is_veg: 0 }
        ]
    },
    {
        category: 'Main Course',
        items: [
            { name: 'Butter Chicken', price: 320, is_veg: 0 },
            { name: 'Paneer Butter Masala', price: 280, is_veg: 1 },
            { name: 'Dal Tadka', price: 200, is_veg: 1 },
            { name: 'Veg Korma', price: 220, is_veg: 1 }
        ]
    },
    {
        category: 'Biryani',
        items: [
            { name: 'Chicken Biryani', price: 280, is_veg: 0 },
            { name: 'Mutton Biryani', price: 380, is_veg: 0 },
            { name: 'Veg Biryani', price: 220, is_veg: 1 },
            { name: 'Egg Biryani', price: 240, is_veg: 0 }
        ]
    },
    {
        category: 'South Indian',
        items: [
            { name: 'Masala Dosa', price: 120, is_veg: 1 },
            { name: 'Idli', price: 60, is_veg: 1 },
            { name: 'Vada', price: 70, is_veg: 1 },
            { name: 'Pongal', price: 100, is_veg: 1 }
        ]
    },
    {
        category: 'Chinese',
        items: [
            { name: 'Veg Fried Rice', price: 180, is_veg: 1 },
            { name: 'Chicken Fried Rice', price: 220, is_veg: 0 },
            { name: 'Hakka Noodles', price: 170, is_veg: 1 },
            { name: 'Schezwan Noodles', price: 190, is_veg: 1 }
        ]
    },
    {
        category: 'Beverages',
        items: [
            { name: 'Tea', price: 30, is_veg: 1 },
            { name: 'Coffee', price: 40, is_veg: 1 },
            { name: 'Fresh Lime Juice', price: 60, is_veg: 1 },
            { name: 'Soft Drinks', price: 50, is_veg: 1 }
        ]
    },
    {
        category: 'Desserts',
        items: [
            { name: 'Gulab Jamun', price: 80, is_veg: 1 },
            { name: 'Ice Cream', price: 100, is_veg: 1 },
            { name: 'Rasmalai', price: 120, is_veg: 1 },
            { name: 'Carrot Halwa', price: 140, is_veg: 1 }
        ]
    }
];

const addNewMenu = async () => {
    try {
        await connectDB();
        const conn = await pool.getConnection();

        for (const catData of menuToAdd) {
            // Check if category exists
            const [existingCat] = await conn.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [catData.category]);
            let catId;

            if (existingCat.length > 0) {
                catId = existingCat[0].id;
                console.log(`Category "${catData.category}" already exists (ID: ${catId})`);
            } else {
                const [insCat] = await conn.query('INSERT INTO categories (name, description) VALUES (?, ?)', [catData.category, catData.category]);
                catId = insCat.insertId;
                console.log(`Created new category "${catData.category}" (ID: ${catId})`);
            }

            for (const item of catData.items) {
                // Check if item already exists to avoid duplicates
                const [existingItem] = await conn.query('SELECT id FROM menu_items WHERE name = ? LIMIT 1', [item.name]);
                if (existingItem.length === 0) {
                    await conn.query(
                        'INSERT INTO menu_items (name, price, category_id, is_veg, availability) VALUES (?, ?, ?, ?, 1)',
                        [item.name, item.price, catId, item.is_veg]
                    );
                    console.log(` - Added item: ${item.name}`);
                } else {
                    console.log(` - Item "${item.name}" already exists, skipping.`);
                }
            }
        }

        conn.release();
        console.log('\nMenu update completed successfully! All data is live and existing items/categories were preserved.');
        process.exit(0);

    } catch (error) {
        console.error('Error adding menu:', error.message);
        process.exit(1);
    }
};

addNewMenu();
