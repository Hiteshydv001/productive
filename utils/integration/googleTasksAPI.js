// utils/integration/googleTasksAPI.js
// REQUIRED ONLY for the Google Tasks Sync Pro Feature.

// --- IMPORTANT SETUP ---
// 1. Enable Google Tasks API in your Google Cloud Console project.
// 2. Configure OAuth 2.0 Consent Screen in Google Cloud Console.
// 3. Create OAuth 2.0 Client ID (Type: Chrome App). Get the Client ID.
// 4. Add the Client ID and the necessary scope to your manifest.json:
//    "oauth2": {
//      "client_id": "YOUR_GOOGLE_CLOUD_OAUTH_CLIENT_ID.apps.googleusercontent.com",
//      "scopes": [
//        "https://www.googleapis.com/auth/tasks" // Scope for Google Tasks API
//      ]
//    },
//    "permissions": [
//      "identity" // Already included, but ensure it's there
//    ]
// 5. Ensure utils/auth.js handles Google Sign-in if using Firebase auth token, OR use chrome.identity below.

const googleTasksAPI = {
    BASE_URL: 'https://www.googleapis.com/tasks/v1',

    // --- Authentication Helper ---
    // Gets the OAuth 2.0 access token needed for API calls.
    // Uses chrome.identity API.
    _getAccessToken: () => {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError) {
                    console.error("Error getting Google Auth Token:", chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else if (!token) {
                     console.error("Failed to get Google Auth Token (token is null/undefined).");
                     reject(new Error("Authentication token could not be retrieved."));
                } else {
                    console.log("Google Auth Token retrieved successfully.");
                    resolve(token);
                }
            });
        });
        // --- Alternative using Firebase Auth Token (if applicable) ---
        // return new Promise(async (resolve, reject) => {
        //    const tokenData = await chrome.storage.session.get('googleAuthToken');
        //    if (tokenData.googleAuthToken) {
        //        resolve(tokenData.googleAuthToken);
        //    } else {
        //        // Attempt to sign in or refresh token via authManager
        //        const result = await authManager.signInGoogle(); // Ensure signInGoogle returns token
        //        if (result.token) {
        //            resolve(result.token);
        //        } else {
        //             reject(new Error("Google Auth Token not available via Firebase."));
        //        }
        //    }
        // });
    },

    // --- API Call Helper ---
    _fetchAPI: async (path, method = 'GET', body = null) => {
        let accessToken;
        try {
            accessToken = await googleTasksAPI._getAccessToken();
        } catch (error) {
            console.error("Authentication failed:", error);
            // Maybe notify user to re-authenticate
             chrome.notifications.create('google-auth-error', {
                 type: 'basic', iconUrl: '/assets/icons/icon-48.png',
                 title: 'Google Authentication Needed',
                 message: 'Could not connect to Google Tasks. Please try reconnecting in settings.'
             });
            throw new Error("Authentication required."); // Propagate error
        }

        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        const url = `${googleTasksAPI.BASE_URL}${path}`;
        console.log(`Fetching Google Tasks: ${method} ${url}`);

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error(`Google Tasks API Error (${response.status}):`, errorData);
                // Handle specific errors like 401 (unauthorized -> potentially revoke token?)
                if (response.status === 401 || response.status === 403) {
                     // Token might be invalid or expired, try removing it to force re-auth next time
                     chrome.identity.removeCachedAuthToken({ token: accessToken }, () => {});
                     throw new Error(`Authorization failed (${response.status}). Please try again.`);
                }
                throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            }

            // Handle 204 No Content response (common for DELETE)
            if (response.status === 204) {
                return null; // Or return { success: true }
            }

            return await response.json();
        } catch (error) {
            console.error("Network or Fetch error for Google Tasks:", error);
            throw error; // Re-throw the error to be caught by the caller
        }
    },

    // --- Public API Methods ---

    // Get user's task lists
    getTaskLists: async () => {
        return await googleTasksAPI._fetchAPI('/users/@me/lists');
    },

    // Get tasks within a specific task list
    // Optional params: showCompleted, showHidden, dueMax, dueMin etc. (see API docs)
    getTasks: async (taskListId, params = {}) => {
        if (!taskListId) throw new Error("Task List ID is required.");
        const queryParams = new URLSearchParams(params).toString();
        const path = `/lists/${taskListId}/tasks${queryParams ? '?' + queryParams : ''}`;
        return await googleTasksAPI._fetchAPI(path);
    },

    // Create a new task
    createTask: async (taskListId, taskData) => {
        // taskData should be an object like { title: 'My new task', notes: '...', due: 'YYYY-MM-DDTHH:mm:ss.sssZ' }
        if (!taskListId) throw new Error("Task List ID is required.");
        if (!taskData || !taskData.title) throw new Error("Task title is required.");
        const path = `/lists/${taskListId}/tasks`;
        return await googleTasksAPI._fetchAPI(path, 'POST', taskData);
    },

    // Update an existing task (e.g., mark complete, change title)
    updateTask: async (taskListId, taskId, updateData) => {
        // updateData could be { status: 'completed' } or { title: 'New title' } etc.
        if (!taskListId || !taskId) throw new Error("Task List ID and Task ID are required.");
        const path = `/lists/${taskListId}/tasks/${taskId}`;
        return await googleTasksAPI._fetchAPI(path, 'PATCH', updateData); // Or PUT to fully replace
    },

     // Mark task complete helper
     completeTask: async (taskListId, taskId) => {
        return await googleTasksAPI.updateTask(taskListId, taskId, { status: 'completed' });
     },

    // Delete a task
    deleteTask: async (taskListId, taskId) => {
        if (!taskListId || !taskId) throw new Error("Task List ID and Task ID are required.");
        const path = `/lists/${taskListId}/tasks/${taskId}`;
        return await googleTasksAPI._fetchAPI(path, 'DELETE');
    }
};

// Example Usage (called from other parts of the extension, e.g., taskManager.js or dashboard.js):
// async function syncWithGoogle() {
//    try {
//       const lists = await googleTasksAPI.getTaskLists();
//       if (lists && lists.items && lists.items.length > 0) {
//          const primaryListId = lists.items[0].id; // Or let user choose
//          const tasks = await googleTasksAPI.getTasks(primaryListId);
//          console.log("Tasks from Google:", tasks);
//          // ... merge/sync logic with local tasks ...
//       }
//    } catch (error) {
//       console.error("Failed to sync with Google Tasks:", error);
//       // Handle error, maybe disable sync temporarily
//    }
// }