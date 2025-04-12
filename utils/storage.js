// Simple wrapper for chrome.storage.local
const storage = {
    get: (keys) => {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (result) => {
                resolve(result);
            });
        });
    },
    set: (items) => {
        return new Promise((resolve) => {
            chrome.storage.local.set(items, () => {
                resolve();
            });
        });
    },
    remove: (keys) => {
        return new Promise((resolve) => {
            chrome.storage.local.remove(keys, () => {
                resolve();
            });
        });
    },
    clear: () => {
        return new Promise((resolve) => {
            chrome.storage.local.clear(() => {
                resolve();
            });
        });
    }
    // --- PRO FEATURE: Firebase Sync Logic (Placeholder) ---
    // This would need integration with firebase-config.js and auth.js
    // and would conditionally use Firestore if logged in & pro enabled.
    // getFirebase: async (key) => { /* ... */ },
    // setFirebase: async (key, value) => { /* ... */ },
};

// --- PRO FEATURE CHECK --- (needs proFeatures.js)
// Example how other modules might use it:
// async function exampleUsage() {
//    const isPro = await proFeatures.isProUser();
//    if (isPro && userIsLoggedIn) { // Assuming login check
//       await storage.setFirebase('someKey', { data: '...' });
//    } else {
//       await storage.set({ someKey: { data: '...' } });
//    }
// }