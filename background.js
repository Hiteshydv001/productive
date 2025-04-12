// Import necessary utility functions if modularized (requires build step or careful global scoping)
// importScripts('utils/storage.js', 'utils/notifier.js', 'utils/dateUtils.js'); // Example if not using modules

// --- Globals for Background State ---
let timerState = {
    isRunning: false,
    isFocusMode: true,
    timeLeft: 25 * 60, // Default: 25 minutes in seconds
    alarmName: 'pomodoroAlarm',
    // --- PRO ---
    autoBlockerEnabled: false,
    blockedSites: [], // Loaded from storage
};

let tabLimiterState = {
    isEnabled: false,
    maxTabs: 5,
};

// --- Initialization ---
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension Installed/Updated:', details.reason);
    await loadInitialSettings();
    // Set default alarm if needed (or wait for user action)
    // await resetTimerInternal(); // Initialize timer state in storage
    console.log("Initial settings loaded for background script.");
});

chrome.runtime.onStartup.addListener(async () => {
    console.log('Extension Started');
    await loadInitialSettings();
     // Check if an alarm was running when Chrome closed
     const alarm = await chrome.alarms.get(timerState.alarmName);
     if (alarm) {
         console.log('Pomodoro alarm was active on startup, restoring state.');
         // State should be loaded by loadInitialSettings, just ensure timer continues conceptually
         // The alarm itself will fire at the correct time.
     } else {
         console.log('No active Pomodoro alarm on startup.');
         // Ensure timer state reflects not running if no alarm exists
         if (timerState.isRunning) {
            timerState.isRunning = false;
            await saveTimerState(); // Correct state if inconsistency found
         }
     }
    console.log("Settings loaded on startup for background script.");
});

async function loadInitialSettings() {
     // Load Timer State
     const timerData = await chrome.storage.local.get(['pomodoroState', 'customFocusDuration', 'customBreakDuration']);
     const isPro = (await chrome.storage.local.get('proEnabled')).proEnabled || false;

     if (timerData.pomodoroState) {
         timerState = { ...timerState, ...timerData.pomodoroState };
         // Crucially, restore isRunning based on whether the alarm exists
         const alarm = await chrome.alarms.get(timerState.alarmName);
         timerState.isRunning = !!alarm; // Timer is running IF AND ONLY IF the alarm exists
     } else {
         // Initialize with defaults if nothing is saved
          const focusMins = isPro && timerData.customFocusDuration ? timerData.customFocusDuration : 25;
         timerState.timeLeft = focusMins * 60;
         timerState.isFocusMode = true;
         timerState.isRunning = false; // Not running initially
     }
     console.log("Loaded timer state:", timerState);

     // Load Tab Limiter Settings
     const tabData = await chrome.storage.local.get(['tabLimiterEnabled', 'maxTabs']);
     tabLimiterState.isEnabled = tabData.tabLimiterEnabled || false;
     tabLimiterState.maxTabs = tabData.maxTabs || 5;
     console.log("Loaded tab limiter state:", tabLimiterState);

      // --- PRO: Load Blocked Sites ---
      if (isPro) {
        const proData = await chrome.storage.local.get(['blockedSites']);
        timerState.blockedSites = proData.blockedSites || [];
        console.log("Loaded blocked sites:", timerState.blockedSites);
      }
}

async function saveTimerState() {
    // Save only the core state variables managed by background
    const stateToSave = {
        isFocusMode: timerState.isFocusMode,
        timeLeft: timerState.timeLeft,
        // Don't save isRunning directly, deduce from alarm existence
    };
    await chrome.storage.local.set({ pomodoroState: stateToSave });
    console.log("Background saved timer state:", stateToSave);
     // Notify popup(s) about the change
     chrome.runtime.sendMessage({ command: 'updateTimerDisplay', state: timerState }).catch(e => console.log("Could not send timer update to popup:", e.message));
}

// --- Pomodoro Alarm Handler ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === timerState.alarmName) {
        console.log('Pomodoro Alarm Fired!', new Date());

        timerState.isRunning = false; // Alarm fired, timer is no longer running until started again

        const wasFocusMode = timerState.isFocusMode;
        const isPro = (await chrome.storage.local.get('proEnabled')).proEnabled || false;
        const { customFocusDuration, customBreakDuration, pomodoroNotifyEnabled } = await chrome.storage.local.get({
            customFocusDuration: 25,
            customBreakDuration: 5,
            pomodoroNotifyEnabled: false
        });

        // Switch Mode
        timerState.isFocusMode = !wasFocusMode;

        // Calculate next duration
        const newDurationMinutes = timerState.isFocusMode
            ? (isPro ? customFocusDuration : 25)
            : (isPro ? customBreakDuration : 5);
        timerState.timeLeft = newDurationMinutes * 60;

        await saveTimerState(); // Save the new mode and timeLeft

        // Notify the user
        if (pomodoroNotifyEnabled) {
            const title = wasFocusMode ? 'Focus Time Finished!' : 'Break Over!';
            const message = wasFocusMode ? `Time for a ${newDurationMinutes}-minute break.` : `Time for ${newDurationMinutes} minutes of focus.`;
             try {
                chrome.notifications.create('pomodoro-alert', {
                     type: 'basic',
                     iconUrl: 'assets/icons/icon-48.png',
                     title: title,
                     message: message,
                     priority: 1
                 });
             } catch (e) { console.error("Error creating notification:", e); }
        }

        // Send message to popup(s) to update UI and handle stats/sounds etc.
        try {
            await chrome.runtime.sendMessage({ command: 'timerEnded', newState: timerState });
        } catch (e) {
             console.log("Could not send timerEnded message to popup (it might be closed).", e.message);
        }

        // --- PRO: Handle Auto Blocker state ---
        if (isPro && timerState.autoBlockerEnabled) {
             // Disable blocker when focus ends or break ends
             timerState.autoBlockerEnabled = false;
             console.log("Auto-blocker disabled as Pomodoro session ended.");
             // No need to save this specific state persistently unless desired
        }

        console.log(`Timer ended. Switched to ${timerState.isFocusMode ? 'Focus' : 'Break'} mode. New duration: ${newDurationMinutes} mins.`);
    }
});

// --- Message Listener (from Popup) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background received command:", request.command);
    let isAsync = false; // Flag for async responses

    if (request.command === 'startTimer') {
        isAsync = true; // We'll use async/await
        (async () => {
            if (!timerState.isRunning) {
                timerState.isRunning = true;
                // Get the *actual* current timeLeft from storage to prevent race conditions
                const data = await chrome.storage.local.get('pomodoroState');
                if (data.pomodoroState) {
                    timerState.timeLeft = data.pomodoroState.timeLeft;
                }
                // Set alarm to fire when timeLeft seconds have passed
                const alarmTime = Date.now() + (timerState.timeLeft * 1000);
                chrome.alarms.create(timerState.alarmName, { when: alarmTime });
                console.log(`Timer started. Alarm set for ${new Date(alarmTime).toLocaleTimeString()}`);
                // No need to save state here, isRunning is derived from alarm existence
                 // --- PRO: Enable Auto Blocker if applicable ---
                const isPro = (await chrome.storage.local.get('proEnabled')).proEnabled || false;
                if (isPro && timerState.isFocusMode) {
                    const { autoBlockerPref } = await chrome.storage.local.get({ autoBlockerPref: true }); // Assume a setting exists
                    if (autoBlockerPref) {
                        timerState.autoBlockerEnabled = true;
                         console.log("Auto-blocker enabled for focus session.");
                         // Perform initial check on existing tabs? (optional)
                    }
                }
                sendResponse({ status: 'started', state: timerState });
            } else {
                console.log("Timer already running.");
                sendResponse({ status: 'already running', state: timerState });
            }
        })();
    } else if (request.command === 'pauseTimer') {
         isAsync = true;
         (async () => {
             if (timerState.isRunning) {
                 const alarm = await chrome.alarms.get(timerState.alarmName);
                 if (alarm) {
                    // Calculate remaining time when paused
                    const timeRemainingMillis = alarm.scheduledTime - Date.now();
                    timerState.timeLeft = Math.max(0, Math.round(timeRemainingMillis / 1000));
                 }
                 await chrome.alarms.clear(timerState.alarmName);
                 timerState.isRunning = false;
                 await saveTimerState(); // Save the remaining time
                 console.log(`Timer paused. Time left: ${timerState.timeLeft}s`);
                 // --- PRO: Disable Auto Blocker ---
                 if (timerState.autoBlockerEnabled) {
                    timerState.autoBlockerEnabled = false;
                    console.log("Auto-blocker disabled due to pause.");
                 }
                 sendResponse({ status: 'paused', state: timerState });
             } else {
                  console.log("Timer already paused.");
                  sendResponse({ status: 'already paused', state: timerState });
             }
         })();
    } else if (request.command === 'resetTimer') {
         isAsync = true;
         (async () => {
             await chrome.alarms.clear(timerState.alarmName);
             timerState.isRunning = false;
             // Reload durations in case they changed (Pro)
             const isPro = (await chrome.storage.local.get('proEnabled')).proEnabled || false;
             const { customFocusDuration } = await chrome.storage.local.get({ customFocusDuration: 25 });
             const focusMins = isPro ? customFocusDuration : 25;
             timerState.timeLeft = focusMins * 60;
             timerState.isFocusMode = true;
             await saveTimerState(); // Save the reset state
             console.log("Timer reset.");
              // --- PRO: Disable Auto Blocker ---
              if (timerState.autoBlockerEnabled) {
                 timerState.autoBlockerEnabled = false;
                 console.log("Auto-blocker disabled due to reset.");
              }
             sendResponse({ status: 'reset', state: timerState });
         })();
    } else if (request.command === 'getTimerState') {
         isAsync = true;
          (async () => {
              // Ensure state is fresh, especially isRunning
              const alarm = await chrome.alarms.get(timerState.alarmName);
              timerState.isRunning = !!alarm;
              if (alarm && timerState.isRunning) {
                   // If running, calculate current timeLeft based on alarm
                   const timeRemainingMillis = alarm.scheduledTime - Date.now();
                   timerState.timeLeft = Math.max(0, Math.round(timeRemainingMillis / 1000));
              }
              console.log("Sending current timer state:", timerState);
              sendResponse({ status: 'current state', state: timerState });
          })();
    } else if (request.command === 'updateTabLimiterSettings') {
        tabLimiterState = { ...tabLimiterState, ...request.settings };
        console.log("Background updated tab limiter settings:", tabLimiterState);
        // Optionally trigger an immediate check if it was just enabled
        if (tabLimiterState.isEnabled) {
            checkTabLimit();
        }
        sendResponse({ status: 'tab settings updated' });
    } else if (request.command === 'checkTabsNow') {
        checkTabLimit(); // Manual trigger from popup
        sendResponse({ status: 'checking tabs' });
    }
    // --- PRO: Auto Blocker Commands ---
    else if (request.command === 'enableAutoBlocker') { // Might be triggered manually or by timer start
         timerState.autoBlockerEnabled = true;
         console.log("Auto Blocker explicitly enabled.");
         // Optionally load/refresh blocked sites list here
         sendResponse({status: 'blocker enabled'});
    } else if (request.command === 'disableAutoBlocker') {
         timerState.autoBlockerEnabled = false;
         console.log("Auto Blocker explicitly disabled.");
         sendResponse({status: 'blocker disabled'});
    } else if (request.command === 'updateBlockedSites') { // Called when user edits list
        isAsync = true;
        (async () => {
            timerState.blockedSites = request.sites || [];
            await chrome.storage.local.set({ blockedSites: timerState.blockedSites });
            console.log("Background updated blocked sites:", timerState.blockedSites);
            sendResponse({ status: 'blocked sites updated' });
        })();
    }

    // Return true if an async response is planned, otherwise false or undefined.
    return isAsync;
});

// --- Tab Limiter Logic ---
async function checkTabLimit() {
    if (!tabLimiterState.isEnabled) return;

    chrome.tabs.query({}, (tabs) => {
        if (tabs.length > tabLimiterState.maxTabs) {
            console.warn(`Tab limit (${tabLimiterState.maxTabs}) exceeded. Current: ${tabs.length}`);
            // Find the newest tab (often the one that triggered the excess)
            // Note: This isn't foolproof, multiple tabs might open quickly.
            // A more robust approach might warn and let the user choose, or close the oldest.
            const newestTab = tabs.sort((a, b) => b.id - a.id)[0];

            chrome.notifications.create('tab-limit-warning', {
                type: 'basic',
                iconUrl: 'assets/icons/icon-48.png',
                title: 'Tab Limit Reached!',
                message: `You have ${tabs.length} tabs open (limit: ${tabLimiterState.maxTabs}). Close some tabs to focus.`,
                priority: 1
            });

            // Optional: Automatically close the newest tab (can be annoying)
            // if (newestTab) {
            //     chrome.tabs.remove(newestTab.id);
            //     console.log("Closed newest tab due to limit.");
            // }
        }
    });
}

// Listen for new tabs being created
chrome.tabs.onCreated.addListener((tab) => {
    console.log("Tab created:", tab.id);
    checkTabLimit(); // Check limit whenever a new tab is created

    // --- PRO: Auto Blocker Check ---
    checkAutoBlocker(tab);
});

// Listen for tab updates (e.g., URL changes) - needed for SPA navigation blocking
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
     // Check only when the URL changes and loading is complete
     if (changeInfo.status === 'complete' && changeInfo.url) {
        console.log("Tab updated:", tabId, changeInfo.url);
        // --- PRO: Auto Blocker Check ---
        checkAutoBlocker(tab);
     }
});


// Listen for tabs being removed (optional, could update count display if needed)
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log("Tab removed:", tabId);
    // No action needed for limiter usually, but could clear warnings if count drops below limit
});

// --- PRO FEATURE: Auto Blocker Logic ---
async function checkAutoBlocker(tab) {
    // Check if blocker is active (Pro feature enabled AND Pomodoro focus mode ON)
    if (!timerState.autoBlockerEnabled || !timerState.isFocusMode || !tab.url) {
        return;
    }

    // Reload blocked sites from storage in case they changed recently
    // (Can be optimized by caching or listening for storage changes)
    const isPro = (await chrome.storage.local.get('proEnabled')).proEnabled || false;
    if (!isPro) return; // Double check pro status

    const { blockedSites } = await chrome.storage.local.get({ blockedSites: [] });
    if (!blockedSites || blockedSites.length === 0) return; // No sites to block

    const currentUrl = new URL(tab.url);
    const currentDomain = currentUrl.hostname.replace(/^www\./, ''); // Normalize domain

    for (const blockedSite of blockedSites) {
         try {
            const blockedDomain = new URL(blockedSite.startsWith('http') ? blockedSite : `http://${blockedSite}`).hostname.replace(/^www\./, '');
             if (currentDomain === blockedDomain) {
                 console.log(`Blocking access to ${tab.url} (matches ${blockedSite})`);
                 // Option 1: Redirect to a "blocked" page (requires a simple HTML page in the extension)
                 // chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('blocked.html') + `?url=${encodeURIComponent(tab.url)}` });

                 // Option 2: Inject a content script to overlay the page
                 chrome.scripting.executeScript({
                     target: { tabId: tab.id },
                     files: ['content.js']
                 }).then(() => {
                     // Send message to content script AFTER it's injected
                     chrome.tabs.sendMessage(tab.id, { command: 'showBlockOverlay', blockedUrl: tab.url });
                 }).catch(err => console.error("Failed to inject content script:", err));

                  // Option 3: Simply close the tab (most aggressive)
                  // chrome.tabs.remove(tab.id);

                 return; // Stop checking once a match is found
             }
         } catch (e) {
             console.warn(`Invalid URL in blocked sites list: ${blockedSite}`, e);
         }

    }
}


console.log("Background script loaded and listeners attached.");