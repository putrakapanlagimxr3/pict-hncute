const { db } = require('../../firebase/admin');

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
        if (event.httpMethod === 'GET') {
            let query = db.collection('hncute_transactions').orderBy('timestamp', 'desc');
            if (username) {
                query = query.where('userId', '==', username);
            }
            const snapshot = await query.get();
            const transactions = [];
            snapshot.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
            return { statusCode: 200, headers, body: JSON.stringify(transactions) };
        }
        
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            
            const transaction = {
                userId: data.username,
                type: 'withdraw',
                amount: -Math.abs(parseInt(data.amount)),
                method: data.method,
                account: data.account,
                status: 'pending',
                timestamp: Date.now()
            };
            
            const docRef = await db.collection('hncute_transactions').add(transaction);
            
            const paymentRef = db.collection('hncute_settings').doc(`payment_${data.username}`);
            await paymentRef.update({
                balance: admin.firestore.FieldValue.increment(-Math.abs(parseInt(data.amount)))
            });
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: docRef.id }) };
        }
        
        if (event.httpMethod === 'PUT') {
            const data = JSON.parse(event.body);
            await db.collection('hncute_transactions').doc(data.id).update({
                status: data.status
            });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};