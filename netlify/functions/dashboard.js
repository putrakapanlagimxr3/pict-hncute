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

    const { username, role } = event.queryStringParameters || {};

    try {
        if (role === 'admin') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Hitung income hari ini (simulasi)
            const todayIncome = 0;
            const totalIncome = 0;
            const totalExpense = 0;
            
            // Hitung total users
            const usersUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_users`;
            const usersRes = await fetch(usersUrl, { headers: { 'Content-Type': 'application/json' } });
            const usersData = await usersRes.json();
            const totalUsers = usersData.documents?.length || 0;
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    todayIncome,
                    totalIncome,
                    totalExpense,
                    totalUsers
                })
            };
        } else {
            // User stats
            const paymentUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_settings/payment_${username}`;
            const paymentRes = await fetch(paymentUrl, { headers: { 'Content-Type': 'application/json' } });
            const paymentData = paymentRes.status === 404 ? {} : (await paymentRes.json()).fields || {};
            const balance = paymentData.balance?.integerValue || 0;
            
            const income = 0;
            const templateCount = 0;
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    balance,
                    income,
                    templateCount,
                    popularTemplate: { name: '-' }
                })
            };
        }

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
