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

    try {
        if (event.httpMethod === 'GET') {
            const doc = await db.collection('hncute_settings').doc('timers').get();
            const timers = doc.exists ? doc.data() : { template: 100, booth: 220, edit: 100 };
            
            return { statusCode: 200, headers, body: JSON.stringify(timers) };
        }
        
        if (event.httpMethod === 'POST') {
            const { template, booth, edit } = JSON.parse(event.body);
            
            await db.collection('hncute_settings').doc('timers').set({
                template: parseInt(template),
                booth: parseInt(booth),
                edit: parseInt(edit)
            });
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};