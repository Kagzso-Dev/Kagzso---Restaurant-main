const { pool }   = require('../config/db');
const Counter    = require('./Counter');

// ─── Row formatters ──────────────────────────────────────────────────────────

const fmtItem = (row) => ({
    _id:          row.id,
    menuItemId:   row.menu_item_id,
    name:         row.name,
    price:        parseFloat(row.price),
    quantity:     row.quantity,
    notes:        row.notes,
    status:       row.status,
    cancelledBy:  row.cancelled_by,
    cancelReason: row.cancel_reason,
    cancelledAt:  row.cancelled_at,
});

const fmtOrder = (row, items = []) => ({
    _id:           row.id,
    orderNumber:   row.order_number,
    tokenNumber:   row.token_number,
    orderType:     row.order_type,
    tableId:       row.table_id
        ? { _id: row.table_id, number: row.table_number !== undefined ? row.table_number : row.table_id }
        : null,
    customerInfo:  { name: row.customer_name || null, phone: row.customer_phone || null },
    items,
    orderStatus:   row.order_status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    kotStatus:     row.kot_status,
    totalAmount:   parseFloat(row.total_amount),
    tax:           parseFloat(row.tax    || 0),
    discount:      parseFloat(row.discount || 0),
    finalAmount:   parseFloat(row.final_amount),
    waiterId:      row.waiter_id,
    prepStartedAt: row.prep_started_at,
    readyAt:       row.ready_at,
    completedAt:   row.completed_at,
    paymentAt:     row.payment_at,
    paidAt:        row.paid_at,
    cancelledBy:   row.cancelled_by,
    cancelReason:  row.cancel_reason,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
});

const loadItems = async (orderId) => {
    const [rows] = await pool.query(
        'SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [orderId]
    );
    return rows.map(fmtItem);
};

// ─── Order model ─────────────────────────────────────────────────────────────

const Order = {

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT o.*, t.number AS table_number
             FROM orders o
             LEFT JOIN \`tables\` t ON o.table_id = t.id
             WHERE o.id = ? LIMIT 1`,
            [id]
        );
        if (!rows.length) return null;
        const items = await loadItems(rows[0].id);
        return fmtOrder(rows[0], items);
    },

    async findOne(conditions) {
        const clauses = [];
        const params  = [];
        for (const [key, val] of Object.entries(conditions)) {
            clauses.push(`o.\`${key}\` = ?`);
            params.push(val);
        }
        const [rows] = await pool.query(
            `SELECT o.*, t.number AS table_number
             FROM orders o
             LEFT JOIN \`tables\` t ON o.table_id = t.id
             WHERE ${clauses.join(' AND ')} LIMIT 1`,
            params
        );
        if (!rows.length) return null;
        const items = await loadItems(rows[0].id);
        return fmtOrder(rows[0], items);
    },

    async find(filter = {}, { skip = 0, limit = 50 } = {}) {
        const { clauses, params } = buildWhere(filter, 'o.');
        let sql = `SELECT o.*, t.number AS table_number
                   FROM orders o
                   LEFT JOIN \`tables\` t ON o.table_id = t.id`;
        if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
        sql += ` ORDER BY o.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(skip)}`;
        const [rows] = await pool.query(sql, params);
        return Promise.all(rows.map(async (row) => {
            const items = await loadItems(row.id);
            return fmtOrder(row, items);
        }));
    },

    async count(filter = {}) {
        const { clauses, params } = buildWhere(filter);
        let sql = 'SELECT COUNT(*) AS cnt FROM orders';
        if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
        const [rows] = await pool.query(sql, params);
        return rows[0].cnt;
    },

    async countAll() {
        const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM orders');
        return rows[0].cnt;
    },

    async create(data) {
        const seq         = await Counter.getNextSequence('tokenNumber_global');
        const orderNumber = `ORD-${seq}`;
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [result] = await conn.query(
                `INSERT INTO orders
                 (order_number, token_number, order_type, table_id,
                  customer_name, customer_phone,
                  total_amount, tax, discount, final_amount, waiter_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderNumber, seq, data.orderType, data.tableId || null,
                    data.customerInfo?.name  || null,
                    data.customerInfo?.phone || null,
                    data.totalAmount, data.tax || 0, data.discount || 0,
                    data.finalAmount, data.waiterId || null,
                ]
            );
            const orderId = result.insertId;
            for (const item of data.items) {
                await conn.query(
                    `INSERT INTO order_items
                     (order_id, menu_item_id, name, price, quantity, notes)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [orderId, item.menuItemId, item.name, item.price,
                     item.quantity, item.notes || null]
                );
            }
            await conn.commit();
            return this.findById(orderId);
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    async updateById(id, updates) {
        const fieldMap = {
            orderStatus:   'order_status',
            paymentStatus: 'payment_status',
            paymentMethod: 'payment_method',
            kotStatus:     'kot_status',
            totalAmount:   'total_amount',
            tax:           'tax',
            discount:      'discount',
            finalAmount:   'final_amount',
            prepStartedAt: 'prep_started_at',
            readyAt:       'ready_at',
            completedAt:   'completed_at',
            paymentAt:     'payment_at',
            paidAt:        'paid_at',
            cancelledBy:   'cancelled_by',
            cancelReason:  'cancel_reason',
        };
        const setClauses = [];
        const params     = [];
        for (const [key, val] of Object.entries(updates)) {
            const col = fieldMap[key] || key;
            setClauses.push(`\`${col}\` = ?`);
            params.push(val === undefined ? null : val);
        }
        if (!setClauses.length) return this.findById(id);
        params.push(id);
        await pool.query(`UPDATE orders SET ${setClauses.join(', ')} WHERE id = ?`, params);
        return this.findById(id);
    },

    async atomicPaymentStatusUpdate(id, fromStatus, toStatus) {
        const [result] = await pool.query(
            'UPDATE orders SET payment_status = ? WHERE id = ? AND payment_status = ?',
            [toStatus, id, fromStatus]
        );
        if (result.affectedRows === 0) return null;
        return this.findById(id);
    },

    async getItemById(orderId, itemId) {
        const [rows] = await pool.query(
            'SELECT * FROM order_items WHERE id = ? AND order_id = ? LIMIT 1',
            [itemId, orderId]
        );
        return rows[0] ? fmtItem(rows[0]) : null;
    },

    async updateItemStatus(orderId, itemId, status) {
        await pool.query(
            'UPDATE order_items SET status = ? WHERE id = ? AND order_id = ?',
            [status, itemId, orderId]
        );
        return this.findById(orderId);
    },

    async cancelItem(orderId, itemId, { cancelledBy, cancelReason }) {
        await pool.query(
            `UPDATE order_items
             SET status = 'CANCELLED', cancelled_by = ?, cancel_reason = ?, cancelled_at = NOW()
             WHERE id = ? AND order_id = ?`,
            [cancelledBy, cancelReason, itemId, orderId]
        );
        return this.findById(orderId);
    },

    async search(q, limit = 30) {
        const like = `%${q}%`;
        const [rows] = await pool.query(
            `SELECT o.*, t.number AS table_number
             FROM orders o
             LEFT JOIN \`tables\` t ON o.table_id = t.id
             WHERE o.order_number    LIKE ?
                OR o.customer_name   LIKE ?
                OR CAST(t.number AS CHAR) LIKE ?
             ORDER BY o.created_at DESC
             LIMIT ?`,
            [like, like, like, limit]
        );
        return Promise.all(rows.map(async (row) => {
            const items = await loadItems(row.id);
            return fmtOrder(row, items);
        }));
    },
};

// ─── WHERE clause builder ─────────────────────────────────────────────────────
function buildWhere(filter, prefix = '') {
    const clauses = [];
    const params  = [];
    if (filter.kotStatus !== undefined) {
        if (filter.kotStatus && typeof filter.kotStatus === 'object' && filter.kotStatus.$ne) {
            clauses.push(`${prefix}kot_status != ?`);
            params.push(filter.kotStatus.$ne);
        } else if (filter.kotStatus) {
            clauses.push(`${prefix}kot_status = ?`);
            params.push(filter.kotStatus);
        }
    }
    if (filter.orderStatus !== undefined) {
        if (filter.orderStatus && typeof filter.orderStatus === 'object' && filter.orderStatus.$in) {
            const phs = filter.orderStatus.$in.map(() => '?').join(',');
            clauses.push(`${prefix}order_status IN (${phs})`);
            params.push(...filter.orderStatus.$in);
        } else if (filter.orderStatus) {
            clauses.push(`${prefix}order_status = ?`);
            params.push(filter.orderStatus);
        }
    }
    if (filter.paymentStatus) {
        clauses.push(`${prefix}payment_status = ?`);
        params.push(filter.paymentStatus);
    }
    return { clauses, params };
}

module.exports = Order;
