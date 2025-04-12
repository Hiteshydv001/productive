const proFeatures = {
    isPro: false,
    // --- Stripe Configuration (REPLACE WITH YOUR KEYS) ---
    // IMPORTANT: For security, the price ID and triggering Checkout
    // should ideally be handled by a secure backend (e.g., Firebase Function).
    // This client-side example is simplified.
    stripePublicKey: 'pk_test_YOUR_PUBLIC_KEY', // Replace with your Stripe Public Key
    stripePriceId: 'price_YOUR_PRICE_ID',     // Replace with your Stripe Price ID for the $2 product

    init: async () => {
        // Check local storage first for the pro flag
        const data = await storage.get({ proEnabled: false });
        proFeatures.isPro = data.proEnabled || false;
        console.log("Pro Status Initialized:", proFeatures.isPro);

        // --- PRO FEATURE: Firebase Auth Check (If using cloud sync) ---
        // This is where you'd check if the user is logged in via Firebase
        // and potentially sync the pro status from Firestore if it exists there.
        // const user = await auth.getCurrentUser(); // Assuming auth.js utility
        // if (user) {
        //    const proStatusFromFirebase = await storage.getFirebase(`users/${user.uid}/proStatus`);
        //    if (proStatusFromFirebase && !proFeatures.isPro) {
        //        proFeatures.isPro = true;
        //        await storage.set({ proEnabled: true }); // Sync to local storage
        //         console.log("Pro status synced from Firebase.");
        //    }
        // }
        // ---

        proFeatures.setupEventListeners();
    },

    isProUser: async () => {
        // Return the cached status for efficiency, re-check storage if needed
        // Could add a periodic re-check or rely on messages for updates
        // For now, return the status determined during init or after unlock
        const data = await storage.get({ proEnabled: false });
        proFeatures.isPro = data.proEnabled || false; // Re-check just in case
        return proFeatures.isPro;
    },

    setupEventListeners: () => {
         // Generic upgrade button listener (can be attached to multiple upgrade links/buttons)
         document.body.addEventListener('click', (event) => {
             if (event.target.closest('a[href="#"]') && event.target.closest('a[href="#"]').id?.startsWith('upgrade-')) {
                 event.preventDefault();
                 proFeatures.showUpgradePopup();
             } else if (event.target.id === 'upgrade-pro-button') {
                 proFeatures.initiateStripeCheckout();
             }
         });
    },

    // Call this after successful payment verification
    unlockPro: async () => {
        proFeatures.isPro = true;
        await storage.set({ proEnabled: true });
        console.log("Pro Features Unlocked!");

         // Update UI immediately
         proFeatures.updateUIVisibility();

         // Notify other components/background script
         // This is crucial for features like timer intervals, tab blocker etc. to update immediately
         chrome.runtime.sendMessage({ command: 'proStatusChanged', newStatus: true }).catch(e => console.warn("Couldn't notify background of Pro status change", e.message));

         // Re-initialize components that have different behavior for Pro users
         await taskManager.init();
         await pomodoroTimer.init();
         await tabLimiter.init();
         await statsTracker.init(); // This will also init streakTracker if Pro
         // Add others as needed
    },

    // Hides/shows relevant Pro upsell messages and feature sections
    updateUIVisibility: () => {
        const isPro = proFeatures.isPro;
        console.log("Updating UI visibility based on Pro Status:", isPro);

        // General Pro Unlock sections
        const proSection = document.getElementById('pro-section');
        const proUnlockedMessage = document.getElementById('pro-unlocked-message');

        if (proSection) proSection.classList.toggle('hidden', isPro);
        if (proUnlockedMessage) proUnlockedMessage.classList.toggle('hidden', !isPro);

        // Call update functions on individual components
        // These functions hide/show specific upsells and enable/disable controls
         if (typeof taskManager !== 'undefined' && taskManager.updateUIBasedOnProStatus) taskManager.updateUIBasedOnProStatus();
         if (typeof pomodoroTimer !== 'undefined' && pomodoroTimer.updateUIBasedOnProStatus) pomodoroTimer.updateUIBasedOnProStatus();
         if (typeof tabLimiter !== 'undefined' && tabLimiter.updateUIBasedOnProStatus) tabLimiter.updateUIBasedOnProStatus();
         if (typeof statsTracker !== 'undefined' && statsTracker.updateUIBasedOnProStatus) statsTracker.updateUIBasedOnProStatus();
         // Add calls for themeManager (Pro themes), focus sounds, etc. if they have specific UI toggles

          // Dashboard Link
          const dashboardLink = document.getElementById('dashboard-link-container');
           if (dashboardLink) dashboardLink.classList.toggle('hidden', !isPro);
    },

    // --- Payment Logic (Simplified Client-Side Example) ---
    // IMPORTANT: Real implementation needs a backend to create the session securely.
    showUpgradePopup: () => {
        // For now, just scroll to the main upgrade section or show a modal
        const proSection = document.getElementById('pro-section');
        if (proSection) {
            proSection.scrollIntoView({ behavior: 'smooth' });
            // Or implement a proper modal display here
            alert("Upgrade to Pro for $2 to unlock all features!"); // Simple placeholder
        }
    },

    initiateStripeCheckout: () => {
        // --- SECURITY WARNING ---
        // NEVER expose your Stripe Secret Key in client-side code.
        // This flow requires a backend endpoint that uses your Secret Key
        // to create a Stripe Checkout Session and returns the Session ID.

        alert("Stripe integration requires a backend.\nSimulating successful payment for demonstration.");

        // ** SIMULATION ONLY **
        // In a real app, you would:
        // 1. Make a request to your backend (e.g., Firebase Function).
        // 2. Backend creates a Checkout Session using Stripe API (with secret key).
        // 3. Backend returns the session ID.
        // 4. Frontend uses Stripe.js to redirect to Checkout:
        //    const stripe = Stripe(proFeatures.stripePublicKey);
        //    stripe.redirectToCheckout({ sessionId: returnedSessionId });
        // 5. After payment, Stripe redirects to your success/cancel URLs.
        // 6. Your backend verifies payment (via webhook or checking session status)
        // 7. Backend updates user's Pro status (e.g., in Firestore).
        // 8. Extension detects the change (via listener or re-check) and calls unlockPro().

        // ** Simulate successful unlock **
        proFeatures.unlockPro();
    },

    // --- Pro Specific Feature Toggles (Called by other components) ---
    canUseUnlimitedTasks: () => proFeatures.isPro,
    canUseCustomIntervals: () => proFeatures.isPro,
    canUseAutoTabBlocker: () => proFeatures.isPro,
    canViewFullStats: () => proFeatures.isPro,
    canUseCloudSync: () => proFeatures.isPro, // Needs auth check too
    canUseIntegrations: () => proFeatures.isPro, // Needs auth check too
    canUseFocusSounds: () => proFeatures.isPro,
    canUseProThemes: () => proFeatures.isPro,
    canUseStreakTracker: () => proFeatures.isPro,
};