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
        const docRef = db.collection('hncute_settings').doc(`share_${username}`);
        
        if (event.httpMethod === 'GET') {
            const doc = await docRef.get();
            const config = doc.exists ? doc.data() : { enable_qr: true, enable_wa: false, vps_host: '', auth_token: '' };
            return { statusCode: 200, headers, body: JSON.stringify(config) };
        }
        
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            await docRef.set({
                enable_qr: data.enable_qr,
                enable_wa: data.enable_wa,
                vps_host: data.vps_host,
                auth_token: data.auth_token,
                updatedAt: Date.now()
            }, { merge: true });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};