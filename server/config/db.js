const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

/**
 * ─── MySQL Connection Pool ────────────────────────────────────────────────────
 * Features:
 *   • Connection pool (configurable via DB_POOL_SIZE)
 *   • Keep-alive to prevent idle connection drops on Vultr
 *   • UTC timezone for consistent timestamp handling
 */
const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:    parseInt(process.env.DB_POOL_SIZE) || 10,
    queueLimit:         0,
    enableKeepAlive:    true,
    keepAliveInitialDelay: 0,
    timezone:           '+00:00',
    supportBigNumbers:  true,
    bigNumberStrings:   false,
});

const connectDB = async () => {
    try {
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        logger.info('MySQL connected', {
            host:      process.env.DB_HOST,
            database:  process.env.DB_NAME,
            poolLimit: parseInt(process.env.DB_POOL_SIZE) || 10,
        });
    } catch (error) {
        logger.error('MySQL connection failed', {
            error: error.message,
            host:  process.env.DB_HOST,
            db:    process.env.DB_NAME,
        });
        process.exit(1);
    }
};

module.exports = { pool, connectDB };
