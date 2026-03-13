// Firebase config buat client
const firebaseConfig = {
    apiKey: "AIzaSyD3xoMfpgP-NpReXRtNde1iLYFTscS5MrI", // Ganti punya lo
    authDomain: "pict-hncute.firebaseapp.com",
    projectId: "pict-hncute",
    storageBucket: "pict-hncute.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}