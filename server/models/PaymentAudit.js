const { pool } = require('../config/db');

/**
 * PaymentAudit — append-only audit trail for all payment lifecycle events.
 * Replaces MongoDB PaymentAudit collection.
 */
const PaymentAudit = {
    async create({
        orderId,
        paymentId,
        action,
        status,
        amount,
        paymentMethod,
        transactionId,
        performedBy,
        performedByRole,
        ipAddress,
        userAgent,
        errorMessage,
        errorCode,
        metadata,
    }) {
        await pool.query(
            `INSERT INTO payment_audits
             (order_id, payment_id, action, status, amount, payment_method, transaction_id,
              performed_by, performed_by_role, ip_address, user_agent,
              error_message, error_code, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderId       || null,
                paymentId     || null,
                action,
                status,
                amount        || null,
                paymentMethod || null,
                transactionId || null,
                performedBy   || null,
                performedByRole || null,
                ipAddress     || null,
                userAgent     || null,
                errorMessage  || null,
                errorCode     || null,
                metadata ? JSON.stringify(metadata) : null,
            ]
        );
    },
};

module.exports = PaymentAudit;
