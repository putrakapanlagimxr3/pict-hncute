const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../../firebase/admin');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { username, password } = JSON.parse(event.body);
        
        const usersRef = db.collection('hncute_users');
        const snapshot = await usersRef.where('username', '==', username).limit(1).get();
        
        if (snapshot.empty) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Username atau password salah' }) };
        }

        const userDoc = snapshot.docs[0];
        const user = userDoc.data();
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Username atau password salah' }) };
        }

        const token = jwt.sign(
            { id: userDoc.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                token,
                role: user.role,
                username: user.username,
                email: user.email
            })
        };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};