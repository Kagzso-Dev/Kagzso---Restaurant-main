const { pool } = require('../config/db');

const fmt = (row) => row ? {
    _id:            row.id,
    orderId:        row.order_id,
    paymentMethod:  row.payment_method,
    transactionId:  row.transaction_id,
    amount:         parseFloat(row.amount),
    amountReceived: parseFloat(row.amount_received),
    change:         parseFloat(row.change || 0),
    // When joined with users table, cashierId is an object; otherwise just the ID
    cashierId:      row.cashier_username
        ? { _id: row.cashier_id, username: row.cashier_username, role: row.cashier_role }
        : row.cashier_id,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
} : null;

const Payment = {
    async findByOrderId(orderId) {
        const [rows] = await pool.query(
            'SELECT * FROM payments WHERE order_id = ? LIMIT 1', [orderId]
        );
        return fmt(rows[0]);
    },

    // Returns payment with cashier details populated (for GET payment endpoint)
    async findByOrderIdWithCashier(orderId) {
        const [rows] = await pool.query(
            `SELECT p.*, u.username AS cashier_username, u.role AS cashier_role
             FROM payments p
             LEFT JOIN users u ON p.cashier_id = u.id
             WHERE p.order_id = ? LIMIT 1`,
            [orderId]
        );
        return fmt(rows[0]);
    },

    async create({ orderId, paymentMethod, transactionId, amount, amountReceived, change, cashierId }) {
        const [result] = await pool.query(
            `INSERT INTO payments
             (order_id, payment_method, transaction_id, amount, amount_received, \`change\`, cashier_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                orderId,
                paymentMethod,
                transactionId || null,
                amount,
                amountReceived || 0,
                change || 0,
                cashierId || null,
            ]
        );
        const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [result.insertId]);
        return fmt(rows[0]);
    },
};

module.exports = Payment;
