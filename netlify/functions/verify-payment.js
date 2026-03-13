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

    try {
        const data = JSON.parse(event.body);
        
        if (data.type === 'check_coupon') {
            const couponRef = db.collection('hncute_settings')
                .doc(`payment_${data.creator}`)
                .collection('coupons')
                .doc(data.code.toUpperCase());
                
            const couponDoc = await couponRef.get();
            
            if (!couponDoc.exists) {
                return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Invalid coupon' }) };
            }
            
            const coupon = couponDoc.data();
            
            if (coupon.used_count >= coupon.limit) {
                return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Coupon usage limit exceeded' }) };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, coupon })
            };
        }
        
        if (data.type === 'coupon') {
            const couponRef = db.collection('hncute_settings')
                .doc(`payment_${data.creator}`)
                .collection('coupons')
                .doc(data.code.toUpperCase());
                
            await couponRef.update({
                used_count: admin.firestore.FieldValue.increment(1)
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }
        
        if (data.type === 'qris') {
            // Simulate payment check (in production, integrate with payment gateway)
            const random = Math.random();
            const success = random > 0.3;
            
            if (success) {
                const paymentRef = db.collection('hncute_settings').doc(`payment_${data.creator}`);
                await paymentRef.update({
                    balance: admin.firestore.FieldValue.increment(data.amount)
                });
                
                await db.collection('hncute_transactions').add({
                    userId: data.creator,
                    type: 'topup',
                    amount: data.amount,
                    status: 'success',
                    timestamp: Date.now(),
                    method: 'qris'
                });
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request type' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};