// components/taskManager.js

const taskManager = {
    TASK_LIMIT_FREE: 10,
    tasks: [],
    todayKey: (typeof dateUtils !== 'undefined' ? dateUtils.getTodayKey() : new Date().toISOString().split('T')[0]),
    isPro: false,

    init: async () => {
        if (typeof proFeatures === 'undefined') { console.error("proFeatures unavailable."); taskManager.isPro = false; }
        else { try { taskManager.isPro = await proFeatures.isProUser(); } catch (e) { console.error(e); taskManager.isPro = false; } }
        await taskManager.loadTasks();
        taskManager.renderTasks();
        taskManager.setupEventListeners();
        taskManager.updateUIBasedOnProStatus();
    },

    setupEventListeners: () => {
        document.getElementById('add-task-button')?.addEventListener('click', taskManager.handleAddTask);
        document.getElementById('new-task-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') taskManager.handleAddTask(); });

        const taskList = document.getElementById('task-list');
        if (taskList) {
            taskList.addEventListener('change', (e) => { // Handle checkbox change
                if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox' && e.target.dataset.taskId) {
                    const taskItem = e.target.closest('li.task-item');
                    taskManager.toggleTaskCompletion(e.target.dataset.taskId, e.target.checked, taskItem);
                }
            });
            taskList.addEventListener('click', (e) => { // Handle delete button click
                 if (e.target instanceof Element) {
                    const deleteButton = e.target.closest('.delete-task-button');
                    if (deleteButton && deleteButton.dataset.taskId) {
                        const taskItem = deleteButton.closest('li.task-item');
                        taskManager.deleteTask(deleteButton.dataset.taskId, taskItem);
                    }
                 }
            });
        }
        document.getElementById('upgrade-tasks-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof proFeatures !== 'undefined') proFeatures.showUpgradePopup();
        });
    },

    handleAddTask: async () => {
        const newTaskInput = document.getElementById('new-task-input');
        const addTaskButton = document.getElementById('add-task-button');
        if (!newTaskInput || !addTaskButton) return;
        const text = newTaskInput.value.trim();
        if (!text || !taskManager.checkTaskLimit()) return;

        if (typeof animateButtonClick === 'function') animateButtonClick(addTaskButton);
        await taskManager.addTask(text);
        newTaskInput.value = '';
        newTaskInput.focus();
    },

    checkTaskLimit: () => {
        const limitWarning = document.getElementById('task-limit-warning');
        if (!limitWarning) return true;
        const today = typeof dateUtils !== 'undefined' ? dateUtils.getTodayKey() : new Date().toISOString().split('T')[0];
        const dailyTaskCount = taskManager.tasks.filter(t => t.addedDate === today).length;
        const shouldWarn = !taskManager.isPro && dailyTaskCount >= taskManager.TASK_LIMIT_FREE;
        limitWarning.classList.toggle('hidden', !shouldWarn);
        return !shouldWarn;
    },

    loadTasks: async () => {
       if (typeof storage === 'undefined') { console.error("Storage unavailable."); taskManager.tasks = []; return; }
       try {
          const data = await storage.get({ tasks: [] });
          taskManager.tasks = Array.isArray(data.tasks) ? data.tasks : [];
       } catch (error) { console.error("Error loading tasks:", error); taskManager.tasks = []; }
    },

    saveTasks: async () => {
       if (typeof storage === 'undefined') { console.error("Storage unavailable."); return; }
       try { await storage.set({ tasks: taskManager.tasks }); }
       catch (error) { console.error("Error saving tasks:", error); }
    },

    addTask: async (text, category = 'Work') => {
        const today = typeof dateUtils !== 'undefined' ? dateUtils.getTodayKey() : new Date().toISOString().split('T')[0];
        const newTask = { id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`, text, completed: false, addedDate: today, completedDate: null, category };
        taskManager.tasks.push(newTask);
        taskManager.renderTaskItem(newTask, true); // Animate
        await taskManager.saveTasks();
        taskManager.checkTaskLimit();
        if (typeof statsTracker !== 'undefined') await statsTracker.updateStats();
    },

    toggleTaskCompletion: async (taskId, isCompleted, taskItemElement) => {
        const taskIndex = taskManager.tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
            const today = typeof dateUtils !== 'undefined' ? dateUtils.getTodayKey() : new Date().toISOString().split('T')[0];
            taskManager.tasks[taskIndex].completed = isCompleted;
            taskManager.tasks[taskIndex].completedDate = isCompleted ? today : null;
            await taskManager.saveTasks();
            if (taskItemElement) taskItemElement.classList.toggle('completed', isCompleted);
            else taskManager.renderTasks(); // Fallback
            if (typeof statsTracker !== 'undefined') await statsTracker.updateStats();
        }
    },

    deleteTask: async (taskId, taskItemElement) => {
         const useAnimation = typeof gsap !== 'undefined' && taskItemElement;
         if (useAnimation) {
             gsap.to(taskItemElement, {
                 duration: 0.3, opacity: 0, height: 0, padding: 0, margin: 0, x: -30,
                 ease: "power1.in",
                 onComplete: async () => {
                     try { if(taskItemElement.parentNode) taskItemElement.remove(); } catch (e) {}
                     taskManager.tasks = taskManager.tasks.filter(t => t.id !== taskId);
                     await taskManager.saveTasks();
                     if (typeof statsTracker !== 'undefined') await statsTracker.updateStats();
                     taskManager.checkTaskLimit();
                 }
             });
         } else {
             if (taskItemElement?.parentNode) taskItemElement.remove();
             taskManager.tasks = taskManager.tasks.filter(t => t.id !== taskId);
             await taskManager.saveTasks();
             if(!taskItemElement) taskManager.renderTasks();
             if (typeof statsTracker !== 'undefined') await statsTracker.updateStats();
             taskManager.checkTaskLimit();
         }
    },

    renderTasks: () => {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        taskList.innerHTML = '';
        const sortedTasks = [...taskManager.tasks].sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);
        sortedTasks.forEach(task => taskManager.renderTaskItem(task, false));
    },

    renderTaskItem: (task, shouldAnimate = false) => {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        const li = document.createElement('li');
        li.id = `task-li-${task.id}`;
        li.className = `task-item flex items-center justify-between group bg-[--bg-secondary] hover:bg-[--bg-accent] px-2.5 py-2 rounded-md border border-transparent transition-colors duration-150 ${task.completed ? 'completed' : ''}`;
        li.dataset.taskId = task.id;

        if (shouldAnimate && typeof gsap !== 'undefined') gsap.set(li, { opacity: 0, y: -15 });
        else { li.style.opacity = '1'; li.style.transform = 'none'; }

        li.innerHTML = `
            <div class="flex items-center flex-grow mr-2 overflow-hidden min-w-0">
                <input type="checkbox" data-task-id="${task.id}" id="task-checkbox-${task.id}" class="custom-checkbox flex-shrink-0">
                <label for="task-checkbox-${task.id}" class="truncate cursor-pointer pl-2 text-[--text-primary]" title="${task.text}">${task.text}</label>
            </div>
            <button data-task-id="${task.id}" class="delete-task-button text-[--text-secondary] hover:text-[--danger-color] opacity-0 group-hover:opacity-100 p-1 -mr-1 rounded-full hover:bg-[--danger-color]/10 text-xs flex-shrink-0 transition-all" aria-label="Delete task">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /> </svg>
            </button>
        `;
        const checkbox = li.querySelector(`#task-checkbox-${task.id}`);
        if (checkbox) checkbox.checked = task.completed;

        if (task.completed) taskList.appendChild(li);
        else taskList.prepend(li);

        if (shouldAnimate && typeof gsap !== 'undefined') {
             gsap.to(li, { delay: 0.02, opacity: 1, y: 0, duration: 0.3, ease: "power1.out", clearProps: "opacity,transform" });
        }
    },

     updateUIBasedOnProStatus: () => {
       document.getElementById('pro-tasks-upsell')?.classList.toggle('hidden', taskManager.isPro);
       taskManager.checkTaskLimit();
     }
};