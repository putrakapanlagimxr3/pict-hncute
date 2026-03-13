const { db } = require('../../firebase/admin');

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
            
            const todayTx = await db.collection('hncute_transactions')
                .where('timestamp', '>=', today.getTime())
                .get();
            
            let todayIncome = 0;
            todayTx.forEach(doc => {
                const tx = doc.data();
                if (tx.type === 'topup') todayIncome += tx.amount;
            });
            
            const allTx = await db.collection('hncute_transactions').get();
            let totalIncome = 0, totalExpense = 0;
            allTx.forEach(doc => {
                const tx = doc.data();
                if (tx.type === 'topup') totalIncome += tx.amount;
                else if (tx.type === 'withdraw') totalExpense += Math.abs(tx.amount);
            });
            
            const usersSnapshot = await db.collection('hncute_users').get();
            const totalUsers = usersSnapshot.size;
            
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
            const paymentDoc = await db.collection('hncute_settings').doc(`payment_${username}`).get();
            const balance = paymentDoc.exists ? paymentDoc.data().balance || 0 : 0;
            
            const userTx = await db.collection('hncute_transactions')
                .where('userId', '==', username)
                .get();
            
            let income = 0;
            userTx.forEach(doc => {
                const tx = doc.data();
                if (tx.type === 'topup') income += tx.amount;
            });
            
            const templatesSnapshot = await db.collection('hncute_templates').get();
            const templateCount = templatesSnapshot.size;
            
            const popularTemplate = { name: '-' };
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    balance,
                    income,
                    templateCount,
                    popularTemplate
                })
            };
        }

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};