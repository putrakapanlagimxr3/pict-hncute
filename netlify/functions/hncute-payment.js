const { db } = require('../../firebase/admin');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    const { username } = event.queryStringParameters || {};
    if (!username) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username required' }) };
    }

    try {
        const docRef = db.collection('hncute_settings').doc(`payment_${username}`);
        
        if (event.httpMethod === 'GET') {
            const doc = await docRef.get();
            const config = doc.exists ? doc.data() : { price: 0, enable_qris: false, enable_voucher: true, balance: 0, saved_accounts: [] };
            
            const couponsSnapshot = await docRef.collection('coupons').get();
            const coupons = [];
            couponsSnapshot.forEach(doc => coupons.push({ id: doc.id, ...doc.data() }));
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ config, coupons })
            };
        }
        
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            
            if (data.action === 'update_config') {
                await docRef.set({
                    price: parseInt(data.price) || 0,
                    enable_qris: data.enable_qris,
                    enable_voucher: data.enable_voucher,
                    updatedAt: Date.now()
                }, { merge: true });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            
            if (data.action === 'add_coupon') {
                await docRef.collection('coupons').doc(data.code.toUpperCase()).set({
                    code: data.code.toUpperCase(),
                    type: data.type,
                    value: parseInt(data.value) || 0,
                    limit: parseInt(data.limit) || 1,
                    used_count: 0,
                    createdAt: Date.now()
                });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            
            if (data.action === 'delete_coupon') {
                await docRef.collection('coupons').doc(data.code).delete();
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            
            if (data.action === 'add_account') {
                const accounts = (await docRef.get()).data()?.saved_accounts || [];
                const newAccount = {
                    id: Date.now().toString(),
                    type: data.type,
                    provider: data.provider,
                    number: data.number,
                    name: data.name
                };
                accounts.push(newAccount);
                await docRef.set({ saved_accounts: accounts }, { merge: true });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            
            if (data.action === 'delete_account') {
                const doc = await docRef.get();
                const accounts = doc.data()?.saved_accounts || [];
                const filtered = accounts.filter(a => a.id !== data.id);
                await docRef.set({ saved_accounts: filtered }, { merge: true });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};