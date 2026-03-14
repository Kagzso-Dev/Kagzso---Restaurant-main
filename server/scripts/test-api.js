const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:5005/api';

async function runTrace() {
    console.log('=== STARTING RUNTIME TRACE ===');

    // 1. Authenticate to get Token
    console.log('\n[1] Authenticating as Admin...');
    let token = '';
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'password' // We will try 'admin123' if this fails
        });
        token = loginRes.data.token;
        console.log('✅ Auth success! Token received.');
    } catch (err) {
        try {
            console.log('Trying alternative password...');
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                username: 'admin',
                password: 'password123'
            });
            token = loginRes.data.token;
            console.log('✅ Auth success! Token received.');
        } catch (e) {
            console.error('❌ Auth failed. Cannot proceed with trace.', e.message);
            return;
        }
    }

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Create Category
    console.log('\n[2] Testing Category Creation...');
    let catId = null;
    try {
        const catRes = await axios.post(`${API_URL}/categories`, {
            name: `Trace Category ${Date.now()}`,
            description: 'Automated Trace Test',
            color: '#ff0000'
        }, { headers });
        catId = catRes.data._id;
        console.log(`✅ Category created in MySQL! ID: ${catId}`);
    } catch (err) {
        console.error('❌ Category creation failed:', err.response?.data || err.message);
    }

    // 3. Create Menu Item
    console.log('\n[3] Testing Menu Item Creation...');
    let itemId = null;
    let itemPrice = 150;
    try {
        const itemRes = await axios.post(`${API_URL}/menu`, {
            name: `Trace Item ${Date.now()}`,
            description: 'Delicious automation',
            price: itemPrice,
            category: catId,
            isVeg: true
        }, { headers });
        itemId = itemRes.data._id;
        console.log(`✅ Menu Item created in MySQL! ID: ${itemId}`);
    } catch (err) {
        console.error('❌ Menu Item creation failed:', err.response?.data || err.message);
    }

    // 4. Create Order
    console.log('\n[4] Testing Order Creation & Order Items Transaction...');
    try {
        const orderRes = await axios.post(`${API_URL}/orders`, {
            orderType: 'takeaway',
            customerInfo: { name: 'Trace Bot', phone: '0000000' },
            items: [
                {
                    menuItemId: itemId,
                    name: 'Trace Item',
                    price: itemPrice,
                    quantity: 2,
                    notes: 'No spicy'
                }
            ],
            totalAmount: itemPrice * 2,
            tax: 15,
            discount: 0,
            finalAmount: (itemPrice * 2) + 15
        }, { headers });
        console.log(`✅ Order executing atomic transaction success! Order ID: ${orderRes.data._id}`);
    } catch (err) {
        console.error('❌ Order creation failed:', err.response?.data || err.message);
    }

    console.log('\n=== TRACE COMPLETE - CHECK SERVER TERMINAL FOR MYSQL LOGS ===');
}

runTrace();
