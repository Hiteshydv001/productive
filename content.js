console.log("Productivity Dashboard Content Script Injected");

let overlayVisible = false;

function showBlockOverlay(blockedUrl) {
    if (overlayVisible) return; // Prevent multiple overlays

    console.log("Showing block overlay for:", blockedUrl);
    overlayVisible = true;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'; // Dark overlay
    overlay.style.color = 'white';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '999999999'; // Ensure it's on top
    overlay.style.fontFamily = 'sans-serif';
    overlay.style.textAlign = 'center';
    overlay.style.padding = '20px';

    overlay.innerHTML = `
        <h1 style="font-size: 2.5em; margin-bottom: 15px;">🚫 Site Blocked</h1>
        <p style="font-size: 1.2em; margin-bottom: 25px;">Access to <strong>${new URL(blockedUrl).hostname}</strong> is blocked during your focus session.</p>
        <p style="font-size: 1em;">Stay focused on your tasks!</p>
        <button id="pd-unblock-temp" style="margin-top: 30px; padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 5px; font-size: 1em; cursor: pointer;">Temporarily Unblock (Not Recommended)</button>
    `;

    document.body.appendChild(overlay);

    // Add listener to the unblock button (optional)
    const unblockButton = document.getElementById('pd-unblock-temp');
    if (unblockButton) {
        unblockButton.addEventListener('click', () => {
             console.log("Temporarily unblocking...");
             // Send message to background to disable blocker temporarily?
             // Or just remove the overlay for this session?
             overlay.remove();
             overlayVisible = false;
             // Potentially notify background: chrome.runtime.sendMessage({ command: 'tempUnblockSite', url: blockedUrl });
        });
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'showBlockOverlay') {
        showBlockOverlay(request.blockedUrl);
        sendResponse({ status: "overlay shown" });
        return true; // Indicates async response possibility
    }
    // Add other commands if needed (e.g., hide overlay)
    return false;
});