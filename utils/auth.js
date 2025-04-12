// Requires firebase-config.js to be loaded and initialized

// Assuming Firebase v9+ modular SDK and 'auth' is exported from firebase-config.js
// import {
//    signInAnonymously,
//    onAuthStateChanged,
//    createUserWithEmailAndPassword,
//    signInWithEmailAndPassword,
//    signOut,
//    GoogleAuthProvider,
//    signInWithPopup
// } from "firebase/auth";
// import { auth } from './firebase-config.js'; // Adjust path if needed

const authManager = {
    currentUser: null,
    authListenerUnsubscribe: null,

    init: () => {
        // if (!auth) {
        //     console.error("Firebase Auth not initialized.");
        //     return;
        // }
        // console.log("Initializing Auth Manager...");
        // // Listen for authentication state changes
        // authManager.authListenerUnsubscribe = onAuthStateChanged(auth, (user) => {
        //     if (user) {
        //         // User is signed in, see docs for a list of available properties
        //         // https://firebase.google.com/docs/reference/js/firebase.User
        //         console.log("User signed in:", user.uid, "Anonymous:", user.isAnonymous);
        //         authManager.currentUser = user;
        //         // TODO: Trigger UI updates, potentially load user-specific data/settings
        //         // TODO: Sync Pro status from Firebase if needed
        //     } else {
        //         // User is signed out
        //         console.log("User signed out.");
        //         authManager.currentUser = null;
        //         // TODO: Trigger UI updates for signed-out state
        //         // Optionally sign in anonymously automatically?
        //         // authManager.signInAnon();
        //     }
        // });
         console.log("Auth Manager Initialized (Placeholder - Implement Firebase Auth Calls)");
    },

    getCurrentUser: () => {
        // return auth ? auth.currentUser : null; // Direct access
         return authManager.currentUser; // Return cached user from listener
    },

    signInAnon: async () => {
        // if (!auth) return null;
        // try {
        //     const userCredential = await signInAnonymously(auth);
        //     console.log("Signed in anonymously:", userCredential.user.uid);
        //     return userCredential.user;
        // } catch (error) {
        //     console.error("Anonymous sign-in error:", error.code, error.message);
        //     return null;
        // }
        console.warn("signInAnon: Firebase Auth not implemented.");
        return null;
    },

    signInEmail: async (email, password) => {
        // if (!auth) return null;
        // try {
        //     const userCredential = await signInWithEmailAndPassword(auth, email, password);
        //     console.log("Signed in with email:", userCredential.user.uid);
        //     return { user: userCredential.user, error: null };
        // } catch (error) {
        //     console.error("Email sign-in error:", error.code, error.message);
        //     return { user: null, error: error };
        // }
        console.warn("signInEmail: Firebase Auth not implemented.");
        return { user: null, error: { message: "Not Implemented"} };
    },

    signUpEmail: async (email, password) => {
         // if (!auth) return null;
         // try {
         //     const userCredential = await createUserWithEmailAndPassword(auth, email, password);
         //     console.log("Signed up with email:", userCredential.user.uid);
         //     return { user: userCredential.user, error: null };
         // } catch (error) {
         //     console.error("Email sign-up error:", error.code, error.message);
         //     return { user: null, error: error };
         // }
         console.warn("signUpEmail: Firebase Auth not implemented.");
         return { user: null, error: { message: "Not Implemented"} };
     },

     signInGoogle: async () => {
        // if (!auth) return null;
        // const provider = new GoogleAuthProvider();
        // // Optionally add scopes for Google Tasks API access
        // provider.addScope('https://www.googleapis.com/auth/tasks');
        // try {
        //     const result = await signInWithPopup(auth, provider);
        //     // This gives you a Google Access Token. You can use it to access the Google API.
        //     const credential = GoogleAuthProvider.credentialFromResult(result);
        //     const token = credential.accessToken; // <<< Use this for Google API calls
        //     const user = result.user;
        //     console.log("Signed in with Google:", user.uid);
        //      // Store token securely if needed for background API calls (e.g., in chrome.storage.session)
        //      await chrome.storage.session.set({ googleAuthToken: token }); // Use session storage
        //     return { user, token, error: null };
        // } catch (error) {
        //     console.error("Google sign-in error:", error.code, error.message);
        //     // Handle specific errors like popup blocked, account exists with different credential, etc.
        //     const credential = error.credential; // The email of the user's account used.
        //     return { user: null, token: null, error };
        // }
         console.warn("signInGoogle: Firebase/Google Auth not implemented.");
          return { user: null, token: null, error: { message: "Not Implemented"} };
    },


    signOutUser: async () => {
        // if (!auth) return;
        // try {
        //     await signOut(auth);
        //     console.log("User signed out successfully.");
        //      await chrome.storage.session.remove('googleAuthToken'); // Clear token on sign out
        // } catch (error) {
        //     console.error("Sign out error:", error);
        // }
        console.warn("signOutUser: Firebase Auth not implemented.");
    },

    // Clean up listener when background script unloads (if applicable)
    cleanup: () => {
        if (authManager.authListenerUnsubscribe) {
            authManager.authListenerUnsubscribe();
            console.log("Auth state listener removed.");
        }
    }
};

// Initialize auth manager (e.g., call authManager.init() in background.js or popup.js)
// authManager.init();