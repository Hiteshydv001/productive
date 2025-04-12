const taskManager = {
    TASK_LIMIT_FREE: 10,
    tasks: [],
    todayKey: dateUtils.getTodayKey(),
    isPro: false, // Will be updated by proFeatures.js

    init: async () => {
        taskManager.isPro = await proFeatures.isProUser();
        await taskManager.loadTasks();
        taskManager.renderTasks();
        taskManager.setupEventListeners();
        taskManager.updateUIBasedOnProStatus();
    },

    setupEventListeners: () => {
        const addTaskButton = document.getElementById('add-task-button');
        const newTaskInput = document.getElementById('new-task-input');
        const taskList = document.getElementById('task-list');

        if (addTaskButton) {
            addTaskButton.addEventListener('click', taskManager.handleAddTask);
        }
        if (newTaskInput) {
            newTaskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    taskManager.handleAddTask();
                }
            });
        }
        // Use event delegation for checkbox changes and delete buttons
        if (taskList) {
            taskList.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.dataset.taskId) {
                    taskManager.toggleTaskCompletion(e.target.dataset.taskId, e.target.checked);
                }
            });
            taskList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-task-button') && e.target.dataset.taskId) {
                    taskManager.deleteTask(e.target.dataset.taskId);
                }
                // Add edit functionality here if needed
            });
        }
         // Pro upsell link
         const upgradeLink = document.getElementById('upgrade-tasks-link');
         if (upgradeLink) {
             upgradeLink.addEventListener('click', (e) => {
                 e.preventDefault();
                 // Trigger Pro upgrade flow (e.g., show Stripe checkout)
                 proFeatures.showUpgradePopup();
             });
         }
    },

    handleAddTask: () => {
        const newTaskInput = document.getElementById('new-task-input');
        const text = newTaskInput.value.trim();
        if (!text) return;

        const canAddTask = taskManager.checkTaskLimit();
        if (!canAddTask) {
            return; // Warning already shown
        }

        taskManager.addTask(text);
        newTaskInput.value = ''; // Clear input
    },

    checkTaskLimit: () => {
        const limitWarning = document.getElementById('task-limit-warning');
        const today = dateUtils.getTodayKey();
        const dailyTaskCount = taskManager.tasks.filter(t => t.addedDate === today).length;

        if (!taskManager.isPro && dailyTaskCount >= taskManager.TASK_LIMIT_FREE) {
            if (limitWarning) limitWarning.classList.remove('hidden');
            return false;
        } else {
            if (limitWarning) limitWarning.classList.add('hidden');
            return true;
        }
    },

    loadTasks: async () => {
        // Loads tasks relevant for today's view (or all if Pro/using projects)
        // For simplicity, free loads all, but only counts today's adds towards limit
        const data = await storage.get({ tasks: [] });
        taskManager.tasks = data.tasks || [];
        // Optional: Filter out very old completed tasks if needed for performance
    },

    saveTasks: async () => {
        await storage.set({ tasks: taskManager.tasks });
        // --- PRO FEATURE: Cloud Sync ---
        // if (taskManager.isPro && userIsLoggedIn) {
        //    await storage.setFirebase('tasks', taskManager.tasks);
        // }
    },

    addTask: async (text, category = 'Work') => { // Basic category
        const newTask = {
            id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`, // Unique ID
            text: text,
            completed: false,
            addedDate: dateUtils.getTodayKey(),
            completedDate: null,
            category: category,
            // --- PRO FEATURE: Project ID ---
            // projectId: currentProjectId || null // Add logic for project selection
        };

        taskManager.tasks.push(newTask);
        taskManager.renderTaskItem(newTask); // Add only the new task to the UI
        await taskManager.saveTasks();
        taskManager.checkTaskLimit(); // Re-check limit display after adding
        statsTracker.updateStats(); // Update stats display
    },

    toggleTaskCompletion: async (taskId, isCompleted) => {
        const taskIndex = taskManager.tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
            taskManager.tasks[taskIndex].completed = isCompleted;
            taskManager.tasks[taskIndex].completedDate = isCompleted ? dateUtils.getTodayKey() : null;
            await taskManager.saveTasks();
            taskManager.renderTasks(); // Re-render to apply style/move task
            statsTracker.updateStats(); // Update stats display

            // --- PRO FEATURE: Notion/Google Tasks Integration ---
            // if (taskManager.isPro && isCompleted) {
            //     integration.googleTasks.markTaskComplete(taskId); // Hypothetical function
            //     integration.notion.pushCompletedTask(taskManager.tasks[taskIndex]); // Hypothetical function
            // }
        }
    },

    deleteTask: async (taskId) => {
        taskManager.tasks = taskManager.tasks.filter(t => t.id !== taskId);
        await taskManager.saveTasks();
        taskManager.renderTasks(); // Re-render the list
        statsTracker.updateStats(); // Update stats display
        taskManager.checkTaskLimit(); // Update limit warning if needed
    },

    // --- PRO FEATURE: Edit Task (Example) ---
    // editTask: async (taskId, newText, newCategory, newProjectId) => { ... saveTasks ... renderTasks ... }

    renderTasks: () => {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        taskList.innerHTML = ''; // Clear existing list

        // Show incomplete tasks first, then completed
        const sortedTasks = [...taskManager.tasks].sort((a, b) => a.completed - b.completed);

        sortedTasks.forEach(task => {
            taskManager.renderTaskItem(task);
        });
    },

    renderTaskItem: (task) => {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        const li = document.createElement('li');
        li.className = `task-item flex items-center justify-between group bg-gray-50 dark:bg-gray-700 p-1.5 rounded transition-colors duration-200 ${task.completed ? 'completed' : ''}`;
        li.dataset.taskId = task.id;

        li.innerHTML = `
            <div class="flex items-center flex-grow mr-2 overflow-hidden">
                <input type="checkbox" data-task-id="${task.id}" class="mr-2 form-checkbox h-4 w-4 text-green-500 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:ring-green-500 flex-shrink-0" ${task.completed ? 'checked' : ''}>
                <span class="truncate" title="${task.text}">${task.text}</span>
                 <!-- Optional: Category Tag -->
                 <!-- <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-1 rounded dark:bg-blue-900 dark:text-blue-200">${task.category}</span> -->
            </div>
            <button data-task-id="${task.id}" class="delete-task-button text-red-500 opacity-0 group-hover:opacity-100 text-xs px-1 flex-shrink-0">Delete</button>
        `;
        // Prepend incomplete tasks, append completed tasks
        if (task.completed) {
            taskList.appendChild(li);
        } else {
            taskList.prepend(li);
        }
    },

     updateUIBasedOnProStatus: () => {
         const upsell = document.getElementById('pro-tasks-upsell');
         if (!upsell) return;

         if (taskManager.isPro) {
             upsell.classList.add('hidden');
             // Enable project features UI if implemented
         } else {
             upsell.classList.remove('hidden');
             // Disable project features UI
         }
         taskManager.checkTaskLimit(); // Ensure limit warning respects pro status
     }
};