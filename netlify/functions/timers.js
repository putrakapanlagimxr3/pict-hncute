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

    try {
        const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/timers`;

        if (event.httpMethod === 'GET') {
            const response = await fetch(docUrl, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.status === 404) {
                return { statusCode: 200, headers, body: JSON.stringify({ template: 100, booth: 220, edit: 100 }) };
            }
            
            const data = await response.json();
            const fields = data.fields || {};
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    template: fields.template?.integerValue || 100,
                    booth: fields.booth?.integerValue || 220,
                    edit: fields.edit?.integerValue || 100
                })
            };
        }
        
        if (event.httpMethod === 'POST') {
            const { template, booth, edit } = JSON.parse(event.body);
            
            const docData = {
                fields: {
                    template: { integerValue: parseInt(template) },
                    booth: { integerValue: parseInt(booth) },
                    edit: { integerValue: parseInt(edit) }
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
