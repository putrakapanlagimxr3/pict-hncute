const { db } = require('../../firebase/admin');

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
        if (event.httpMethod === 'GET') {
            const { all, tag, page = 1, limit = 20 } = event.queryStringParameters;
            
            let collection = type === 'template' ? 'hncute_templates' : 'hncute_stickers';
            let query = db.collection(collection);
            
            if (tag && tag !== 'All' && type === 'template') {
                query = query.where('tags', 'array-contains', tag);
            }
            
            query = query.orderBy('createdAt', 'desc');
            
            const startAt = (parseInt(page) - 1) * parseInt(limit);
            const snapshot = await query.limit(parseInt(limit)).offset(startAt).get();
            
            const items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });
            
            return { statusCode: 200, headers, body: JSON.stringify(items) };
        }
        
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            const collection = type === 'template' ? 'hncute_templates' : 'hncute_stickers';
            
            const docRef = await db.collection(collection).add({
                ...data,
                createdAt: Date.now(),
                usageCount: 0
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, id: docRef.id })
            };
        }
        
        if (event.httpMethod === 'DELETE') {
            const { id } = JSON.parse(event.body);
            const collection = type === 'template' ? 'hncute_templates' : 'hncute_stickers';
            
            await db.collection(collection).doc(id).delete();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};