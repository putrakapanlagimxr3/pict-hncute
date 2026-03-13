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

    const { month } = event.queryStringParameters || {};
    
    try {
        const [year, monthNum] = month.split('-').map(Number);
        const startOfMonth = new Date(year, monthNum - 1, 1).getTime();
        const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59).getTime();

        const snapshot = await db.collection('hncute_transactions')
            .where('timestamp', '>=', startOfMonth)
            .where('timestamp', '<=', endOfMonth)
            .orderBy('timestamp', 'desc')
            .get();

        const transactions = [];
        let totalIncome = 0, totalExpense = 0, voucherUsage = 0;

        snapshot.forEach(doc => {
            const tx = { id: doc.id, ...doc.data() };
            transactions.push(tx);
            
            if (tx.type === 'topup') {
                totalIncome += tx.amount;
            } else if (tx.type === 'withdraw') {
                totalExpense += Math.abs(tx.amount);
            } else if (tx.type === 'voucher') {
                voucherUsage++;
            }
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                transactions,
                stats: {
                    total_income: totalIncome,
                    total_expense: totalExpense,
                    net_profit: totalIncome - totalExpense,
                    voucher_usage: voucherUsage
                }
            })
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};