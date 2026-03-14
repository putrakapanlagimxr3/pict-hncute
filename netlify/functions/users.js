const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');

const FIREBASE_PROJECT_ID = "pict-hncute";

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
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_users`;

        if (event.httpMethod === 'GET') {
            const response = await fetch(baseUrl, { headers: { 'Content-Type': 'application/json' } });
            const data = await response.json();
            
            const users = (data.documents || []).map(doc => {
                const fields = doc.fields;
                return {
                    id: doc.name.split('/').pop(),
                    username: fields.username?.stringValue,
                    email: fields.email?.stringValue,
                    role: fields.role?.stringValue || 'user'
                };
            });
            
            return { statusCode: 200, headers, body: JSON.stringify(users) };
        }
        
        if (event.httpMethod === 'POST') {
            const { username, email, password } = JSON.parse(event.body);
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const userData = {
                fields: {
                    username: { stringValue: username },
                    email: { stringValue: email },
                    password: { stringValue: hashedPassword },
                    role: { stringValue: 'user' },
                    createdAt: { integerValue: Date.now() }
                }
            };

            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            const result = await response.json();
            
            // Create payment settings
            const paymentUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_settings/payment_${username}`;
            const paymentData = {
                fields: {
                    price: { integerValue: 0 },
                    enable_qris: { booleanValue: false },
                    enable_voucher: { booleanValue: true },
                    balance: { integerValue: 0 },
                    saved_accounts: { arrayValue: { values: [] } }
                }
            };
            
            await fetch(paymentUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paymentData)
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, id: result.name?.split('/').pop() })
            };
        }
        
        if (event.httpMethod === 'DELETE') {
            const { id } = JSON.parse(event.body);
            await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
