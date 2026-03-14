const fetch = require('node-fetch');

const FIREBASE_API_KEY = "AIzaSyAgJu3ItKY8ZrFU9tg1Y3sAs28r-GAOxds";
const FIREBASE_PROJECT_ID = "pict-hncute";

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    const { type } = event.queryStringParameters || {};

    if (!type || !['template', 'sticker'].includes(type)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid type' }) };
    }

    try {
        const collection = type === 'template' ? 'templates' : 'stickers';
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?key=${FIREBASE_API_KEY}`;

        if (event.httpMethod === 'GET') {
            const { page = 1, limit = 20 } = event.queryStringParameters;
            
            const response = await fetch(`${baseUrl}&pageSize=${limit}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.error) {
                return { statusCode: 429, headers, body: JSON.stringify({ error: data.error.message }) };
            }
            
            const items = (data.documents || []).map(doc => {
                const fields = doc.fields;
                return {
                    id: doc.name.split('/').pop(),
                    name: fields.name?.stringValue || '',
                    src: fields.src?.stringValue || '',
                    pose: fields.pose?.integerValue || 6,
                    tags: fields.tags?.arrayValue?.values?.map(v => v.stringValue) || [],
                    creator: fields.creator?.stringValue || '',
                    createdAt: fields.createdAt?.integerValue || 0
                };
            });

            return { statusCode: 200, headers, body: JSON.stringify(items) };
        }
        
        // ... sisanya sama, tapi tambahin ?key=... di setiap URL

    } catch (error) {
        console.error("Content error:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
