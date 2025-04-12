const tabLimiter = {
    isEnabled: false,
    maxTabs: 5,
    isPro: false, // Will be updated by proFeatures.js

    init: async () => {
        tabLimiter.isPro = await proFeatures.isProUser();
        await tabLimiter.loadSettings();
        tabLimiter.setupEventListeners();
        tabLimiter.updateUI();
        // Initial check (optional, background usually handles active monitoring)
        // if (tabLimiter.isEnabled) tabLimiter.checkTabs();
        tabLimiter.updateUIBasedOnProStatus();
    },

    setupEventListeners: () => {
        const toggle = document.getElementById('tab-limiter-toggle');
        const maxTabsInput = document.getElementById('max-tabs-input');
        const saveButton = document.getElementById('save-max-tabs');
        const upgradeLink = document.getElementById('upgrade-tabblock-link');

        if (toggle) {
            toggle.addEventListener('change', tabLimiter.handleToggle);
        }
        if (saveButton) {
            saveButton.addEventListener('click', tabLimiter.handleSaveSettings);
        }
         if (upgradeLink) {
             upgradeLink.addEventListener('click', (e) => {
                 e.preventDefault();
                 proFeatures.showUpgradePopup();
             });
         }
    },

    loadSettings: async () => {
        const data = await storage.get({
            tabLimiterEnabled: false,
            maxTabs: 5
        });
        tabLimiter.isEnabled = data.tabLimiterEnabled;
        tabLimiter.maxTabs = data.maxTabs;
    },

    saveSettings: async () => {
        await storage.set({
            tabLimiterEnabled: tabLimiter.isEnabled,
            maxTabs: tabLimiter.maxTabs
        });
        // Notify background script about the change
        chrome.runtime.sendMessage({
            command: 'updateTabLimiterSettings',
            settings: { isEnabled: tabLimiter.isEnabled, maxTabs: tabLimiter.maxTabs }
        });
    },

    handleToggle: (event) => {
        tabLimiter.isEnabled = event.target.checked;
        tabLimiter.updateUI();
        tabLimiter.saveSettings();
        if (tabLimiter.isEnabled) {
            // Perform an immediate check when enabled
            chrome.runtime.sendMessage({ command: 'checkTabsNow' });
        }
    },

    handleSaveSettings: () => {
        const maxTabsInput = document.getElementById('max-tabs-input');
        const newMax = parseInt(maxTabsInput.value, 10);
        if (!isNaN(newMax) && newMax > 0) {
            tabLimiter.maxTabs = newMax;
            tabLimiter.saveSettings();
             maxTabsInput.value = tabLimiter.maxTabs; // Ensure UI matches saved value
             alert(`Max tabs set to ${tabLimiter.maxTabs}.`);
        } else {
            alert("Please enter a valid number greater than 0.");
            maxTabsInput.value = tabLimiter.maxTabs; // Reset to last valid value
        }
    },

    updateUI: () => {
        const toggle = document.getElementById('tab-limiter-toggle');
        const settingsDiv = document.getElementById('tab-limiter-settings');
        const maxTabsInput = document.getElementById('max-tabs-input');

        if (toggle) toggle.checked = tabLimiter.isEnabled;
        if (maxTabsInput) maxTabsInput.value = tabLimiter.maxTabs;
        if (settingsDiv) {
            if (tabLimiter.isEnabled) {
                settingsDiv.classList.remove('hidden');
            } else {
                settingsDiv.classList.add('hidden');
            }
        }
    },

    // This function is mainly for completeness in the component,
    // the actual enforcement happens in background.js
    checkTabs: async () => {
        if (!tabLimiter.isEnabled) return;

        chrome.tabs.query({}, (tabs) => { // Query all tabs
            if (tabs.length > tabLimiter.maxTabs) {
                console.warn(`Tab limit (${tabLimiter.maxTabs}) exceeded. Current: ${tabs.length}`);
                notifier.showNotification(
                    'tab-limit-warning',
                    'Tab Limit Reached!',
                    `You have ${tabs.length} tabs open (limit is ${tabLimiter.maxTabs}). Close some tabs to stay focused.`
                );
            }
        });
    },

    // --- PRO FEATURE: Auto Blocker Logic (managed mostly in background.js) ---
     updateUIBasedOnProStatus: () => {
         const upsell = document.getElementById('pro-tabblock-upsell');
         const blockSettingsUI = document.getElementById('auto-blocker-settings'); // Add this UI element in HTML if needed

         if (!upsell) return;

         if (tabLimiter.isPro) {
             upsell.classList.add('hidden');
             // Show auto-blocker settings UI (e.g., blacklist input)
             // if (blockSettingsUI) blockSettingsUI.classList.remove('hidden');
         } else {
             upsell.classList.remove('hidden');
              // Hide auto-blocker settings UI
              // if (blockSettingsUI) blockSettingsUI.classList.add('hidden');
         }
     },

    // Functions to manage blacklist (Pro) - Called from settings/dashboard
    // addBlockedSite: async (url) => { ... save to storage ... },
    // removeBlockedSite: async (url) => { ... save to storage ... },
    // getBlockedSites: async () => { ... get from storage ... },
};