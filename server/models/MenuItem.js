const { pool } = require('../config/db');

// Formats a row that may include joined category columns (cat_*)
const fmt = (row) => row ? {
    _id: row.id,
    name: row.name,
    description: row.description,
    price: parseFloat(row.price),
    category: row.cat_id
        ? { _id: row.cat_id, name: row.cat_name, color: row.cat_color, status: row.cat_status }
        : row.category_id,
    image: row.image,
    availability: row.availability === 1 || row.availability === true,
    isVeg: row.is_veg === 1 || row.is_veg === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
} : null;

const MenuItem = {
    // Returns ALL items (including unavailable) with category details — for admin management
    async findAll() {
        const [rows] = await pool.query(`
            SELECT m.*,
                   c.id     AS cat_id,
                   c.name   AS cat_name,
                   c.color  AS cat_color,
                   c.status AS cat_status
            FROM menu_items m
            LEFT JOIN categories c ON m.category_id = c.id
            ORDER BY m.name
        `);
        return rows.map(fmt);
    },

    // Returns only available items with category details — for ordering/waiter views
    async findAvailable() {
        const [rows] = await pool.query(`
            SELECT m.*,
                   c.id     AS cat_id,
                   c.name   AS cat_name,
                   c.color  AS cat_color,
                   c.status AS cat_status
            FROM menu_items m
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE m.availability = 1
            ORDER BY m.name
        `);
        return rows.map(fmt);
    },

    async findById(id) {
        const [rows] = await pool.query(`
            SELECT m.*,
                   c.id     AS cat_id,
                   c.name   AS cat_name,
                   c.color  AS cat_color,
                   c.status AS cat_status
            FROM menu_items m
            LEFT JOIN categories c ON m.category_id = c.id
            WHERE m.id = ? LIMIT 1
        `, [id]);
        if (!rows[0]) return null;
        return fmt(rows[0]);
    },

    async create({ name, description, price, category, image, isVeg }) {
        console.log('[DEBUG] Executing MenuItem.create() with data:', JSON.stringify({ name, description, price, category, image, isVeg }, null, 2));
        try {
            console.log('[DEBUG] Executing INSERT INTO menu_items');
            const [result] = await pool.query(
                'INSERT INTO menu_items (name, description, price, category_id, image, is_veg) VALUES (?, ?, ?, ?, ?, ?)',
                [name, description || null, price, category, image || null, isVeg !== false ? 1 : 0]
            );
            console.log(`[DEBUG] MenuItem inserted successfully with ID: ${result.insertId}`);
            return this.findById(result.insertId);
        } catch (error) {
            console.error('[DEBUG] FULL MYSQL ERROR IN MENU INSERT:', error);
            throw error;
        }
    },

    async updateById(id, updates) {
        const fieldMap = {
            name: 'name', description: 'description', price: 'price',
            category: 'category_id', image: 'image',
            availability: 'availability', isVeg: 'is_veg',
        };
        const setClauses = [];
        const params = [];
        for (const [key, val] of Object.entries(updates)) {
            if (key in fieldMap) {
                setClauses.push(`\`${fieldMap[key]}\` = ?`);
                params.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
            }
        }
        if (!setClauses.length) return this.findById(id);
        params.push(id);
        await pool.query(
            `UPDATE menu_items SET ${setClauses.join(', ')} WHERE id = ?`, params
        );
        return this.findById(id);
    },

    async deleteById(id) {
        await pool.query('DELETE FROM menu_items WHERE id = ?', [id]);
    },
};

module.exports = MenuItem;
