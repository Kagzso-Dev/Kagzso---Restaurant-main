const dotenv = require('dotenv');
dotenv.config();

const { pool, connectDB } = require('./config/db');

const addFoods = async () => {
    try {
        await connectDB();
        const conn = await pool.getConnection();

        console.log('Adding new categories...');
        const newCategories = [
            ['Burgers & Fast Food', 'Quick bites and burgers'],
            ['Pizzas', 'Wood-fired oven pizzas'],
            ['Desserts', 'Sweet treats and ice creams']
        ];

        let catIds = [];
        for (const cat of newCategories) {
            const [res] = await conn.query('INSERT INTO categories (name, description) VALUES (?, ?)', cat);
            catIds.push(res.insertId);
        }

        console.log('Adding new menu items...');
        const newMenuItems = [
            ['Classic Smash Burger', 180, catIds[0], 0, 1],
            ['Crispy Veg Burger', 150, catIds[0], 1, 1],
            ['French Fries (Salted)', 90, catIds[0], 1, 1],
            ['Peri Peri Fries', 120, catIds[0], 1, 1],
            ['Margherita Pizza', 250, catIds[1], 1, 1],
            ['Pepperoni Pizza', 350, catIds[1], 0, 1],
            ['Farmhouse Veg Pizza', 300, catIds[1], 1, 1],
            ['BBQ Chicken Pizza', 380, catIds[1], 0, 1],
            ['Chocolate Lava Cake', 130, catIds[2], 1, 1],
            ['Vanilla Ice Cream', 90, catIds[2], 1, 1],
            ['Brownie with Ice Cream', 160, catIds[2], 1, 1],
            ['Cheesecake Slice', 200, catIds[2], 1, 1],
        ];

        const [existingCats] = await conn.query('SELECT id FROM categories WHERE name = "Main Course" LIMIT 1');
        if (existingCats.length > 0) {
            const mainCourseId = existingCats[0].id;
            newMenuItems.push(
                ['Garlic Naan', 60, mainCourseId, 1, 1],
                ['Butter Roti', 40, mainCourseId, 1, 1],
                ['Jeera Rice', 120, mainCourseId, 1, 1],
                ['Chicken Biryani', 350, mainCourseId, 0, 1],
                ['Mutton Rogan Josh', 450, mainCourseId, 0, 1]
            );
        }

        for (const item of newMenuItems) {
            await conn.query('INSERT INTO menu_items (name, price, category_id, is_veg, availability) VALUES (?, ?, ?, ?, ?)', item);
        }

        conn.release();
        console.log('New food categories and items added successfully! Existing data was preserved.');
        process.exit(0);

    } catch (error) {
        console.error('Error adding foods:', error.message);
        process.exit(1);
    }
};

addFoods();
