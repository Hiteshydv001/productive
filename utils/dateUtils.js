const dateUtils = {
    // Gets today's date in YYYY-MM-DD format for keys
    getTodayKey: () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // --- PRO FEATURE: Date Range Generation (for stats) ---
    getWeekDates: (date = new Date()) => {
        const startOfWeek = new Date(date);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to start on Monday
        startOfWeek.setDate(diff);

        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + i);
            weekDates.push(dateUtils.getTodayKey(currentDate)); // Re-use key format
        }
        return weekDates;
    },

    // Add functions for month ranges etc. as needed for Pro stats
};