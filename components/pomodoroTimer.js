// components/pomodoroTimer.js

const pomodoroTimer = {
    DEFAULT_FOCUS_MINUTES: 25,
    DEFAULT_BREAK_MINUTES: 5,
    timerState: {
        isRunning: false,
        isFocusMode: true, // true = focus, false = break
        timeLeft: 25 * 60, // in seconds
        intervalId: null,
        notifyEnabled: false,
        customFocusDuration: 25, // Stored in minutes
        customBreakDuration: 5,  // Stored in minutes
    },
    isPro: false, // Will be updated by proFeatures.js

    init: async () => {
        pomodoroTimer.isPro = await proFeatures.isProUser();
        // Assuming soundManager.init() is called in popup.js/dashboard.js before this
        await pomodoroTimer.loadState();
        pomodoroTimer.updateDisplay();
        pomodoroTimer.setupEventListeners();
        pomodoroTimer.updateUIBasedOnProStatus();
    },

    setupEventListeners: () => {
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        const resetBtn = document.getElementById('timer-reset');
        const notifyCheckbox = document.getElementById('pomodoro-notifications');
        const saveIntervalsBtn = document.getElementById('save-custom-intervals');
        const upgradeLink = document.getElementById('upgrade-pomodoro-link');


        if (startBtn) startBtn.addEventListener('click', pomodoroTimer.startTimer);
        if (pauseBtn) pauseBtn.addEventListener('click', pomodoroTimer.pauseTimer);
        if (resetBtn) resetBtn.addEventListener('click', pomodoroTimer.resetTimer);
        if (notifyCheckbox) {
            notifyCheckbox.addEventListener('change', (e) => {
                pomodoroTimer.timerState.notifyEnabled = e.target.checked;
                storage.set({ pomodoroNotifyEnabled: e.target.checked });
            });
        }
        if (saveIntervalsBtn) saveIntervalsBtn.addEventListener('click', pomodoroTimer.handleSaveCustomIntervals);
        if (upgradeLink) {
            upgradeLink.addEventListener('click', (e) => {
                 e.preventDefault();
                 if (typeof proFeatures !== 'undefined' && proFeatures.showUpgradePopup) {
                    proFeatures.showUpgradePopup();
                 }
             });
        }
    },

    loadState: async () => {
        const data = await storage.get({
            pomodoroState: null, // Store entire state object
            pomodoroNotifyEnabled: false,
            customFocusDuration: pomodoroTimer.DEFAULT_FOCUS_MINUTES,
            customBreakDuration: pomodoroTimer.DEFAULT_BREAK_MINUTES
        });

        if (data.pomodoroState) {
             pomodoroTimer.timerState = { ...pomodoroTimer.timerState, ...data.pomodoroState };
             pomodoroTimer.timerState.isRunning = false; // Assume paused on popup load
             pomodoroTimer.timerState.intervalId = null;
        } else {
            pomodoroTimer.resetTimer(false); // Reset without saving yet
        }

        pomodoroTimer.timerState.notifyEnabled = data.pomodoroNotifyEnabled;
        pomodoroTimer.timerState.customFocusDuration = data.customFocusDuration || pomodoroTimer.DEFAULT_FOCUS_MINUTES;
        pomodoroTimer.timerState.customBreakDuration = data.customBreakDuration || pomodoroTimer.DEFAULT_BREAK_MINUTES;

        const notifyCheckbox = document.getElementById('pomodoro-notifications');
        if (notifyCheckbox) notifyCheckbox.checked = pomodoroTimer.timerState.notifyEnabled;

         if (pomodoroTimer.isPro) {
             const focusInput = document.getElementById('custom-focus-duration');
             const breakInput = document.getElementById('custom-break-duration');
             if (focusInput) focusInput.value = pomodoroTimer.timerState.customFocusDuration;
             if (breakInput) breakInput.value = pomodoroTimer.timerState.customBreakDuration;
         }

         await pomodoroTimer.syncWithBackground();
    },

    syncWithBackground: async () => {
         try {
             const response = await chrome.runtime.sendMessage({ command: 'getTimerState' });
             if (response && response.state) {
                 pomodoroTimer.timerState.isRunning = response.state.isRunning;
                 pomodoroTimer.timerState.timeLeft = response.state.timeLeft;
                 pomodoroTimer.timerState.isFocusMode = response.state.isFocusMode;
                 pomodoroTimer.updateDisplay();
                 pomodoroTimer.updateButtonStates();
                 if (pomodoroTimer.timerState.isRunning) {
                     pomodoroTimer.startLocalTick();
                     // If timer is running from background and it's focus mode, maybe start sound?
                     const isPro = await proFeatures.isProUser();
                     if (isPro && pomodoroTimer.timerState.isFocusMode && typeof soundManager !== 'undefined' && soundManager.playSound) {
                         console.log("Timer running from background sync, attempting to play sound.");
                         await soundManager.playSound();
                     }
                 } else {
                     // If timer is not running, ensure sound is paused
                     if (typeof soundManager !== 'undefined' && soundManager.pauseSound) {
                         soundManager.pauseSound();
                     }
                 }
             } else {
                 console.log("Background script didn't return state, using local.");
                 pomodoroTimer.updateDisplay();
                 pomodoroTimer.updateButtonStates();
                 // Ensure sound is paused if timer isn't running based on local state check
                  if (!pomodoroTimer.timerState.isRunning && typeof soundManager !== 'undefined' && soundManager.pauseSound) {
                       soundManager.pauseSound();
                  }
             }
         } catch (error) {
             console.warn("Could not sync with background script. It might not be ready yet.", error);
             pomodoroTimer.updateDisplay();
             pomodoroTimer.updateButtonStates();
              // Ensure sound is paused if timer isn't running based on local state check
              if (!pomodoroTimer.timerState.isRunning && typeof soundManager !== 'undefined' && soundManager.pauseSound) {
                 soundManager.pauseSound();
             }
         }
     },

    saveState: async () => {
        const stateToSave = {
             isFocusMode: pomodoroTimer.timerState.isFocusMode,
             timeLeft: pomodoroTimer.timerState.timeLeft,
        };
        await storage.set({
            pomodoroState: stateToSave,
            pomodoroNotifyEnabled: pomodoroTimer.timerState.notifyEnabled,
            customFocusDuration: pomodoroTimer.timerState.customFocusDuration,
            customBreakDuration: pomodoroTimer.timerState.customBreakDuration
         });
    },

    startTimer: async () => { // Make async to await pro check
        if (pomodoroTimer.timerState.isRunning) return;

        pomodoroTimer.timerState.isRunning = true;
        chrome.runtime.sendMessage({
            command: 'startTimer',
            duration: pomodoroTimer.timerState.timeLeft
        });
        pomodoroTimer.startLocalTick();
        pomodoroTimer.updateButtonStates();

        // --- PRO FEATURE: Focus Sounds ---
        const isPro = await proFeatures.isProUser();
        if (isPro && pomodoroTimer.timerState.isFocusMode) {
            if (typeof soundManager !== 'undefined' && soundManager.playSound) {
                 console.log("Focus started, attempting to play sound.");
                 await soundManager.playSound(); // Call the sound manager to play
            } else {
                console.warn("SoundManager not available to play sound.");
            }
        }

        // --- PRO FEATURE: Auto Tab Blocker ---
        if (isPro && pomodoroTimer.timerState.isFocusMode) {
             chrome.runtime.sendMessage({ command: 'enableAutoBlocker' }).catch(e=>console.warn(e));
        }
    },

    startLocalTick: () => {
        if (pomodoroTimer.timerState.intervalId) {
            clearInterval(pomodoroTimer.timerState.intervalId);
        }
        pomodoroTimer.timerState.intervalId = setInterval(() => {
            if (pomodoroTimer.timerState.timeLeft <= 0) {
                clearInterval(pomodoroTimer.timerState.intervalId);
                pomodoroTimer.timerState.intervalId = null;
                pomodoroTimer.syncWithBackground(); // Request state update
                return;
            }
            pomodoroTimer.timerState.timeLeft--;
            pomodoroTimer.updateDisplay();
        }, 1000);
    },

    pauseTimer: async () => { // Make async for consistency
        if (!pomodoroTimer.timerState.isRunning) return;

        pomodoroTimer.timerState.isRunning = false;
        clearInterval(pomodoroTimer.timerState.intervalId);
        pomodoroTimer.timerState.intervalId = null;
        chrome.runtime.sendMessage({ command: 'pauseTimer' });
        pomodoroTimer.updateButtonStates();

        // --- PRO FEATURE: Focus Sounds ---
         if (typeof soundManager !== 'undefined' && soundManager.pauseSound) {
             console.log("Timer paused, pausing sound.");
             soundManager.pauseSound(); // Stop sound on pause
         }

        // --- PRO FEATURE: Auto Tab Blocker ---
        const isPro = await proFeatures.isProUser();
         if (isPro) {
             chrome.runtime.sendMessage({ command: 'disableAutoBlocker' }).catch(e=>console.warn(e));
         }
    },

    resetTimer: async (save = true) => { // Make async
        await pomodoroTimer.pauseTimer(); // Ensure paused and sound stopped

        const isPro = await proFeatures.isProUser();
        const focusDuration = (isPro ? pomodoroTimer.timerState.customFocusDuration : pomodoroTimer.DEFAULT_FOCUS_MINUTES) * 60;
        pomodoroTimer.timerState.isFocusMode = true;
        pomodoroTimer.timerState.timeLeft = focusDuration;
        pomodoroTimer.timerState.isRunning = false;

        chrome.runtime.sendMessage({ command: 'resetTimer' });

        pomodoroTimer.updateDisplay();
        pomodoroTimer.updateButtonStates();
        if (save) {
             await pomodoroTimer.saveState();
        }

        // Sound already paused by pauseTimer call above
    },

    // Called by background script via message when alarm fires
    handleTimerEnd: async (newState) => { // Make async
         console.log("Popup received timer end:", newState);
         pomodoroTimer.timerState.isRunning = false;
         clearInterval(pomodoroTimer.timerState.intervalId);
         pomodoroTimer.timerState.intervalId = null;

         const wasFocusMode = pomodoroTimer.timerState.isFocusMode;
         pomodoroTimer.timerState.isFocusMode = !wasFocusMode;

         const isPro = await proFeatures.isProUser();
         const newDuration = (pomodoroTimer.timerState.isFocusMode
             ? (isPro ? pomodoroTimer.timerState.customFocusDuration : pomodoroTimer.DEFAULT_FOCUS_MINUTES)
             : (isPro ? pomodoroTimer.timerState.customBreakDuration : pomodoroTimer.DEFAULT_BREAK_MINUTES)) * 60;

         pomodoroTimer.timerState.timeLeft = newDuration;

         pomodoroTimer.updateDisplay();
         pomodoroTimer.updateButtonStates();
         await pomodoroTimer.saveState();

         // --- PRO FEATURE: Focus Sounds ---
         if (typeof soundManager !== 'undefined' && soundManager.pauseSound) {
             console.log("Timer ended, pausing sound.");
             soundManager.pauseSound(); // Stop sound when focus ends or break ends
         }

         // Update stats if focus session ended
         if (wasFocusMode && typeof statsTracker !== 'undefined' && statsTracker.incrementPomodoroCount) {
             await statsTracker.incrementPomodoroCount();
         }

         // Show notification
         if (pomodoroTimer.timerState.notifyEnabled && typeof notifier !== 'undefined' && notifier.showNotification) {
             const title = pomodoroTimer.timerState.isFocusMode ? 'Break Over!' : 'Focus Time Finished!';
             const message = pomodoroTimer.timerState.isFocusMode ? 'Time to get back to focus.' : 'Time for a short break.';
             notifier.showNotification('pomodoro-alert', title, message);
         }

         // --- PRO FEATURE: Auto Tab Blocker ---
         if (isPro) {
             chrome.runtime.sendMessage({ command: 'disableAutoBlocker' }).catch(e=>console.warn(e)); // Ensure disabled on break/end
         }
    },

    updateDisplay: () => {
        const minutesEl = document.getElementById('timer-minutes');
        const secondsEl = document.getElementById('timer-seconds');
        const modeEl = document.getElementById('timer-mode');

        if (!minutesEl || !secondsEl || !modeEl) return;

        const minutes = Math.floor(pomodoroTimer.timerState.timeLeft / 60);
        const seconds = pomodoroTimer.timerState.timeLeft % 60;

        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
        modeEl.textContent = pomodoroTimer.timerState.isFocusMode ? 'Focus Time' : 'Break Time';
    },

    updateButtonStates: () => {
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        // const resetBtn = document.getElementById('timer-reset'); // Not changing reset button state

        if (!startBtn || !pauseBtn) return;

        if (pomodoroTimer.timerState.isRunning) {
            startBtn.classList.add('hidden');
            pauseBtn.classList.remove('hidden');
        } else {
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
        }
    },

    handleSaveCustomIntervals: async () => {
         if (!pomodoroTimer.isPro) return;

         const focusInput = document.getElementById('custom-focus-duration');
         const breakInput = document.getElementById('custom-break-duration');

         const newFocus = parseInt(focusInput.value, 10);
         const newBreak = parseInt(breakInput.value, 10);

         if (isNaN(newFocus) || isNaN(newBreak) || newFocus < 1 || newBreak < 1) {
             alert("Please enter valid durations (minimum 1 minute).");
             return;
         }

         pomodoroTimer.timerState.customFocusDuration = newFocus;
         pomodoroTimer.timerState.customBreakDuration = newBreak;

         await pomodoroTimer.saveState();

         if (!pomodoroTimer.timerState.isRunning && pomodoroTimer.timerState.isFocusMode) {
             pomodoroTimer.timerState.timeLeft = newFocus * 60;
             pomodoroTimer.updateDisplay();
         }
         else if (!pomodoroTimer.timerState.isRunning && !pomodoroTimer.timerState.isFocusMode) {
             pomodoroTimer.timerState.timeLeft = newBreak * 60;
              pomodoroTimer.updateDisplay();
         }
          alert("Custom intervals saved. Changes will apply on the next session start or reset.");
     },

    updateUIBasedOnProStatus: () => {
        const upsell = document.getElementById('pro-pomodoro-upsell');
        const customIntervalsDiv = document.getElementById('custom-intervals');
        if (!upsell || !customIntervalsDiv) return;

        if (pomodoroTimer.isPro) {
            upsell.classList.add('hidden');
            customIntervalsDiv.classList.remove('hidden');
            const focusInput = document.getElementById('custom-focus-duration');
             const breakInput = document.getElementById('custom-break-duration');
             if (focusInput) focusInput.value = pomodoroTimer.timerState.customFocusDuration;
             if (breakInput) breakInput.value = pomodoroTimer.timerState.customBreakDuration;

        } else {
            upsell.classList.remove('hidden');
            customIntervalsDiv.classList.add('hidden');
        }
    },
};