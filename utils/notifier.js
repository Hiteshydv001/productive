const notifier = {
    showNotification: (id, title, message, iconUrl = 'assets/icons/icon-48.png') => {
        chrome.notifications.create(id, {
            type: 'basic',
            iconUrl: iconUrl,
            title: title,
            message: message,
            priority: 1 // 0-2, 2 is highest
        });
    },

    clearNotification: (id) => {
        chrome.notifications.clear(id);
    }
};