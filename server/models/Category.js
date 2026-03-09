const { pool } = require('../config/db');

const fmt = (row) => row ? {
    _id:         row.id,
    name:        row.name,
    description: row.description,
    color:       row.color,
    status:      row.status,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
} : null;

const Category = {
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
        const [result] = await pool.query(
            'INSERT INTO categories (name, description, color) VALUES (?, ?, ?)',
            [name, description || null, color || '#f97316']
        );
        return this.findById(result.insertId);
    },

    async updateById(id, updates) {
        const allowed = ['name', 'description', 'color', 'status'];
        const setClauses = [];
        const params     = [];
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
