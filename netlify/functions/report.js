const fetch = require('node-fetch');

const FIREBASE_PROJECT_ID = "pict-hncute";

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    const { month } = event.queryStringParameters || {};
    
    try {
        const [year, monthNum] = month.split('-').map(Number);
        const startOfMonth = new Date(year, monthNum - 1, 1).getTime();
        const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59).getTime();

        const txUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_transactions`;
        const response = await fetch(txUrl, { headers: { 'Content-Type': 'application/json' } });
        const data = await response.json();
        
        const transactions = (data.documents || []).map(doc => {
            const fields = doc.fields;
            return {
                id: doc.name.split('/').pop(),
                ...fields
            };
        }).filter(tx => {
            const ts = tx.timestamp?.integerValue || 0;
            return ts >= startOfMonth && ts <= endOfMonth;
        });

        const stats = {
            total_income: 0,
            total_expense: 0,
            net_profit: 0,
            voucher_usage: 0
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ transactions, stats })
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
