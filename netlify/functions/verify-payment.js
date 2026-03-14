const fetch = require('node-fetch');

const FIREBASE_PROJECT_ID = "pict-hncute";

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
            const couponUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_settings/payment_${data.creator}/coupons/${data.code.toUpperCase()}`;
            
            const response = await fetch(couponUrl, { headers: { 'Content-Type': 'application/json' } });
            
            if (response.status === 404) {
                return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Invalid coupon' }) };
            }
            
            const couponData = await response.json();
            const fields = couponData.fields || {};
            
            if (fields.used_count?.integerValue >= fields.limit?.integerValue) {
                return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Coupon usage limit exceeded' }) };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    coupon: {
                        type: fields.type?.stringValue,
                        value: fields.value?.integerValue
                    }
                })
            };
        }
        
        if (data.type === 'coupon') {
            const couponUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_settings/payment_${data.creator}/coupons/${data.code.toUpperCase()}`;
            
            const response = await fetch(couponUrl, { headers: { 'Content-Type': 'application/json' } });
            const couponData = await response.json();
            const currentUsed = couponData.fields?.used_count?.integerValue || 0;
            
            const updateData = {
                fields: {
                    used_count: { integerValue: currentUsed + 1 }
                }
            };
            
            await fetch(couponUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        if (data.type === 'qris') {
            // Simulate payment success
            const success = Math.random() > 0.3;
            
            if (success) {
                const paymentUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_settings/payment_${data.creator}`;
                
                const paymentRes = await fetch(paymentUrl, { headers: { 'Content-Type': 'application/json' } });
                const paymentData = await paymentRes.json();
                const currentBalance = paymentData.fields?.balance?.integerValue || 0;
                
                const updateData = {
                    fields: {
                        balance: { integerValue: currentBalance + data.amount }
                    }
                };
                
                await fetch(paymentUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                
                // Add transaction
                const txUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/hncute_transactions`;
                const txData = {
                    fields: {
                        userId: { stringValue: data.creator },
                        type: { stringValue: 'topup' },
                        amount: { integerValue: data.amount },
                        status: { stringValue: 'success' },
                        timestamp: { integerValue: Date.now() },
                        method: { stringValue: 'qris' }
                    }
                };
                
                await fetch(txUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(txData)
                });
            }
            
            return { statusCode: 200, headers, body: JSON.stringify({ success }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request type' }) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
