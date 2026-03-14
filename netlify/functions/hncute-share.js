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
        const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_settings/share_${username}`;

        if (event.httpMethod === 'GET') {
            const response = await fetch(docUrl, { headers: { 'Content-Type': 'application/json' } });
            const data = response.status === 404 ? {} : (await response.json()).fields || {};
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    enable_qr: data.enable_qr?.booleanValue ?? true,
                    enable_wa: data.enable_wa?.booleanValue ?? false,
                    vps_host: data.vps_host?.stringValue || '',
                    auth_token: data.auth_token?.stringValue || ''
                })
            };
        }
        
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            
            const docData = {
                fields: {
                    enable_qr: { booleanValue: data.enable_qr },
                    enable_wa: { booleanValue: data.enable_wa },
                    vps_host: { stringValue: data.vps_host || '' },
                    auth_token: { stringValue: data.auth_token || '' },
                    updatedAt: { integerValue: Date.now() }
                }
            };

            await fetch(docUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docData)
            });
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
