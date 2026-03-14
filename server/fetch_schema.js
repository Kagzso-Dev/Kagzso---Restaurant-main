require('dotenv').config();
const { pool } = require('./config/db');
(async () => {
    try {
        const [rows] = await pool.query('DESCRIBE orders');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
