const fetch = require('node-fetch');

const FIREBASE_PROJECT_ID = "pict-hncute";

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
        const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_settings/payment_${username}`;
        const couponsUrl = `${docUrl}/coupons`;

        if (event.httpMethod === 'GET') {
            const docRes = await fetch(docUrl, { headers: { 'Content-Type': 'application/json' } });
            const config = docRes.status === 404 ? {} : (await docRes.json()).fields || {};
            
            const couponsRes = await fetch(couponsUrl, { headers: { 'Content-Type': 'application/json' } });
            const couponsData = await couponsRes.json();
            
            const coupons = (couponsData.documents || []).map(doc => {
                const fields = doc.fields;
                return {
                    code: doc.name.split('/').pop(),
                    type: fields.type?.stringValue,
                    value: fields.value?.integerValue,
                    limit: fields.limit?.integerValue,
                    used_count: fields.used_count?.integerValue || 0
                };
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ config, coupons })
            };
        }
        
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            
            if (data.action === 'update_config') {
                const docData = {
                    fields: {
                        price: { integerValue: parseInt(data.price) || 0 },
                        enable_qris: { booleanValue: data.enable_qris },
                        enable_voucher: { booleanValue: data.enable_voucher },
                        updatedAt: { integerValue: Date.now() }
                    }
                };
                await fetch(docUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(docData) });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            
            if (data.action === 'add_coupon') {
                const couponData = {
                    fields: {
                        code: { stringValue: data.code.toUpperCase() },
                        type: { stringValue: data.type },
                        value: { integerValue: parseInt(data.value) || 0 },
                        limit: { integerValue: parseInt(data.limit) || 1 },
                        used_count: { integerValue: 0 },
                        createdAt: { integerValue: Date.now() }
                    }
                };
                await fetch(`${couponsUrl}/${data.code.toUpperCase()}`, { 
                    method: 'PATCH', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(couponData) 
                });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            
            if (data.action === 'delete_coupon') {
                await fetch(`${couponsUrl}/${data.code}`, { method: 'DELETE' });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
