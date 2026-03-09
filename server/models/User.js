const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

const fmt = (row) => row ? {
    _id:       row.id,
    username:  row.username,
    password:  row.password,
    role:      row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
} : null;

const User = {
    async findOne({ username }) {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE username = ? LIMIT 1', [username]
        );
        return fmt(rows[0]);
    },

    async findById(id, excludePassword = false) {
        const cols = excludePassword
            ? 'id, username, role, created_at, updated_at'
            : '*';
        const [rows] = await pool.query(
            `SELECT ${cols} FROM users WHERE id = ? LIMIT 1`, [id]
        );
        return fmt(rows[0]);
    },

    async findByRole(role) {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE role = ? LIMIT 1', [role]
        );
        return fmt(rows[0]);
    },

    async usernameExists(username) {
        const [rows] = await pool.query(
            'SELECT id FROM users WHERE username = ? LIMIT 1', [username]
        );
        return rows.length > 0;
    },

    async create({ username, password, role }) {
        const salt   = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);
        const [result] = await pool.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashed, role]
        );
        return { _id: result.insertId, username, role };
    },

    async updatePassword(id, newPassword) {
        const salt   = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
    },
};

module.exports = User;
