const bcrypt = require('bcryptjs');
const { db } = require('../../firebase/admin');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        if (event.httpMethod === 'GET') {
            const snapshot = await db.collection('hncute_users').get();
            const users = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                users.push({
                    id: doc.id,
                    username: data.username,
                    email: data.email,
                    role: data.role
                });
            });
            return { statusCode: 200, headers, body: JSON.stringify(users) };
        }
        
        if (event.httpMethod === 'POST') {
            const { username, email, password } = JSON.parse(event.body);
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const userData = {
                username,
                email,
                password: hashedPassword,
                role: 'user',
                createdAt: Date.now()
            };
            
            const docRef = await db.collection('hncute_users').add(userData);
            
            await db.collection('hncute_settings').doc(`payment_${username}`).set({
                price: 0,
                enable_qris: false,
                enable_voucher: true,
                balance: 0,
                saved_accounts: []
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, id: docRef.id })
            };
        }
        
        if (event.httpMethod === 'DELETE') {
            const { id } = JSON.parse(event.body);
            await db.collection('hncute_users').doc(id).delete();
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};