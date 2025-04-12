// dashboard.js
let statsChart = null; // Chart.js instance

async function initializeDashboard() {
    console.log("Initializing Full Dashboard...");

    // Ensure core utils are available
     if (typeof storage === 'undefined' || typeof proFeatures === 'undefined' || typeof themeManager === 'undefined') {
        console.error("Core utilities (storage, proFeatures, themeManager) not loaded. Dashboard cannot initialize.");
        document.body.innerHTML = `<p class="text-red-500 p-4">Error: Core components failed to load.</p>`;
        return;
     }

    // Check Pro Status (essential for dashboard access)
    await proFeatures.init(); // Ensure pro status is loaded
    const isPro = await proFeatures.isProUser();
    if (!isPro) {
        // Redirect or show an upgrade message
        document.body.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
                    <h1 class="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">Access Denied</h1>
                    <p class="text-gray-700 dark:text-gray-300 mb-6">The full dashboard requires a Pro upgrade.</p>
                    <a href="popup.html" class="text-blue-500 hover:underline">Return to Popup</a>
                    </div>
            </div>`;
        // Apply theme in case the denial message needs it
        await themeManager.init();
        return; // Stop initialization
    }

    // Initialize theme
    await themeManager.init();

    // Initialize sound manager (needs storage, loads its own state)
     if (typeof soundManager !== 'undefined' && soundManager.init) {
        await soundManager.init();
     } else {
        console.warn("SoundManager not found or init function missing.");
     }

    // Initialize stats tracker if needed separately for dashboard functions
    if (typeof statsTracker !== 'undefined' && statsTracker.init) {
        // Note: statsTracker init might run some UI updates relevant to popup, check if needed here
        await statsTracker.init(); // Loads today's stats, maybe not necessary if only using historical fetch
    } else {
         console.warn("StatsTracker not found or init function missing.");
    }


    // Load settings and populate fields
    await loadProSettings();

    // Setup event listeners for settings changes
    setupSettingsEventListeners();

    // Load and display stats
    await loadAndDisplayStats('weekly'); // Default to weekly view

    console.log("Dashboard Initialized.");
}

async function loadProSettings() {
    // Load Pomodoro Intervals
    const { customFocusDuration, customBreakDuration } = await storage.get({
        customFocusDuration: 25,
        customBreakDuration: 5
    });
     const focusInput = document.getElementById('custom-focus-duration');
     const breakInput = document.getElementById('custom-break-duration');
     if(focusInput) focusInput.value = customFocusDuration;
     if(breakInput) breakInput.value = customBreakDuration;


    // Load Auto Blocker Preferences
    const { autoBlockerPref, blockedSites } = await storage.get({
        autoBlockerPref: true,
        blockedSites: []
    });
     const blockerPrefCheckbox = document.getElementById('auto-blocker-pref');
     const blockedSitesTextarea = document.getElementById('blocked-sites-input');
     if(blockerPrefCheckbox) blockerPrefCheckbox.checked = autoBlockerPref;
     if(blockedSitesTextarea) blockedSitesTextarea.value = (blockedSites || []).join('\n');

    // Load Pro Theme Selection
    const { proTheme, currentTheme } = await storage.get({ proTheme: 'light', currentTheme: 'light' });
    const themeSelect = document.getElementById('pro-theme-select');
    // Use proTheme if set, otherwise default based on current light/dark mode
    const activeTheme = proTheme && proTheme !== 'default' ? proTheme : currentTheme;
    if(themeSelect) themeSelect.value = activeTheme;
    // themeManager should handle applying the correct theme via its init

     // Load Focus Sounds Preferences
    const { focusSoundsEnabled, selectedFocusSound, focusSoundVolume } = await storage.get({
         focusSoundsEnabled: false,
         selectedFocusSound: 'lofi',
         focusSoundVolume: 0.5
     });
    const enabledCheckbox = document.getElementById('focus-sounds-enabled');
    const soundSelect = document.getElementById('focus-sound-select');
    const volumeSlider = document.getElementById('focus-sound-volume');
    const volumeDisplay = document.getElementById('volume-display');

    if (enabledCheckbox) enabledCheckbox.checked = focusSoundsEnabled;
    if (soundSelect) soundSelect.value = selectedFocusSound;
    if (volumeSlider) volumeSlider.value = focusSoundVolume;
    if (volumeDisplay) volumeDisplay.textContent = `${Math.round(focusSoundVolume * 100)}%`;

    // Load Integration Status (placeholder)
    // const { googleTasksConnected, notionConfigured } = await storage.get({...});
    // updateIntegrationStatus('google', googleTasksConnected);
    // updateIntegrationStatus('notion', notionConfigured);
}

function setupSettingsEventListeners() {
    // Save Pomodoro Intervals
    document.getElementById('save-custom-intervals')?.addEventListener('click', async () => {
         const focusInput = document.getElementById('custom-focus-duration');
         const breakInput = document.getElementById('custom-break-duration');
         if (!focusInput || !breakInput) return;

         const newFocus = parseInt(focusInput.value, 10);
         const newBreak = parseInt(breakInput.value, 10);

         if (isNaN(newFocus) || isNaN(newBreak) || newFocus < 1 || newBreak < 1) {
             alert("Please enter valid durations (minimum 1 minute)."); return;
         }
         await storage.set({ customFocusDuration: newFocus, customBreakDuration: newBreak });
         // Notify background/popup if timer needs immediate update? Usually applies on next cycle.
         chrome.runtime.sendMessage({ command: 'proSettingsChanged', type: 'pomodoro' }).catch(e=>console.warn("Failed to send pomodoro setting change message:",e));
         alert("Pomodoro intervals saved.");
    });

    // Save Auto Blocker Pref
    document.getElementById('auto-blocker-pref')?.addEventListener('change', async (e) => {
        await storage.set({ autoBlockerPref: e.target.checked });
        chrome.runtime.sendMessage({ command: 'proSettingsChanged', type: 'blockerPref' }).catch(e=>console.warn("Failed to send blocker pref change message:",e));
    });

     // Save Blocked Sites List
     document.getElementById('save-blocked-sites')?.addEventListener('click', async () => {
         const textarea = document.getElementById('blocked-sites-input');
         if (!textarea) return;
         const sites = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
         await storage.set({ blockedSites: sites });
         // Notify background script immediately
         chrome.runtime.sendMessage({ command: 'updateBlockedSites', sites: sites }).catch(e=>console.warn("Failed to send blocked sites update message:",e));
         alert("Blocked sites list saved.");
     });

    // Save Pro Theme
    document.getElementById('pro-theme-select')?.addEventListener('change', async (e) => {
        const selectedTheme = e.target.value;
        // Store as proTheme preference regardless of whether it's light/dark base
        await storage.set({ proTheme: selectedTheme });
        // Apply theme visually using themeManager
        if (typeof themeManager !== 'undefined' && themeManager.applyTheme) {
            themeManager.applyTheme(selectedTheme); // Use the main apply function
            // Also save the underlying light/dark mode if a pro theme is chosen
             if (selectedTheme !== 'light' && selectedTheme !== 'dark') {
                 // Determine if the pro theme is light or dark based (you might need a mapping)
                 const isDarkBased = selectedTheme.includes('dark') || selectedTheme === 'zen'; // Example logic
                 await storage.set({ currentTheme: isDarkBased ? 'dark' : 'light' });
             } else {
                 await storage.set({ currentTheme: selectedTheme }); // Save light/dark directly
             }

        }
        chrome.runtime.sendMessage({ command: 'proSettingsChanged', type: 'theme' }).catch(e=>console.warn("Failed to send theme change message:",e));
    });

     // --- Add Sound Settings Listeners ---
    const enabledCheckbox = document.getElementById('focus-sounds-enabled');
    const soundSelect = document.getElementById('focus-sound-select');
    const volumeSlider = document.getElementById('focus-sound-volume');
    const volumeDisplay = document.getElementById('volume-display');

    if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', async (e) => {
            if (typeof soundManager !== 'undefined' && soundManager.setSoundEnabled) {
                await soundManager.setSoundEnabled(e.target.checked);
                 // Also inform background/other contexts if needed, though soundManager handles storage
                 chrome.runtime.sendMessage({ command: 'proSettingsChanged', type: 'soundEnabled' }).catch(e=>console.warn(e));
            }
        });
    }

    if (soundSelect) {
        soundSelect.addEventListener('change', async (e) => {
             if (typeof soundManager !== 'undefined' && soundManager.setSelectedSound) {
                await soundManager.setSelectedSound(e.target.value);
                 chrome.runtime.sendMessage({ command: 'proSettingsChanged', type: 'soundSelected' }).catch(e=>console.warn(e));
            }
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', async (e) => { // Use 'input' for live update
            const volumeValue = parseFloat(e.target.value);
            if (typeof soundManager !== 'undefined' && soundManager.setVolume) {
                // Debounce saving? For volume slider, maybe save on 'change' instead of 'input'
                // await soundManager.setVolume(volumeValue); // Let setVolume handle storage saving
            }
             if (volumeDisplay) volumeDisplay.textContent = `${Math.round(volumeValue * 100)}%`;
        });
         // Save volume on 'change' event (when user releases slider)
         volumeSlider.addEventListener('change', async (e) => {
             const volumeValue = parseFloat(e.target.value);
              if (typeof soundManager !== 'undefined' && soundManager.setVolume) {
                 await soundManager.setVolume(volumeValue);
                 chrome.runtime.sendMessage({ command: 'proSettingsChanged', type: 'soundVolume' }).catch(e=>console.warn(e));
             }
         });
    }


      // Integration Buttons (Placeholder actions)
      document.getElementById('connect-google-tasks')?.addEventListener('click', () => alert('Google Tasks connection setup required in googleTasksAPI.js and auth.js'));
      document.getElementById('connect-notion')?.addEventListener('click', () => alert('Notion configuration setup required in notionAPI.js'));

       // Stats Range Selector
       document.getElementById('stats-range')?.addEventListener('change', (e) => {
            loadAndDisplayStats(e.target.value);
       });
}

async function loadAndDisplayStats(range) {
    console.log(`Loading stats for range: ${range}`);
     // Ensure statsTracker and dateUtils are available
     if (typeof statsTracker === 'undefined' || typeof dateUtils === 'undefined') {
         console.error("statsTracker or dateUtils not available for loading stats.");
         return;
     }

    let startDate, endDate;
    const today = new Date();

    if (range === 'weekly') {
        endDate = new Date(today);
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
    } else if (range === 'monthly') {
        endDate = new Date(today);
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 29);
    } else {
        console.warn("Unsupported stats range:", range);
        return;
    }

    const startDateKey = dateUtils.getTodayKey(startDate);
    const endDateKey = dateUtils.getTodayKey(endDate);

    let historicalStats = {};
    try {
        // Fetch data using statsTracker utility functions
        historicalStats = await statsTracker.getStatsForDateRange(startDateKey, endDateKey);
    } catch (error) {
         console.error("Error fetching historical stats:", error);
         // Display error on chart?
         const summaryEl = document.getElementById('stats-summary');
         if (summaryEl) summaryEl.textContent = "Error loading stats data.";
         // Clear chart if exists
         if (statsChart) {
             statsChart.destroy();
             statsChart = null;
         }
         return;
    }


    const labels = [];
    const taskCounts = [];
    const pomodoroCounts = [];
    let totalTasks = 0;
    let totalPomodoros = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = dateUtils.getTodayKey(new Date(d)); // Use date arg
        const dayStats = historicalStats[dateKey] || { tasksCompleted: 0, pomodorosCompleted: 0 };

        labels.push(dateKey.substring(5)); // Format as MM-DD
        taskCounts.push(dayStats.tasksCompleted);
        pomodoroCounts.push(dayStats.pomodorosCompleted);
        totalTasks += dayStats.tasksCompleted;
        totalPomodoros += dayStats.pomodorosCompleted;
    }

    renderStatsChart(labels, taskCounts, pomodoroCounts);

    const summaryEl = document.getElementById('stats-summary');
    const numDays = labels.length;
    if (summaryEl && numDays > 0) {
        summaryEl.textContent = `
            Total Tasks (${numDays} days): ${totalTasks} |
            Total Pomodoros (${numDays} days): ${totalPomodoros} |
            Avg Tasks/Day: ${(totalTasks / numDays).toFixed(1)} |
            Avg Pomodoros/Day: ${(totalPomodoros / numDays).toFixed(1)}
        `;
    } else if (summaryEl) {
         summaryEl.textContent = "No data available for this period.";
    }
}

function renderStatsChart(labels, taskData, pomodoroData) {
    const canvas = document.getElementById('stats-chart');
     if (!canvas) {
        console.error("Stats chart canvas not found.");
        return;
    }
     // Ensure Chart.js is loaded
     if (typeof Chart === 'undefined') {
         console.error("Chart.js not loaded.");
         document.getElementById('stats-summary').textContent = "Error: Chart library not loaded.";
         return;
     }

    const ctx = canvas.getContext('2d');
    const isDarkMode = document.documentElement.classList.contains('dark');
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';

    if (statsChart) {
        statsChart.destroy();
    }

    try {
        statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tasks Completed',
                    data: taskData,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                }, {
                    label: 'Pomodoros Completed',
                    data: pomodoroData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)', // Green/Teal
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                }]
            },
            options: {
                 responsive: true,
                 maintainAspectRatio: false,
                 plugins: {
                    title: { display: true, text: 'Daily Productivity', color: textColor, font: { size: 16 } },
                    legend: { labels: { color: textColor } }
                 },
                scales: {
                    x: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor, precision: 0 }, // Ensure whole numbers
                        grid: { color: gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating Chart.js instance:", error);
         document.getElementById('stats-summary').textContent = "Error rendering chart.";
    }
}

// Run initialization when the dashboard DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Listen for theme changes from the toggle button to update the chart
document.getElementById('theme-toggle-button')?.addEventListener('click', () => {
    setTimeout(() => {
         const rangeSelect = document.getElementById('stats-range');
         if(rangeSelect && statsChart) {
            loadAndDisplayStats(rangeSelect.value); // Re-render chart
         }
    }, 100);
});