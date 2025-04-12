const streakTracker = {
    currentStreak: 0,
    lastActivityDate: null,
    MIN_STREAK_FOR_BADGE: 5,
    isPro: false, // Set during init

    init: async () => {
         // This component only fully initializes if the user is Pro
         streakTracker.isPro = await proFeatures.isProUser();
         if (!streakTracker.isPro) {
            streakTracker.hideStreakDisplay();
             return;
         }
        await streakTracker.loadStreakData();
        streakTracker.updateDisplay();
    },

    loadStreakData: async () => {
        if (!streakTracker.isPro) return;
        const data = await storage.get({
            streakData: { currentStreak: 0, lastActivityDate: null }
        });
        streakTracker.currentStreak = data.streakData.currentStreak || 0;
        streakTracker.lastActivityDate = data.streakData.lastActivityDate;
        // Validate streak on load
        streakTracker.validateStreak();
    },

    saveStreakData: async () => {
        if (!streakTracker.isPro) return;
        const streakData = {
            currentStreak: streakTracker.currentStreak,
            lastActivityDate: streakTracker.lastActivityDate
        };
        await storage.set({ streakData: streakData });

         // --- PRO FEATURE: Cloud Sync ---
         // if (userIsLoggedIn) { // Assuming login check
         //    await storage.setFirebase(`users/{uid}/streak`, streakData);
         // }
    },

    // Call this whenever a relevant activity occurs (task completed, pomodoro finished)
    updateStreak: async () => {
        if (!streakTracker.isPro) return;

        await streakTracker.loadStreakData(); // Get latest data before updating

        const todayKey = dateUtils.getTodayKey();

        if (streakTracker.lastActivityDate === todayKey) {
            // Already active today, no change to streak count, just ensure display is correct
            streakTracker.updateDisplay();
            return;
        }

        const yesterdayKey = dateUtils.getTodayKey(new Date(Date.now() - 86400000)); // Get yesterday's date key

        if (streakTracker.lastActivityDate === yesterdayKey) {
            // Activity yesterday, increment streak
            streakTracker.currentStreak++;
            console.log(`Streak continued! New streak: ${streakTracker.currentStreak}`);
        } else {
            // Missed a day or first activity ever
            streakTracker.currentStreak = 1;
            console.log("New streak started!");
        }

        streakTracker.lastActivityDate = todayKey;
        await streakTracker.saveStreakData();
        streakTracker.updateDisplay();
    },

    // Check if the streak is still valid (e.g., if user hasn't been active for >1 day)
    validateStreak: () => {
         if (!streakTracker.isPro || !streakTracker.lastActivityDate) {
             streakTracker.currentStreak = 0; // Reset if no last activity date
             return;
         };

        const todayKey = dateUtils.getTodayKey();
        const yesterdayKey = dateUtils.getTodayKey(new Date(Date.now() - 86400000));

        if (streakTracker.lastActivityDate !== todayKey && streakTracker.lastActivityDate !== yesterdayKey) {
            // Last activity was before yesterday, streak is broken
            console.log(`Streak broken. Last activity: ${streakTracker.lastActivityDate}`);
            streakTracker.currentStreak = 0;
            // Don't reset lastActivityDate here, let updateStreak handle the new activity
             streakTracker.saveStreakData(); // Save the broken streak count
        }
    },

    updateDisplay: () => {
        if (!streakTracker.isPro) return;

        const streakDisplay = document.getElementById('streak-display');
        const streakCountEl = document.getElementById('streak-count');

        if (streakDisplay && streakCountEl) {
            if (streakTracker.currentStreak > 0) {
                streakCountEl.textContent = streakTracker.currentStreak;
                streakDisplay.classList.remove('hidden'); // Ensure visible
                // Add badge class if applicable
                if (streakTracker.currentStreak >= streakTracker.MIN_STREAK_FOR_BADGE) {
                     streakDisplay.classList.add('has-badge'); // Add a class for styling the badge
                     console.log("Streak badge active!");
                 } else {
                     streakDisplay.classList.remove('has-badge');
                 }
            } else {
                streakDisplay.classList.add('hidden'); // Hide if streak is 0
            }
        }
    },

    hideStreakDisplay: () => {
        const streakDisplay = document.getElementById('streak-display');
        if (streakDisplay) {
            streakDisplay.classList.add('hidden');
        }
    }
};