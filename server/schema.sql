-- ============================================================
-- Kagzso Restaurant POS — MySQL Schema  (v2)
-- Compatible with MySQL 5.7+ / MariaDB 10.3+
--
-- Run once on a fresh database:
--   mysql -u posuser -p kagzso_pos < schema.sql
--
-- Safe to re-run on an existing database:
--   • All CREATE TABLE use IF NOT EXISTS
--   • ALTER TABLE statements are wrapped in stored procedures
--     that check IF the change is still needed
-- ============================================================

CREATE DATABASE IF NOT EXISTS kagzso_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kagzso_pos;

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    username     VARCHAR(100)    NOT NULL,
    password     VARCHAR(255)    NOT NULL,
    role         ENUM('admin','waiter','kitchen','cashier') NOT NULL,
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Categories ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name         VARCHAR(150)    NOT NULL,
    description  TEXT,
    color        VARCHAR(20)     NOT NULL DEFAULT '#f97316',
    status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Menu Items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
    id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name         VARCHAR(200)    NOT NULL,
    description  TEXT,
    price        DECIMAL(10,2)   NOT NULL,
    category_id  INT UNSIGNED    NOT NULL,
    image        VARCHAR(500),
    availability TINYINT(1)      NOT NULL DEFAULT 1,
    is_veg       TINYINT(1)      NOT NULL DEFAULT 1,
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_availability_category (availability, category_id),
    CONSTRAINT fk_menu_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Tables (Restaurant Seating) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tables` (
    id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    number           INT             NOT NULL,
    capacity         INT             NOT NULL,
    status           ENUM('available','reserved','occupied','billing','cleaning') NOT NULL DEFAULT 'available',
    current_order_id INT UNSIGNED    DEFAULT NULL,
    locked_by        INT UNSIGNED    DEFAULT NULL,
    reserved_at      TIMESTAMP       NULL DEFAULT NULL,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_table_number (number),
    KEY idx_status_reserved (status, reserved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Orders ──────────────────────────────────────────────────────────────────
-- NOTE: payment_method includes 'online' for Razorpay/webhook payments
CREATE TABLE IF NOT EXISTS orders (
    id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_number     VARCHAR(50)     NOT NULL,
    token_number     INT UNSIGNED    NOT NULL,
    order_type       ENUM('dine-in','takeaway') NOT NULL,
    table_id         INT UNSIGNED    DEFAULT NULL,
    customer_name    VARCHAR(100),
    customer_phone   VARCHAR(20),
    order_status     ENUM('pending','accepted','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
    payment_status   ENUM('pending','payment_pending','paid') NOT NULL DEFAULT 'pending',
    payment_method   ENUM('cash','qr','upi','credit_card','online') DEFAULT NULL,
    kot_status       ENUM('Open','Closed') NOT NULL DEFAULT 'Open',
    total_amount     DECIMAL(10,2)   NOT NULL,
    tax              DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    discount         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    final_amount     DECIMAL(10,2)   NOT NULL,
    waiter_id        INT UNSIGNED    DEFAULT NULL,
    prep_started_at  TIMESTAMP       NULL DEFAULT NULL,
    ready_at         TIMESTAMP       NULL DEFAULT NULL,
    completed_at     TIMESTAMP       NULL DEFAULT NULL,
    payment_at       TIMESTAMP       NULL DEFAULT NULL,
    paid_at          TIMESTAMP       NULL DEFAULT NULL,
    cancelled_by     ENUM('WAITER','KITCHEN','ADMIN') DEFAULT NULL,
    cancel_reason    VARCHAR(500),
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_order_status (order_status),
    KEY idx_payment_status_created (payment_status, created_at),
    KEY idx_table_id (table_id),
    KEY idx_waiter_created (waiter_id, created_at),
    KEY idx_kot_status (kot_status),
    KEY idx_order_number (order_number),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Order Items (replaces Mongoose embedded subdocument array) ───────────────
CREATE TABLE IF NOT EXISTS order_items (
    id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_id     INT UNSIGNED    NOT NULL,
    menu_item_id INT UNSIGNED    NOT NULL,
    name         VARCHAR(200)    NOT NULL,
    price        DECIMAL(10,2)   NOT NULL,
    quantity     INT             NOT NULL DEFAULT 1,
    notes        TEXT,
    status       ENUM('PENDING','PREPARING','READY','SERVED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    cancelled_by ENUM('WAITER','KITCHEN','ADMIN') DEFAULT NULL,
    cancel_reason VARCHAR(500),
    cancelled_at TIMESTAMP       NULL DEFAULT NULL,
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_order_id (order_id),
    CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_id         INT UNSIGNED    NOT NULL,
    payment_method   ENUM('cash','qr','upi','credit_card','online') NOT NULL,
    transaction_id   VARCHAR(200)    DEFAULT NULL,
    amount           DECIMAL(10,2)   NOT NULL,
    amount_received  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    `change`         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    cashier_id       INT UNSIGNED    DEFAULT NULL,
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_order_payment (order_id),
    KEY idx_payment_created (created_at),
    KEY idx_payment_method (payment_method),
    CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Payment Audit Trail (append-only) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_audits (
    id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_id          INT UNSIGNED    NOT NULL,
    payment_id        INT UNSIGNED    DEFAULT NULL,
    action            ENUM('PAYMENT_INITIATED','PAYMENT_PROCESSED','PAYMENT_FAILED',
                           'PAYMENT_CANCELLED','PAYMENT_REFUNDED','PAYMENT_VERIFIED',
                           'STATUS_CHANGE') NOT NULL,
    status            ENUM('success','failed','pending') NOT NULL,
    amount            DECIMAL(10,2)   DEFAULT NULL,
    payment_method    VARCHAR(50)     DEFAULT NULL,
    transaction_id    VARCHAR(200)    DEFAULT NULL,
    performed_by      INT UNSIGNED    DEFAULT NULL,
    performed_by_role ENUM('cashier','admin') DEFAULT NULL,
    ip_address        VARCHAR(45)     DEFAULT NULL,
    user_agent        VARCHAR(500)    DEFAULT NULL,
    error_message     TEXT,
    error_code        VARCHAR(50)     DEFAULT NULL,
    metadata          JSON,
    created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_action_created (action, created_at),
    KEY idx_audit_order_created (order_id, created_at),
    KEY idx_audit_performer (performed_by, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    title          VARCHAR(200)    NOT NULL,
    message        VARCHAR(500)    NOT NULL,
    type           ENUM('NEW_ORDER','ORDER_READY','PAYMENT_SUCCESS','ORDER_CANCELLED',
                        'OFFER_ANNOUNCEMENT','SYSTEM_ALERT') NOT NULL,
    role_target    ENUM('kitchen','admin','waiter','cashier','all') NOT NULL,
    reference_id   INT UNSIGNED    DEFAULT NULL,
    reference_type ENUM('order','payment','offer') DEFAULT NULL,
    is_read        TINYINT(1)      NOT NULL DEFAULT 0,
    created_by     INT UNSIGNED    DEFAULT NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notif_role_created (role_target, created_at),
    KEY idx_notif_type_ref (type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Notification Reads (replaces MongoDB 'readBy' embedded array) ────────────
CREATE TABLE IF NOT EXISTS notification_reads (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    notification_id INT UNSIGNED    NOT NULL,
    user_id         INT UNSIGNED    NOT NULL,
    read_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_notif_user (notification_id, user_id),
    CONSTRAINT fk_read_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Settings (single-row restaurant config) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    restaurant_name  VARCHAR(200)    NOT NULL DEFAULT 'My Restaurant',
    currency         VARCHAR(10)     NOT NULL DEFAULT 'USD',
    currency_symbol  VARCHAR(10)     NOT NULL DEFAULT '$',
    tax_rate         DECIMAL(5,2)    NOT NULL DEFAULT 5.00,
    gst_number       VARCHAR(100)    NOT NULL DEFAULT '',
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Counters (auto-increment sequences) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS counters (
    id             VARCHAR(100)    NOT NULL,
    sequence_value INT UNSIGNED    NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Daily Analytics Cache ────────────────────────────────────────────────────
-- Pre-aggregated per-day revenue snapshot. Updated nightly or on-demand.
-- Avoids running heavy aggregations on the orders table for dashboard queries.
CREATE TABLE IF NOT EXISTS daily_analytics (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    date            DATE            NOT NULL,
    total_orders    INT UNSIGNED    NOT NULL DEFAULT 0,
    completed_orders INT UNSIGNED   NOT NULL DEFAULT 0,
    cancelled_orders INT UNSIGNED   NOT NULL DEFAULT 0,
    total_revenue   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    avg_order_value DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    dine_in_orders  INT UNSIGNED    NOT NULL DEFAULT 0,
    takeaway_orders INT UNSIGNED    NOT NULL DEFAULT 0,
    cash_revenue    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    digital_revenue DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_date (date),
    KEY idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Seed Data ────────────────────────────────────────────────────────────────
-- Initial counter row for order token numbering
INSERT IGNORE INTO counters (id, sequence_value) VALUES ('tokenNumber_global', 0);

-- Default restaurant settings (auto-created on first API call too, but seeding avoids the latency)
INSERT IGNORE INTO settings (id, restaurant_name, currency, currency_symbol, tax_rate, gst_number)
VALUES (1, 'KAGSZO Restaurant', 'INR', '₹', 5.00, '');

-- ─── Safe Migrations for Existing Installations ──────────────────────────────
-- These ALTER statements add new values/columns to existing tables without
-- breaking anything. Safe to run repeatedly (errors are silently ignored by
-- wrapping in stored procedures with IF column doesn't exist checks).

-- Add 'online' to orders.payment_method ENUM if not already present
-- MySQL does not support IF NOT EXISTS for ALTER TABLE MODIFY, so we use
-- a procedure that checks the INFORMATION_SCHEMA first.
DROP PROCEDURE IF EXISTS sp_migrate_orders_payment_method;
DELIMITER $$
CREATE PROCEDURE sp_migrate_orders_payment_method()
BEGIN
    DECLARE col_def TEXT;
    SELECT COLUMN_TYPE INTO col_def
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'orders'
      AND COLUMN_NAME  = 'payment_method'
    LIMIT 1;

    -- Only run ALTER if 'online' is not already in the ENUM
    IF col_def IS NOT NULL AND LOCATE('online', col_def) = 0 THEN
        ALTER TABLE orders
            MODIFY COLUMN payment_method
            ENUM('cash','qr','upi','credit_card','online') DEFAULT NULL;
    END IF;
END$$
DELIMITER ;
CALL sp_migrate_orders_payment_method();
DROP PROCEDURE IF EXISTS sp_migrate_orders_payment_method;

-- Add 'ADMIN' to order_items.cancelled_by ENUM if not already present
DROP PROCEDURE IF EXISTS sp_migrate_items_cancelled_by;
DELIMITER $$
CREATE PROCEDURE sp_migrate_items_cancelled_by()
BEGIN
    DECLARE col_def TEXT;
    SELECT COLUMN_TYPE INTO col_def
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'order_items'
      AND COLUMN_NAME  = 'cancelled_by'
    LIMIT 1;

    IF col_def IS NOT NULL AND LOCATE('ADMIN', col_def) = 0 THEN
        ALTER TABLE order_items
            MODIFY COLUMN cancelled_by
            ENUM('WAITER','KITCHEN','ADMIN') DEFAULT NULL;
    END IF;
END$$
DELIMITER ;
CALL sp_migrate_items_cancelled_by();
DROP PROCEDURE IF EXISTS sp_migrate_items_cancelled_by;
