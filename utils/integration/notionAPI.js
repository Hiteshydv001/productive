// utils/integration/notionAPI.js
// REQUIRED ONLY for the Notion Integration Pro Feature.

// --- IMPORTANT SETUP ---
// 1. User creates a Notion Integration: https://www.notion.so/my-integrations
// 2. User gets the "Internal Integration Token" (API Key).
// 3. User creates a Notion Database with desired properties (e.g., Task Name [Title], Status [Select], Completed Date [Date], Notes [Text]).
// 4. User shares the Database with the created Integration (Click Share > Invite > Select Integration).
// 5. User copies the Database ID from the Database URL (the part between notion.so/ and ?v=...).
// 6. Extension needs UI (likely in dashboard.js/dashboard.html) for the user to securely input and save their API Key and Database ID into chrome.storage.local.
//    NEVER HARDCODE THE API KEY IN THE CODE.

const notionAPI = {
    BASE_URL: 'https://api.notion.com/v1',
    NOTION_VERSION: '2022-06-28', // Use the latest stable version

    // --- Credentials Helper ---
    // Retrieves Notion API Key and Database ID from storage.
    _getNotionCredentials: async () => {
        // Keys MUST be stored securely, e.g., in chrome.storage.local, set via user input
        const data = await storage.get({ notionApiKey: null, notionDatabaseId: null });
        if (!data.notionApiKey || !data.notionDatabaseId) {
            console.error("Notion API Key or Database ID not configured.");
             chrome.notifications.create('notion-config-error', {
                 type: 'basic', iconUrl: '/assets/icons/icon-48.png',
                 title: 'Notion Configuration Needed',
                 message: 'Please enter your Notion API Key and Database ID in the Dashboard settings.'
             });
            return null; // Indicate missing credentials
        }
        return { apiKey: data.notionApiKey, databaseId: data.notionDatabaseId };
    },

    // --- API Call Helper ---
    _fetchAPI: async (path, method = 'GET', body = null) => {
        const credentials = await notionAPI._getNotionCredentials();
        if (!credentials) {
            throw new Error("Notion credentials not available.");
        }

        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${credentials.apiKey}`,
                'Notion-Version': notionAPI.NOTION_VERSION,
                'Content-Type': 'application/json'
            }
        };

        if (body && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        const url = `${notionAPI.BASE_URL}${path}`;
        console.log(`Fetching Notion: ${method} ${url}`);

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error(`Notion API Error (${response.status}):`, errorData);
                throw new Error(`Notion API request failed: ${errorData.message || `Status ${response.status}`}`);
            }

            // Handle 204 No Content or similar if needed
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error("Network or Fetch error for Notion:", error);
            throw error; // Re-throw
        }
    },

    // --- Public API Methods ---

    // Example: Push a completed task object to the configured Notion database
    // taskObject: The task object from taskManager.js (e.g., { id: '...', text: '...', completedDate: '...' })
    pushCompletedTask: async (taskObject) => {
        const credentials = await notionAPI._getNotionCredentials();
        if (!credentials) return; // Credentials error already handled by helper

        // --- VERY IMPORTANT: Property names MUST match your Notion Database exactly ---
        // This example assumes specific property names and types. You might need
        // a configuration step where the user maps extension fields to Notion properties.
        const properties = {
            // Assumes a 'Task Name' property of type 'Title'
            'Task Name': {
                title: [
                    { text: { content: taskObject.text || 'Untitled Task' } }
                ]
            },
            // Assumes a 'Status' property of type 'Select' with an option named "Completed"
             'Status': {
                 select: { name: 'Completed' }
             },
            // Assumes a 'Completed Date' property of type 'Date'
             'Completed Date': {
                 date: { start: taskObject.completedDate || dateUtils.getTodayKey() } // Format YYYY-MM-DD
             },
            // Assumes a 'Notes' property of type 'Rich Text' (optional)
            // 'Notes': {
            //     rich_text: [
            //         { text: { content: taskObject.notes || '' } }
            //     ]
            // }
            // --- Add other properties as needed based on your Notion DB structure ---
        };

        const body = {
            parent: { database_id: credentials.databaseId },
            properties: properties
        };

        try {
            const result = await notionAPI._fetchAPI('/pages', 'POST', body);
            console.log("Task successfully pushed to Notion:", result);
            return result;
        } catch (error) {
            console.error("Failed to push task to Notion:", error);
            // Optionally notify user
            return null;
        }
    },

    // Example: Query the database (e.g., check if a task already exists)
    // filter: Notion API filter object (https://developers.notion.com/reference/post-database-query-filter)
    queryDatabase: async (filter = null, sorts = null) => {
         const credentials = await notionAPI._getNotionCredentials();
         if (!credentials) return;

         const body = {};
         if (filter) body.filter = filter;
         if (sorts) body.sorts = sorts;

         const path = `/databases/${credentials.databaseId}/query`;
         return await notionAPI._fetchAPI(path, 'POST', Object.keys(body).length > 0 ? body : null);
    }

    // Add other functions as needed: updatePage, findDatabase etc.
};


// Example Usage (called from taskManager.js when a task is completed):
// async function handleTaskCompletionForNotion(task) {
//    const notionEnabled = (await storage.get('notionIntegrationEnabled')).notionIntegrationEnabled; // Check if user enabled it
//    if (proFeatures.isPro && notionEnabled) {
//        await notionAPI.pushCompletedTask(task);
//    }
// }