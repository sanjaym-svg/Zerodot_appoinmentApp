// ========================================
// Zerodot Salon — Firebase Integration
// Realtime Database sync with localStorage fallback
// ========================================

const FirebaseSync = (() => {
    let db = null;
    let isConnected = false;
    let listeners = {};

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyBwkdU2QLHLER7nE6qST0Jh6TGTOiuTLxg",
        authDomain: "zerodotsaloon-app.firebaseapp.com",
        databaseURL: "https://zerodotsaloon-app-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "zerodotsaloon-app",
        storageBucket: "zerodotsaloon-app.firebasestorage.app",
        messagingSenderId: "345182033048",
        appId: "1:345182033048:web:6b36b658f943825229eced",
        measurementId: "G-Z52MWPQY4P"
    };

    // Initialize Firebase
    function init() {
        try {
            if (typeof firebase === 'undefined') {
                console.warn('Firebase SDK not loaded. Running in offline mode.');
                return false;
            }

            // Check if already initialized
            if (firebase.apps && firebase.apps.length > 0) {
                db = firebase.database();
            } else {
                firebase.initializeApp(FIREBASE_CONFIG);
                db = firebase.database();
            }

            // Monitor connection state
            db.ref('.info/connected').on('value', (snap) => {
                isConnected = snap.val() === true;
                console.log('Firebase connected:', isConnected);
                document.dispatchEvent(new CustomEvent('firebase-status', { detail: { connected: isConnected } }));
            });

            // Enable offline persistence
            firebase.database().goOnline();

            console.log('✅ Firebase initialized successfully');
            return true;
        } catch (err) {
            console.error('Firebase init error:', err);
            return false;
        }
    }

    // ——— Core Read/Write ———
    function getRef(path) {
        if (!db) return null;
        return db.ref('zerodot/' + path);
    }

    // Write data to Firebase + localStorage
    function write(path, data, localKey) {
        // Always write to localStorage first (instant)
        if (localKey) {
            localStorage.setItem(localKey, JSON.stringify(data));
        }
        // Then sync to Firebase
        const ref = getRef(path);
        if (ref) {
            ref.set(data).catch(err => console.error('Firebase write error:', err));
        }
    }

    // Read from Firebase, fallback to localStorage
    function read(path, localKey, fallback) {
        return new Promise((resolve) => {
            // Try localStorage first for speed
            try {
                const local = localStorage.getItem(localKey);
                if (local) {
                    resolve(JSON.parse(local));
                }
            } catch { /* ignore */ }

            // Then try Firebase for latest
            const ref = getRef(path);
            if (ref) {
                ref.once('value').then((snap) => {
                    const val = snap.val();
                    if (val !== null) {
                        // Update localStorage with Firebase data
                        if (localKey) localStorage.setItem(localKey, JSON.stringify(val));
                        resolve(val);
                    } else {
                        // Firebase has no data, use localStorage or fallback
                        try {
                            const local = localStorage.getItem(localKey);
                            const parsed = local ? JSON.parse(local) : fallback;
                            resolve(parsed);
                            // Push local data to Firebase
                            if (parsed && parsed !== fallback) {
                                ref.set(parsed);
                            }
                        } catch { resolve(fallback); }
                    }
                }).catch(() => {
                    // Offline — use localStorage
                    try {
                        const local = localStorage.getItem(localKey);
                        resolve(local ? JSON.parse(local) : fallback);
                    } catch { resolve(fallback); }
                });
            } else {
                // No Firebase — pure localStorage
                try {
                    const local = localStorage.getItem(localKey);
                    resolve(local ? JSON.parse(local) : fallback);
                } catch { resolve(fallback); }
            }
        });
    }

    // Listen for realtime changes
    function listen(path, localKey, callback) {
        const ref = getRef(path);
        if (!ref) return;

        // Remove existing listener
        if (listeners[path]) {
            ref.off('value', listeners[path]);
        }

        listeners[path] = ref.on('value', (snap) => {
            const val = snap.val();
            if (val !== null) {
                // Update localStorage
                if (localKey) localStorage.setItem(localKey, JSON.stringify(val));
                if (callback) callback(val);
            }
        });
    }

    // Stop listening
    function unlisten(path) {
        const ref = getRef(path);
        if (ref && listeners[path]) {
            ref.off('value', listeners[path]);
            delete listeners[path];
        }
    }

    // ——— Migration: Push all localStorage data to Firebase ———
    function migrateToFirebase() {
        if (!db) return { success: false, error: 'Firebase not connected' };

        const keys = {
            'zerodot_appointments': 'appointments',
            'zerodot_settings': 'settings',
            'zerodot_workers': 'workers',
        };

        let count = 0;
        Object.entries(keys).forEach(([localKey, fbPath]) => {
            try {
                const data = localStorage.getItem(localKey);
                if (data) {
                    const parsed = JSON.parse(data);
                    getRef(fbPath).set(parsed);
                    count++;
                }
            } catch (e) {
                console.error(`Migration error for ${localKey}:`, e);
            }
        });

        return { success: true, migrated: count };
    }

    // ——— Status ———
    function getStatus() {
        return {
            initialized: db !== null,
            connected: isConnected,
        };
    }

    return {
        init,
        write,
        read,
        listen,
        unlisten,
        migrateToFirebase,
        getStatus,
        getRef,
    };
})();
