// components/soundManager.js
// Handles playback of ambient sounds during focus sessions (Pro Feature)

const soundManager = {
    currentAudio: null, // Holds the HTMLAudioElement instance
    isPlaying: false,
    isEnabled: false, // User preference from storage
    selectedSound: 'lofi', // Default or loaded from storage
    volume: 0.5, // Default volume (0.0 to 1.0) or loaded from storage

    // Available sounds map (filename without extension -> display name)
    availableSounds: {
        'lofi': 'Lo-fi Beats',
        'rain': 'Rain',
        'cafe': 'Café Ambience'
    },

    init: async () => {
        console.log("Initializing Sound Manager...");
        await soundManager._loadPreferences();
        // No audio element created until play is called
    },

    _loadPreferences: async () => {
        // Ensure storage utility is available
        if (typeof storage === 'undefined') {
            console.error("Storage utility not available for Sound Manager.");
            return;
        }
        const data = await storage.get({
            focusSoundsEnabled: false,
            selectedFocusSound: 'lofi', // Default sound
            focusSoundVolume: 0.5       // Default volume
        });
        soundManager.isEnabled = data.focusSoundsEnabled;
        soundManager.selectedSound = data.selectedFocusSound;
        soundManager.volume = data.focusSoundVolume;
        console.log(`Sound Prefs Loaded: Enabled=${soundManager.isEnabled}, Sound=${soundManager.selectedSound}, Vol=${soundManager.volume}`);
    },

    _savePreferences: async () => {
        // Ensure storage utility is available
        if (typeof storage === 'undefined') {
            console.error("Storage utility not available for Sound Manager preferences saving.");
            return;
        }
        await storage.set({
            focusSoundsEnabled: soundManager.isEnabled,
            selectedFocusSound: soundManager.selectedSound,
            focusSoundVolume: soundManager.volume
        });
         console.log(`Sound Prefs Saved: Enabled=${soundManager.isEnabled}, Sound=${soundManager.selectedSound}, Vol=${soundManager.volume}`);
    },

    // Plays the currently selected sound if sounds are enabled
    playSound: async () => {
        // Double check if Pro and enabled
        // Ensure proFeatures utility is available
        if (typeof proFeatures === 'undefined' || typeof proFeatures.isProUser !== 'function') {
             console.error("proFeatures utility not available for Sound Manager.");
             soundManager.pauseSound(); // Ensure any lingering sound is stopped
             return;
        }
        const isPro = await proFeatures.isProUser();
        if (!isPro || !soundManager.isEnabled) {
            console.log("Sounds disabled or not Pro user.");
            soundManager.pauseSound(); // Ensure any lingering sound is stopped
            return;
        }

        // Validate selected sound
        if (!soundManager.availableSounds[soundManager.selectedSound]) {
            console.warn(`Selected sound "${soundManager.selectedSound}" not found. Defaulting to lofi.`);
            soundManager.selectedSound = 'lofi'; // Fallback to default
            await soundManager._savePreferences();
        }

        const soundFile = `${soundManager.selectedSound}.mp3`;
        let soundUrl;
        try {
            soundUrl = chrome.runtime.getURL(`assets/sounds/${soundFile}`);
        } catch (e) {
             console.error("Error getting sound URL (chrome.runtime may not be available here or file path wrong):", e);
             return;
        }


        // If already playing the correct sound, do nothing
        if (soundManager.isPlaying && soundManager.currentAudio && soundManager.currentAudio.src === soundUrl) {
            console.log(`Sound ${soundManager.selectedSound} already playing.`);
            return;
        }

        // Stop any currently playing sound before starting new one
        soundManager.pauseSound();

        console.log(`Attempting to play sound: ${soundFile}`);
        try {
            // Create or reuse audio element
            if (!soundManager.currentAudio) {
                soundManager.currentAudio = new Audio();
                // Handle potential errors related to loading or unsupported formats
                 soundManager.currentAudio.onerror = (e) => {
                     console.error("Audio Element Error:", e);
                     soundManager.isPlaying = false;
                     soundManager.currentAudio = null; // Reset on error
                 };
            }
            soundManager.currentAudio.src = soundUrl;
            soundManager.currentAudio.volume = soundManager.volume;
            soundManager.currentAudio.loop = true; // Ambient sounds should loop

            // Play returns a Promise which might be rejected if user interaction is needed
            await soundManager.currentAudio.play();
            soundManager.isPlaying = true;
            console.log(`Playing ${soundManager.selectedSound}.`);

        } catch (error) {
            console.error(`Error playing sound ${soundFile}:`, error);
            // Common error: "play() failed because the user didn't interact with the document first."
            // This can happen in background contexts or if the popup opens without user click sometimes.
            // May need to adjust strategy (e.g., only play in response to direct user action like timer start click)
            soundManager.isPlaying = false;
            soundManager.currentAudio = null; // Reset if failed
        }
    },

    // Stops the currently playing sound
    pauseSound: () => {
        if (soundManager.currentAudio && soundManager.isPlaying) {
            try {
                 soundManager.currentAudio.pause();
                 soundManager.currentAudio.currentTime = 0; // Reset playback position
                 soundManager.isPlaying = false;
                 console.log("Sound paused.");
            } catch(error) {
                console.error("Error pausing sound:", error);
                 // Still set isPlaying to false
                 soundManager.isPlaying = false;
            }
        } else {
            // Ensure isPlaying is false even if no audio element existed or wasn't playing
            soundManager.isPlaying = false;
        }
    },

    // Set volume (0.0 to 1.0)
    setVolume: async (level) => {
        const newVolume = Math.max(0, Math.min(1, parseFloat(level))); // Clamp between 0 and 1
        if (isNaN(newVolume)) {
            console.warn("Invalid volume level:", level);
            return;
        }
        soundManager.volume = newVolume;
        if (soundManager.currentAudio) {
            soundManager.currentAudio.volume = soundManager.volume;
        }
        await soundManager._savePreferences();
         console.log("Volume set to:", soundManager.volume);
    },

    // Enable or disable sound playback globally
    setSoundEnabled: async (isEnabled) => {
        soundManager.isEnabled = !!isEnabled; // Ensure boolean
        await soundManager._savePreferences();
        if (!soundManager.isEnabled) {
            soundManager.pauseSound(); // Stop sound if disabled
        }
         console.log("Sounds enabled state set to:", soundManager.isEnabled);
         // If enabling, the sound will start on the next focus session start trigger.
    },

    // Set the sound to be played next time
    setSelectedSound: async (soundName) => {
        if (soundManager.availableSounds[soundName]) {
            const oldSound = soundManager.selectedSound;
            soundManager.selectedSound = soundName;
            await soundManager._savePreferences();
            console.log("Selected sound set to:", soundManager.selectedSound);

            // If a sound is currently playing and enabled, switch to the new one
            if (soundManager.isPlaying && oldSound !== soundManager.selectedSound && soundManager.isEnabled) {
                 console.log("Switching playing sound to:", soundManager.selectedSound);
                 // Ensure pro check again before playing
                 const isPro = await proFeatures.isProUser();
                 if (isPro) {
                    await soundManager.playSound(); // This will pause the old and play the new
                 } else {
                    soundManager.pauseSound(); // Stop sound if somehow playing without pro status
                 }
            }
        } else {
            console.warn(`Attempted to select invalid sound: ${soundName}`);
        }
    }
};