const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const FIREBASE_API_KEY = "AIzaSyAgJu3ItKY8ZrFU9tg1Y3sAs28r-GAOxds";

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

        // Login ke Firebase Authentication pake REST API
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: username,
                password: password,
                returnSecureToken: true
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ error: data.error?.message || 'Login gagal' }) 
            };
        }

        const token = jwt.sign(
            { 
                id: data.localId, 
                username: data.email,
                role: 'user' 
            },
            process.env.JWT_SECRET || 'artzzyjago27',
            { expiresIn: '7d' }
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                token,
                role: 'user',
                username: data.email,
                email: data.email
            })
        };

    } catch (error) {
        console.error("Login error:", error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
