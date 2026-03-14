const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// Inisialisasi Firebase Admin SDK
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        });
        console.log("✅ Firebase initialized successfully");
    }
} catch (error) {
    console.error("❌ Firebase init error:", error);
}

const db = admin.firestore();

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

        // Cari user di collection hncute_users
        const usersRef = db.collection('hncute_users');
        const snapshot = await usersRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Username atau password salah' }) };
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Verifikasi password
        const valid = await bcrypt.compare(password, userData.password);
        if (!valid) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Username atau password salah' }) };
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: userDoc.id, 
                username: userData.username, 
                role: userData.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                token,
                role: userData.role,
                username: userData.username,
                email: userData.email
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
