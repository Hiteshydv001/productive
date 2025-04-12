const statsTracker = {
    todayKey: dateUtils.getTodayKey(),
    dailyStats: { tasksCompleted: 0, pomodorosCompleted: 0 },
    isPro: false, // Will be updated by proFeatures.js

    init: async () => {
        statsTracker.isPro = await proFeatures.isProUser();
        await statsTracker.loadDailyStats();
        statsTracker.updateDisplay();
        statsTracker.updateUIBasedOnProStatus();
         // Optional: Setup listener for day change if popup stays open long time? (Less common)
         // Or rely on reloading when popup opens.
    },

    loadDailyStats: async () => {
        const today = dateUtils.getTodayKey();
        const storageKey = `stats_${today}`;
        const data = await storage.get({ [storageKey]: { tasksCompleted: 0, pomodorosCompleted: 0 } });

        // Check if the loaded data is actually for today
        if (data[storageKey]) {
            statsTracker.dailyStats = data[storageKey];
        } else {
            // It's a new day or no stats saved yet for today
            statsTracker.dailyStats = { tasksCompleted: 0, pomodorosCompleted: 0 };
            // Optionally clear yesterday's key if needed, or keep history (Pro)
        }
         statsTracker.todayKey = today; // Ensure we're using the current day's key

         // --- PRO FEATURE: Load historical data if needed for dashboard view ---
         // if (statsTracker.isPro && viewingDashboard) { // Need context detection
         //    await statsTracker.loadHistoricalStats();
         // }
    },

    saveDailyStats: async () => {
        const storageKey = `stats_${statsTracker.todayKey}`;
        await storage.set({ [storageKey]: statsTracker.dailyStats });

        // --- PRO FEATURE: Cloud Sync ---
        // if (statsTracker.isPro && userIsLoggedIn) {
        //    // Save to a structure like /users/{uid}/stats/{date}
        //    await storage.setFirebase(`stats/${statsTracker.todayKey}`, statsTracker.dailyStats);
        // }
    },

    // Call this when a task is marked complete
    updateTaskStats: async () => {
        // Recalculate today's completed tasks from the source of truth (taskManager)
        const today = dateUtils.getTodayKey();
         const completedToday = taskManager.tasks.filter(task => task.completed && task.completedDate === today).length;

         if (statsTracker.dailyStats.tasksCompleted !== completedToday) {
             statsTracker.dailyStats.tasksCompleted = completedToday;
             await statsTracker.saveDailyStats();
             statsTracker.updateDisplay();
             // Also update streak tracker if Pro
             if (statsTracker.isPro) {
                streakTracker.updateStreak();
             }
         }
    },

    // Call this when a pomodoro focus session finishes
    incrementPomodoroCount: async () => {
        // Ensure we have the latest stats for today first
        await statsTracker.loadDailyStats();

        statsTracker.dailyStats.pomodorosCompleted += 1;
        await statsTracker.saveDailyStats();
        statsTracker.updateDisplay();
        // Also update streak tracker if Pro
         if (statsTracker.isPro) {
            streakTracker.updateStreak();
         }
    },

    // Updates the UI elements in popup.html
    updateDisplay: () => {
        const tasksEl = document.getElementById('stats-tasks-completed');
        const pomodorosEl = document.getElementById('stats-pomodoros-completed');

        if (tasksEl) tasksEl.textContent = statsTracker.dailyStats.tasksCompleted;
        if (pomodorosEl) pomodorosEl.textContent = statsTracker.dailyStats.pomodorosCompleted;
    },

    // Recalculates stats based on task list (useful for initialization or corrections)
    updateStats: async () => {
         await statsTracker.loadDailyStats(); // Ensure pomodoro count isn't lost
         await statsTracker.updateTaskStats(); // Recalculate tasks completed today
     },

    // --- PRO FEATURE: Historical Stats ---
    getStatsForDate: async (dateKey) => { // dateKey = 'YYYY-MM-DD'
        const storageKey = `stats_${dateKey}`;
        const data = await storage.get({ [storageKey]: { tasksCompleted: 0, pomodorosCompleted: 0 } });
        return data[storageKey];
    },

    getStatsForDateRange: async (startDateKey, endDateKey) => {
        const stats = {};
        const start = new Date(startDateKey);
        const end = new Date(endDateKey);

        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
            const dateKey = dateUtils.getTodayKey(new Date(d)); // Need getTodayKey to accept a date arg
            stats[dateKey] = await statsTracker.getStatsForDate(dateKey);
        }
        return stats;
    },

    // Example: Get stats for the last 7 days
    getLastWeekStats: async () => {
         const today = new Date();
         const endDateKey = dateUtils.getTodayKey(today);
         const startDate = new Date(today);
         startDate.setDate(today.getDate() - 6); // Go back 6 days to get a total of 7
         const startDateKey = dateUtils.getTodayKey(startDate);
         return await statsTracker.getStatsForDateRange(startDateKey, endDateKey);
     },

      updateUIBasedOnProStatus: () => {
         const upsell = document.getElementById('pro-stats-upsell');
         const dashboardLink = document.getElementById('dashboard-link-container');
         const streakDisplay = document.getElementById('streak-display'); // Assume exists for Pro

         if (!upsell || !dashboardLink || !streakDisplay) return;

         if (statsTracker.isPro) {
             upsell.classList.add('hidden');
             dashboardLink.classList.remove('hidden');
             streakDisplay.classList.remove('hidden'); // Show streak display area
             streakTracker.init(); // Initialize streak tracker fully only if Pro
         } else {
             upsell.classList.remove('hidden');
             dashboardLink.classList.add('hidden');
             streakDisplay.classList.add('hidden'); // Hide streak display area
         }
     },
};