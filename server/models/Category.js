const { pool } = require('../config/db');

const fmt = (row) => row ? {
    _id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
} : null;

const Category = {
    // Returns ALL categories regardless of status — for admin management
    async findAll() {
        const [rows] = await pool.query(
            'SELECT * FROM categories ORDER BY name'
        );
        return rows.map(fmt);
    },

    async findActive() {
        const [rows] = await pool.query(
            "SELECT * FROM categories WHERE status = 'active' ORDER BY name"
        );
        return rows.map(fmt);
    },

    async findById(id) {
        const [rows] = await pool.query(
            'SELECT * FROM categories WHERE id = ? LIMIT 1', [id]
        );
        return fmt(rows[0]);
    },

    async create({ name, description, color }) {
        console.log('[DEBUG] Executing Category.create() with data:', JSON.stringify({ name, description, color }, null, 2));
        try {
            console.log('[DEBUG] Executing INSERT INTO categories');
            const [result] = await pool.query(
                'INSERT INTO categories (name, description, color) VALUES (?, ?, ?)',
                [name, description || null, color || '#f97316']
            );
            console.log(`[DEBUG] Category inserted successfully with ID: ${result.insertId}`);
            return this.findById(result.insertId);
        } catch (error) {
            console.error('[DEBUG] FULL MYSQL ERROR IN CATEGORY INSERT:', error);
            throw error;
        }
    },

    async updateById(id, updates) {
        const allowed = ['name', 'description', 'color', 'status'];
        const setClauses = [];
        const params = [];
        for (const [key, val] of Object.entries(updates)) {
            if (allowed.includes(key)) {
                setClauses.push(`\`${key}\` = ?`);
                params.push(val);
            }
        }
        if (!setClauses.length) return this.findById(id);
        params.push(id);
        await pool.query(
            `UPDATE categories SET ${setClauses.join(', ')} WHERE id = ?`, params
        );
        return this.findById(id);
    },

    async deleteById(id) {
        await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    },
};

module.exports = Category;
