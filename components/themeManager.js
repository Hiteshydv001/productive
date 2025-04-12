const themeManager = {
    init: async () => {
        const toggleButton = document.getElementById('theme-toggle-button');
        const lightIcon = document.getElementById('theme-icon-light');
        const darkIcon = document.getElementById('theme-icon-dark');

        const { currentTheme } = await storage.get({ currentTheme: 'light' }); // Default to light
        themeManager.applyTheme(currentTheme);

        if (toggleButton) {
            toggleButton.addEventListener('click', themeManager.toggleTheme);
        }

        // --- PRO FEATURE: Apply Pro Themes ---
        // const isPro = await proFeatures.isProUser();
        // if (isPro) {
        //    const { proTheme } = await storage.get({ proTheme: 'default' }); // 'default', 'solarized-light', etc.
        //    themeManager.applyProTheme(proTheme);
        //    // Add UI elements to select pro themes
        // }
    },

    applyTheme: (theme) => {
        const lightIcon = document.getElementById('theme-icon-light');
        const darkIcon = document.getElementById('theme-icon-dark');

        if (theme === 'dark') {
            document.documentElement.classList.add('dark'); // Use html element for Tailwind
             if (lightIcon) lightIcon.classList.add('hidden');
             if (darkIcon) darkIcon.classList.remove('hidden');
        } else {
            document.documentElement.classList.remove('dark');
             if (lightIcon) lightIcon.classList.remove('hidden');
             if (darkIcon) darkIcon.classList.add('hidden');
        }
        // --- PRO FEATURE: Apply Pro Themes ---
        // Remove existing pro theme classes first
        // document.body.classList.remove('theme-solarized-light', 'theme-solarized-dark', 'theme-zen');
        // if (theme !== 'light' && theme !== 'dark') { // Assuming pro themes have names like 'solarized-light'
        //    document.body.classList.add(`theme-${theme}`);
        // }
    },

    toggleTheme: async () => {
        const isDarkMode = document.documentElement.classList.contains('dark');
        const newTheme = isDarkMode ? 'light' : 'dark';
        themeManager.applyTheme(newTheme);
        await storage.set({ currentTheme: newTheme });
    },

    // --- PRO FEATURE: Functions for Pro Themes ---
    // applyProTheme: (themeName) => { /* ... apply specific theme class ... */ },
    // setProTheme: async (themeName) => {
    //      await storage.set({ proTheme: themeName });
    //      themeManager.applyProTheme(themeName);
    // },
};