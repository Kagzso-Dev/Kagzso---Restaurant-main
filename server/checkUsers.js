const dotenv = require('dotenv');
dotenv.config();

const { pool, connectDB } = require('./config/db');

const checkUsers = async () => {
    try {
        await connectDB();
        const [users] = await pool.query('SELECT id, username, role, created_at FROM users');
        console.log('Current Users in DB:');
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkUsers();
