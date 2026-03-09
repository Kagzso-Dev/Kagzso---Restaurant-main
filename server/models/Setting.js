const { pool } = require('../config/db');

const fmt = (row) => row ? {
    _id:            row.id,
    restaurantName: row.restaurant_name,
    currency:       row.currency,
    currencySymbol: row.currency_symbol,
    taxRate:        parseFloat(row.tax_rate),
    gstNumber:      row.gst_number,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
} : null;

const Setting = {
    // Get settings row, auto-creating defaults if none exist
    async get() {
        const [rows] = await pool.query('SELECT * FROM settings LIMIT 1');
        if (rows.length) return fmt(rows[0]);

        // Auto-initialize defaults
        const [result] = await pool.query(
            `INSERT INTO settings
             (restaurant_name, currency, currency_symbol, tax_rate, gst_number)
             VALUES (?, ?, ?, ?, ?)`,
            ['My Restaurant', 'USD', '$', 5.00, '']
        );
        const [newRows] = await pool.query(
            'SELECT * FROM settings WHERE id = ?', [result.insertId]
        );
        return fmt(newRows[0]);
    },

    async update({ restaurantName, currency, currencySymbol, taxRate, gstNumber }) {
        const current = await this.get(); // ensures row exists
        const setClauses = [];
        const params     = [];

        if (restaurantName  !== undefined) { setClauses.push('restaurant_name = ?');  params.push(restaurantName);  }
        if (currency        !== undefined) { setClauses.push('currency = ?');          params.push(currency);        }
        if (currencySymbol  !== undefined) { setClauses.push('currency_symbol = ?');   params.push(currencySymbol);  }
        if (taxRate         !== undefined) { setClauses.push('tax_rate = ?');          params.push(taxRate);         }
        if (gstNumber       !== undefined) { setClauses.push('gst_number = ?');        params.push(gstNumber);       }

        if (!setClauses.length) return this.get();

        params.push(current._id);
        await pool.query(`UPDATE settings SET ${setClauses.join(', ')} WHERE id = ?`, params);
        return this.get();
    },
};

module.exports = Setting;
