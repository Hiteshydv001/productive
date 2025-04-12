// popup.js

// Global state check variable
let isProUserGlobally = false;

// Function to load and display a random quote
function loadMotivationalQuote() {
    const quoteElement = document.getElementById('motivational-quote');
    if (!quoteElement) return; // Exit if element not found

    fetch(chrome.runtime.getURL('assets/quotes.json'))
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Check content type before parsing
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                 return response.json();
            } else {
                throw new Error("Received non-JSON response for quotes");
            }
        })
        .then(data => {
            if (data && data.quotes && data.quotes.length > 0) {
                const randomIndex = Math.floor(Math.random() * data.quotes.length);
                const quote = data.quotes[randomIndex];
                quoteElement.textContent = `${quote.text} - ${quote.author || 'Unknown'}`;
            } else {
                 quoteElement.textContent = 'Keep pushing forward!';
            }
        })
        .catch(error => {
            console.error("Error loading quotes:", error);
            quoteElement.textContent = 'Stay focused and productive!';
        });
}

// --- Communication with Background Script ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Popup received message:", request.command);
    let shouldRespondAsync = false;

    if (request.command === 'timerEnded') {
        shouldRespondAsync = true; // Indicate potential async handling below
         // Ensure pomodoroTimer component is ready and initialized
         if (typeof pomodoroTimer !== 'undefined' && pomodoroTimer.handleTimerEnd && typeof pomodoroTimer.init === 'function') {
            // Ensure initialization has happened before handling message
            // A simple check (less robust): check if timer display element exists
            if (document.getElementById('timer-display')) {
                pomodoroTimer.handleTimerEnd(request.newState).then(() => {
                     sendResponse({ status: "received and handled" });
                }).catch(e => {
                     console.error("Error handling timerEnded:", e);
                     sendResponse({ status: "error handling timerEnded" });
                });
            } else {
                 console.warn("Pomodoro timer UI not ready to handle timer end.");
                 sendResponse({ status: "received but UI not ready" });
            }
         } else {
             console.warn("Pomodoro timer component or handleTimerEnd function not available.");
             sendResponse({ status: "received but handler missing" });
         }
         return true; // Explicitly return true for async response
    }
     else if (request.command === 'updateTimerDisplay') {
         shouldRespondAsync = true; // Indicate potential async handling below
         if (typeof pomodoroTimer !== 'undefined' && pomodoroTimer.syncWithBackground) {
            pomodoroTimer.syncWithBackground().then(() => {
                sendResponse({ status: "received and synced" });
            }).catch(e => {
                 console.error("Error syncing timer display:", e);
                 sendResponse({ status: "error syncing timer display" });
            });
         } else {
              console.warn("Pomodoro timer component or syncWithBackground not available.");
              sendResponse({ status: "received but handler missing" });
         }
         return true; // Explicitly return true for async response
     }
     else if (request.command === 'proStatusChanged') {
        shouldRespondAsync = true; // Response happens after async init
        console.log('Pro status changed, re-initializing UI...');
        // Re-initialize components that depend on pro status
        initializeApp().then(() => {
            sendResponse({ status: "received and re-initialized" });
        }).catch(e => {
             console.error("Error re-initializing after pro status change:", e);
             sendResponse({ status: "error during re-init" });
        });
        return true; // Explicitly return true for async response
    }

    // If no specific handler matched or no async operation needed
    console.log(`No specific handler for command: ${request.command} or no async response needed.`);
    // sendResponse({ status: "received, no action taken" }); // Optional: send sync response
    return false; // Return false if not sending an async response
});


// Main Initialization function for the popup
async function initializeApp() {
    console.log("Initializing Productivity Dashboard Popup...");

     // Ensure core utilities are loaded and available
     if (typeof storage === 'undefined' || typeof proFeatures === 'undefined' || typeof themeManager === 'undefined') {
         console.error("Core utilities (storage, proFeatures, themeManager) not loaded. Popup cannot initialize.");
         document.body.innerHTML = `<p class="text-red-500 p-4">Error: Core components failed to load.</p>`;
         return; // Stop initialization
     }

    // 1. Initialize Pro Features Check FIRST
    await proFeatures.init();
    isProUserGlobally = await proFeatures.isProUser();

    // 1.5 Initialize Sound Manager (needs storage, loads its own state)
     if (isProUserGlobally && typeof soundManager !== 'undefined' && soundManager.init) {
        console.log("Initializing Sound Manager for Pro user...");
        await soundManager.init();
     } else if (typeof soundManager === 'undefined') {
        console.warn("SoundManager script not found or loaded.");
     } else {
        console.log("User is not Pro, skipping Sound Manager initialization.");
     }

    // 2. Initialize Other Managers (ensure their scripts are loaded)
     if (typeof themeManager !== 'undefined' && themeManager.init) await themeManager.init(); else console.warn("ThemeManager not loaded/init missing");
     if (typeof statsTracker !== 'undefined' && statsTracker.init) await statsTracker.init(); else console.warn("StatsTracker not loaded/init missing");
     if (typeof taskManager !== 'undefined' && taskManager.init) await taskManager.init(); else console.warn("TaskManager not loaded/init missing");
     if (typeof pomodoroTimer !== 'undefined' && pomodoroTimer.init) await pomodoroTimer.init(); else console.warn("PomodoroTimer not loaded/init missing"); // Now soundManager should be ready if Pro
     if (typeof tabLimiter !== 'undefined' && tabLimiter.init) await tabLimiter.init(); else console.warn("TabLimiter not loaded/init missing");
     if (isProUserGlobally && typeof streakTracker !== 'undefined' && streakTracker.init) await streakTracker.init(); // Init streak tracker only if Pro

    // 3. Load dynamic content
    loadMotivationalQuote();

    // 4. Update UI based on Pro Status
     proFeatures.updateUIVisibility();

    console.log("Popup Initialization complete.");
}

// Run initialization when the popup DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);