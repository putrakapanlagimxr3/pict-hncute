const fetch = require('node-fetch');

const FIREBASE_PROJECT_ID = "pict-hncute";

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    const { username } = event.queryStringParameters || {};

    try {
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_transactions`;

        if (event.httpMethod === 'GET') {
            let url = baseUrl;
            if (username) {
                url += `?filter=userId%3D%3D"${username}"`;
            }
            
            const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
            const data = await response.json();
            
            const transactions = (data.documents || []).map(doc => {
                const fields = doc.fields;
                return {
                    id: doc.name.split('/').pop(),
                    userId: fields.userId?.stringValue,
                    type: fields.type?.stringValue,
                    amount: fields.amount?.integerValue,
                    method: fields.method?.stringValue,
                    account: fields.account?.stringValue,
                    status: fields.status?.stringValue,
                    timestamp: fields.timestamp?.integerValue
                };
            });
            
            return { statusCode: 200, headers, body: JSON.stringify(transactions) };
        }
        
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            
            const transaction = {
                fields: {
                    userId: { stringValue: data.username },
                    type: { stringValue: 'withdraw' },
                    amount: { integerValue: -Math.abs(parseInt(data.amount)) },
                    method: { stringValue: data.method },
                    account: { stringValue: data.account },
                    status: { stringValue: 'pending' },
                    timestamp: { integerValue: Date.now() }
                }
            };

            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transaction)
            });
            
            const result = await response.json();
            
            // Update balance
            const paymentUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_settings/payment_${data.username}`;
            const paymentRes = await fetch(paymentUrl, { headers: { 'Content-Type': 'application/json' } });
            const paymentData = await paymentRes.json();
            const currentBalance = paymentData.fields?.balance?.integerValue || 0;
            
            const balanceData = {
                fields: {
                    balance: { integerValue: currentBalance - Math.abs(parseInt(data.amount)) }
                }
            };
            
            await fetch(paymentUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(balanceData)
            });
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: result.name?.split('/').pop() }) };
        }
        
        if (event.httpMethod === 'PUT') {
            const data = JSON.parse(event.body);
            const docUrl = `${baseUrl}/${data.id}`;
            
            await fetch(docUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: { status: { stringValue: data.status } } })
            });
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
