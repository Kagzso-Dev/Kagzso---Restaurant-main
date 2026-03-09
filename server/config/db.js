const mysql  = require('mysql2/promise');
const logger = require('../utils/logger');

/**
 * ─── MySQL Connection Pool ────────────────────────────────────────────────────
 * Features:
 *   • Connection pool (configurable via DB_POOL_SIZE)
 *   • Keep-alive to prevent idle connection drops on Vultr
 *   • UTC timezone for consistent timestamp handling
 *   • ensureSchema() — auto-creates missing tables on startup so
 *     the server never crashes with "Table X doesn't exist"
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
    multipleStatements: false,  // keep false for security; DDL runs through ensureSchema
});

// ─── Minimal DDL for each required table ─────────────────────────────────────
// Only CREATE TABLE IF NOT EXISTS — never destructive.
// Must be topologically sorted (no FK forward references).
const REQUIRED_TABLES = [
    {
        name: 'users',
        ddl: `CREATE TABLE IF NOT EXISTS users (
            id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
            username   VARCHAR(100) NOT NULL,
            password   VARCHAR(255) NOT NULL,
            role       ENUM('admin','waiter','kitchen','cashier') NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'categories',
        ddl: `CREATE TABLE IF NOT EXISTS categories (
            id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
            name        VARCHAR(150) NOT NULL,
            description TEXT,
            color       VARCHAR(20)  NOT NULL DEFAULT '#f97316',
            status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
            created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_category_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'menu_items',
        ddl: `CREATE TABLE IF NOT EXISTS menu_items (
            id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
            name         VARCHAR(200)  NOT NULL,
            description  TEXT,
            price        DECIMAL(10,2) NOT NULL,
            category_id  INT UNSIGNED  NOT NULL,
            image        VARCHAR(500),
            availability TINYINT(1)   NOT NULL DEFAULT 1,
            is_veg       TINYINT(1)   NOT NULL DEFAULT 1,
            created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_avail_cat (availability, category_id),
            CONSTRAINT fk_menu_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'tables',
        ddl: `CREATE TABLE IF NOT EXISTS \`tables\` (
            id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
            number           INT          NOT NULL,
            capacity         INT          NOT NULL,
            status           ENUM('available','reserved','occupied','billing','cleaning') NOT NULL DEFAULT 'available',
            current_order_id INT UNSIGNED DEFAULT NULL,
            locked_by        INT UNSIGNED DEFAULT NULL,
            reserved_at      TIMESTAMP NULL DEFAULT NULL,
            created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_table_number (number),
            KEY idx_status_reserved (status, reserved_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'orders',
        ddl: `CREATE TABLE IF NOT EXISTS orders (
            id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_number     VARCHAR(50)  NOT NULL,
            token_number     INT UNSIGNED NOT NULL,
            order_type       ENUM('dine-in','takeaway') NOT NULL,
            table_id         INT UNSIGNED DEFAULT NULL,
            customer_name    VARCHAR(100),
            customer_phone   VARCHAR(20),
            order_status     ENUM('pending','accepted','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
            payment_status   ENUM('pending','payment_pending','paid') NOT NULL DEFAULT 'pending',
            payment_method   ENUM('cash','qr','upi','credit_card','online') DEFAULT NULL,
            kot_status       ENUM('Open','Closed') NOT NULL DEFAULT 'Open',
            total_amount     DECIMAL(10,2) NOT NULL,
            tax              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            discount         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            final_amount     DECIMAL(10,2) NOT NULL,
            waiter_id        INT UNSIGNED DEFAULT NULL,
            prep_started_at  TIMESTAMP NULL DEFAULT NULL,
            ready_at         TIMESTAMP NULL DEFAULT NULL,
            completed_at     TIMESTAMP NULL DEFAULT NULL,
            payment_at       TIMESTAMP NULL DEFAULT NULL,
            paid_at          TIMESTAMP NULL DEFAULT NULL,
            cancelled_by     ENUM('WAITER','KITCHEN','ADMIN') DEFAULT NULL,
            cancel_reason    VARCHAR(500),
            created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_order_status   (order_status),
            KEY idx_pay_status_ts  (payment_status, created_at),
            KEY idx_table_id       (table_id),
            KEY idx_waiter_ts      (waiter_id, created_at),
            KEY idx_kot_status     (kot_status),
            KEY idx_order_number   (order_number),
            KEY idx_created_at     (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'order_items',
        ddl: `CREATE TABLE IF NOT EXISTS order_items (
            id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_id     INT UNSIGNED NOT NULL,
            menu_item_id INT UNSIGNED NOT NULL,
            name         VARCHAR(200) NOT NULL,
            price        DECIMAL(10,2) NOT NULL,
            quantity     INT NOT NULL DEFAULT 1,
            notes        TEXT,
            status       ENUM('PENDING','PREPARING','READY','SERVED','CANCELLED') NOT NULL DEFAULT 'PENDING',
            cancelled_by ENUM('WAITER','KITCHEN','ADMIN') DEFAULT NULL,
            cancel_reason VARCHAR(500),
            cancelled_at TIMESTAMP NULL DEFAULT NULL,
            created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_order_id (order_id),
            CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'payments',
        ddl: `CREATE TABLE IF NOT EXISTS payments (
            id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_id        INT UNSIGNED NOT NULL,
            payment_method  ENUM('cash','qr','upi','credit_card','online') NOT NULL,
            transaction_id  VARCHAR(200) DEFAULT NULL,
            amount          DECIMAL(10,2) NOT NULL,
            amount_received DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            \`change\`      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            cashier_id      INT UNSIGNED DEFAULT NULL,
            created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_order_payment (order_id),
            KEY idx_pay_created (created_at),
            KEY idx_pay_method  (payment_method),
            CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'payment_audits',
        ddl: `CREATE TABLE IF NOT EXISTS payment_audits (
            id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_id          INT UNSIGNED NOT NULL,
            payment_id        INT UNSIGNED DEFAULT NULL,
            action            ENUM('PAYMENT_INITIATED','PAYMENT_PROCESSED','PAYMENT_FAILED',
                                   'PAYMENT_CANCELLED','PAYMENT_REFUNDED','PAYMENT_VERIFIED',
                                   'STATUS_CHANGE') NOT NULL,
            status            ENUM('success','failed','pending') NOT NULL,
            amount            DECIMAL(10,2) DEFAULT NULL,
            payment_method    VARCHAR(50)   DEFAULT NULL,
            transaction_id    VARCHAR(200)  DEFAULT NULL,
            performed_by      INT UNSIGNED  DEFAULT NULL,
            performed_by_role ENUM('cashier','admin') DEFAULT NULL,
            ip_address        VARCHAR(45)   DEFAULT NULL,
            user_agent        VARCHAR(500)  DEFAULT NULL,
            error_message     TEXT,
            error_code        VARCHAR(50)   DEFAULT NULL,
            metadata          JSON,
            created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_audit_action  (action, created_at),
            KEY idx_audit_order   (order_id, created_at),
            KEY idx_audit_by      (performed_by, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'notifications',
        ddl: `CREATE TABLE IF NOT EXISTS notifications (
            id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
            title          VARCHAR(200) NOT NULL,
            message        VARCHAR(500) NOT NULL,
            type           ENUM('NEW_ORDER','ORDER_READY','PAYMENT_SUCCESS','ORDER_CANCELLED',
                                'OFFER_ANNOUNCEMENT','SYSTEM_ALERT') NOT NULL,
            role_target    ENUM('kitchen','admin','waiter','cashier','all') NOT NULL,
            reference_id   INT UNSIGNED DEFAULT NULL,
            reference_type ENUM('order','payment','offer') DEFAULT NULL,
            is_read        TINYINT(1)   NOT NULL DEFAULT 0,
            created_by     INT UNSIGNED DEFAULT NULL,
            created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_notif_role (role_target, created_at),
            KEY idx_notif_ref  (type, reference_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'notification_reads',
        ddl: `CREATE TABLE IF NOT EXISTS notification_reads (
            id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
            notification_id INT UNSIGNED NOT NULL,
            user_id         INT UNSIGNED NOT NULL,
            read_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_notif_user (notification_id, user_id),
            CONSTRAINT fk_read_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'settings',
        ddl: `CREATE TABLE IF NOT EXISTS settings (
            id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
            restaurant_name VARCHAR(200) NOT NULL DEFAULT 'My Restaurant',
            currency        VARCHAR(10)  NOT NULL DEFAULT 'INR',
            currency_symbol VARCHAR(10)  NOT NULL DEFAULT '₹',
            tax_rate        DECIMAL(5,2) NOT NULL DEFAULT 5.00,
            gst_number      VARCHAR(100) NOT NULL DEFAULT '',
            created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'counters',
        ddl: `CREATE TABLE IF NOT EXISTS counters (
            id             VARCHAR(100) NOT NULL,
            sequence_value INT UNSIGNED NOT NULL DEFAULT 0,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
    {
        name: 'daily_analytics',
        ddl: `CREATE TABLE IF NOT EXISTS daily_analytics (
            id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
            date             DATE         NOT NULL,
            total_orders     INT UNSIGNED NOT NULL DEFAULT 0,
            completed_orders INT UNSIGNED NOT NULL DEFAULT 0,
            cancelled_orders INT UNSIGNED NOT NULL DEFAULT 0,
            total_revenue    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            avg_order_value  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            dine_in_orders   INT UNSIGNED NOT NULL DEFAULT 0,
            takeaway_orders  INT UNSIGNED NOT NULL DEFAULT 0,
            cash_revenue     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            digital_revenue  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_date (date),
            KEY idx_date (date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    },
];

/**
 * Verifies every required table exists and creates missing ones.
 * Called once during server startup — never touches existing data.
 */
const ensureSchema = async () => {
    const conn = await pool.getConnection();
    try {
        // Get list of existing tables
        const [rows] = await conn.query(
            'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()'
        );
        const existing = new Set(rows.map(r => r.TABLE_NAME.toLowerCase()));

        let created = 0;
        for (const { name, ddl } of REQUIRED_TABLES) {
            if (!existing.has(name.toLowerCase())) {
                logger.warn(`Table "${name}" missing — creating now...`);
                await conn.query(ddl);
                logger.info(`Table "${name}" created successfully`);
                created++;
            }
        }

        // Seed essential rows that must exist
        await conn.query(
            `INSERT IGNORE INTO counters (id, sequence_value) VALUES ('tokenNumber_global', 0)`
        );
        await conn.query(
            `INSERT IGNORE INTO settings (id, restaurant_name, currency, currency_symbol, tax_rate, gst_number)
             VALUES (1, 'KAGSZO Restaurant', 'INR', '₹', 5.00, '')`
        );

        if (created > 0) {
            logger.info(`Schema check complete — ${created} table(s) auto-created`);
        } else {
            logger.info('Schema check complete — all tables present');
        }
    } finally {
        conn.release();
    }
};

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

        // Auto-create any missing tables — prevents "Table X doesn't exist" crashes
        await ensureSchema();
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
