import { store } from './store.js';
import { initDragAndDrop, setupSidebarDrop } from './drag-drop.js';
import { getLocalDateString, getTomorrowDateString, getYesterdayDateString } from './utils.js';

class App {
    constructor() {
        this.currentView = 'today'; // 'today', 'all', 'scheduled', 'completed', or 'list-ID'
        this.isCompletedHidden = false; // Toggle state

        // DOM Elements
        this.dom = {
            sidebar: document.getElementById('sidebar'),
            mainContent: document.getElementById('main-content'),
            menuBtn: document.getElementById('menu-btn'),
            desktopCollapseBtn: document.getElementById('desktop-collapse-btn'),
            smartListsNav: document.getElementById('smart-lists-nav'),
            customListsNav: document.getElementById('custom-lists-nav'),
            currentListTitle: document.getElementById('current-list-title'),
            currentListDate: document.getElementById('current-list-date'),
            taskList: document.getElementById('task-list'),
            newTaskInput: document.getElementById('new-task-input'),
            newTaskDate: document.getElementById('new-task-date'),
            detailsPanel: document.getElementById('details-panel'),
            appShell: document.getElementById('app-shell'),
            backBtn: document.getElementById('back-btn'),
        };

        this.init();
    }

    async init() {
        // SW Registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('SW Registered'))
                .catch(err => console.error('SW Fail', err));
        }

        // Subscribe to store
        store.subscribe(() => {
            this.render();
        });

        // Subscribe to sync status
        store.subscribeSyncStatus((status) => this.updateSyncIndicator(status));

        this.setupEventListeners();
        this.render();

        // Init Drag & Drop
        initDragAndDrop();

        // Initialize auto-sync (pull from cloud on startup)
        await store.initAutoSync();
    }

    setupEventListeners() {
        // Global Click Delegation
        document.addEventListener('click', e => this.handleClick(e));

        // Inputs
        this.dom.newTaskInput.addEventListener('keypress', e => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.addTask(e.target.value.trim());
                e.target.value = '';
            }
        });

        // Settings Modal
        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());

        // Menu Button (Desktop Trigger)
        this.dom.menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDesktopSidebar();
        });

        // Mobile Back Button
        this.dom.backBtn?.addEventListener('click', () => {
            this.dom.appShell.classList.remove('show-detail');
        });

        // Desktop Collapse Button (in Sidebar)
        this.dom.desktopCollapseBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDesktopSidebar();
        });

        // Quick Add Button
        document.getElementById('quick-add-btn')?.addEventListener('click', () => {
            this.dom.newTaskInput.focus();
        });

        // Details Panel Change Delegation
        this.setupDetailsPanelListeners();
    }

    setupDetailsPanelListeners() {
        const getActiveId = () => this.dom.detailsPanel.dataset.activeTaskId;

        document.getElementById('detail-title').addEventListener('change', (e) => {
            const id = getActiveId();
            if (id) store.updateTask(id, { title: e.target.value });
        });

        document.getElementById('detail-notes').addEventListener('change', (e) => {
            const id = getActiveId();
            if (id) store.updateTask(id, { notes: e.target.value });
        });

        document.getElementById('detail-date').addEventListener('change', (e) => {
            const id = getActiveId();
            if (id) store.updateTask(id, { dueDate: e.target.value });
        });

        document.getElementById('detail-list-select').addEventListener('change', (e) => {
            const id = getActiveId();
            if (id) store.updateTask(id, { listId: e.target.value });
        });

        // Priority Buttons Delegation
        this.dom.detailsPanel.addEventListener('click', (e) => {
            const btn = e.target.closest('.detail-priority-btn');
            if (btn) {
                const id = getActiveId();
                if (id) {
                    store.updateTask(id, { priority: btn.dataset.priority });
                    // Update UI immediately for priority ring
                    this.dom.detailsPanel.querySelectorAll('.detail-priority-btn').forEach(b => {
                        b.classList.toggle('ring-2', b === btn);
                        b.classList.toggle('ring-indigo-500', b === btn);
                    });
                }
            }
        });
    }

    toggleDesktopSidebar() {
        const sidebar = this.dom.sidebar;
        const icon = document.getElementById('sidebar-toggle-icon');
        const isCollapsed = sidebar.classList.toggle('collapsed');

        if (icon) {
            icon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        console.log('[Sidebar] Toggle called. State:', isCollapsed ? 'Collapsed' : 'Expanded');
        sidebar.dataset.collapsed = isCollapsed;
    }

    handleClick(e) {
        const target = e.target;

        // Navigation
        const navItem = target.closest('[data-view]');
        if (navItem) {
            this.currentView = navItem.dataset.view;
            this.render();
            // Mobile: Switch to Detail view
            if (window.innerWidth < 768) {
                this.dom.appShell.classList.add('show-detail');
            }
        }

        // Task Checkbox
        if (target.closest('.task-checkbox')) {
            const taskId = target.closest('li').dataset.taskId;
            const task = store.getTasks().find(t => t.id === taskId);
            store.updateTask(taskId, { completed: !task.completed });
        }

        // Task Item (Open Details)
        if (target.closest('.task-item') && !target.closest('.task-checkbox')) {
            const taskId = target.closest('li').dataset.taskId;
            this.openDetails(taskId);
        }

        // Close Details or Mobile Sidebar
        if (target.closest('#close-details-btn')) {
            this.dom.detailsPanel.classList.add('translate-x-full');
        }


        // Settings Open
        if (target.closest('#settings-btn')) {
            this.openSettings();
        }

        // Sync
        if (target.closest('#sync-now-btn')) {
            this.runSync();
        }

        // Add List
        if (target.closest('#add-list-btn')) {
            const name = prompt('List Name:');
            if (name) store.addList(name);
        }

        // Toggle Completed Hidden
        if (target.closest('#toggle-completed-btn')) {
            this.isCompletedHidden = !this.isCompletedHidden;
            this.render(); // Re-render to filter
        }

        // Defer Today Tasks to Tomorrow
        if (target.closest('#defer-today-btn')) {
            this.deferTodayTasksToTomorrow();
        }

        // (Mobile Menu logic replaced by Menu Button listener)

        // Details Panel Actions
        if (target.id === 'detail-delete-btn') {
            const id = this.dom.detailsPanel.dataset.activeTaskId;
            if (id) {
                store.deleteTask(id);
                this.dom.detailsPanel.classList.add('translate-x-full');
            }
        }
    }

    // --- Logic ---

    addTask(title) {
        let listId = 'list-1'; // Default
        let dueDate = this.dom.newTaskDate.value || null;

        // Contextual Add
        if (this.currentView.startsWith('list-')) {
            listId = this.currentView;
        } else if (this.currentView === 'today') {
            dueDate = new Date().toISOString().split('T')[0];
        }

        store.addTask({
            title,
            listId: this.currentView.startsWith('list-') ? this.currentView : (store.state.lists[0]?.id || 'inbox'),
            dueDate
        });

        this.dom.newTaskDate.value = ''; // Reset date picker
    }

    openDetails(taskId) {
        const task = store.getTasks().find(t => t.id === taskId);
        if (!task) return;

        const panel = this.dom.detailsPanel;
        panel.dataset.activeTaskId = taskId;

        // Populate fields
        document.getElementById('detail-title').value = task.title;
        document.getElementById('detail-notes').value = task.notes || '';
        document.getElementById('detail-date').value = task.dueDate || '';

        // Priority
        document.querySelectorAll('.detail-priority-btn').forEach(btn => {
            if (btn.dataset.priority === task.priority) {
                btn.classList.add('ring-2', 'ring-indigo-500');
            } else {
                btn.classList.remove('ring-2', 'ring-indigo-500');
            }
        });

        // List Select
        const listSelect = document.getElementById('detail-list-select');
        listSelect.innerHTML = store.state.lists.map(l => `<option value="${l.id}" ${l.id === task.listId ? 'selected' : ''}>${l.title}</option>`).join('');

        panel.classList.remove('translate-x-full');
    }

    updateSyncIndicator(status) {
        const dot = document.getElementById('sync-dot');
        const pulse = document.getElementById('sync-pulse');
        const text = document.getElementById('sync-text');

        if (!dot || !text) return;

        switch (status.status) {
            case 'synced':
                dot.className = 'w-2 h-2 rounded-full bg-green-500';
                pulse.className = 'absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-0';
                text.textContent = status.message || '已同步';
                text.className = 'text-xs text-green-600 hidden sm:inline';
                break;
            case 'syncing':
                dot.className = 'w-2 h-2 rounded-full bg-blue-500';
                pulse.className = 'absolute inset-0 w-2 h-2 rounded-full bg-blue-400 animate-ping opacity-75';
                text.textContent = status.message || '同步中...';
                text.className = 'text-xs text-blue-600 hidden sm:inline';
                break;
            case 'pending':
                dot.className = 'w-2 h-2 rounded-full bg-yellow-500';
                pulse.className = 'absolute inset-0 w-2 h-2 rounded-full bg-yellow-400 animate-ping opacity-0';
                text.textContent = status.message || '等待中...';
                text.className = 'text-xs text-yellow-600 hidden sm:inline';
                break;
            case 'error':
                dot.className = 'w-2 h-2 rounded-full bg-red-500';
                pulse.className = 'absolute inset-0 w-2 h-2 rounded-full bg-red-400 animate-ping opacity-0';
                text.textContent = status.message || '同步失败';
                text.className = 'text-xs text-red-600 hidden sm:inline';
                break;
            case 'disabled':
            default:
                dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                pulse.className = 'absolute inset-0 w-2 h-2 rounded-full bg-gray-400 animate-ping opacity-0';
                text.textContent = status.message || '未配置';
                text.className = 'text-xs text-gray-400 hidden sm:inline';
                break;
        }
    }

    openSettings() {
        const s = store.state.settings;
        // Display masked token
        const tokenInput = document.getElementById('gist-token');
        const gistIdInput = document.getElementById('gist-id');

        if (s.gistToken) {
            tokenInput.value = s.gistToken.substring(0, 8) + '****';
            tokenInput.dataset.realToken = s.gistToken;
        } else {
            tokenInput.value = '';
            delete tokenInput.dataset.realToken;
        }

        gistIdInput.value = s.gistId || '';

        document.getElementById('settings-modal').showModal();

        // Bind save on change (auto save for simplicity)
        const save = async () => {
            const tokenValue = tokenInput.value;
            // If token looks masked, use the real one from dataset
            const actualToken = tokenValue.includes('****') && tokenInput.dataset.realToken
                ? tokenInput.dataset.realToken
                : tokenValue;

            store.updateSettings({
                gistToken: actualToken,
                gistId: gistIdInput.value
            });

            // Re-initialize auto-sync with new settings
            await store.initAutoSync();
        };

        tokenInput.onchange = save;
        gistIdInput.onchange = save;

        // Prevent copying masked token
        tokenInput.oncopy = (e) => {
            if (tokenInput.value.includes('****')) {
                e.preventDefault();
                alert('无法复制已脱敏的令牌');
            }
        };
    }

    async runSync() {
        const btn = document.getElementById('sync-now-btn');
        const status = document.getElementById('sync-status');
        btn.disabled = true;
        btn.textContent = 'Syncing...';
        status.textContent = '';

        try {
            await store.syncToGist();
            status.textContent = 'Last synced just now';
            status.className = 'text-xs text-center text-green-500 h-4';
        } catch (e) {
            status.textContent = 'Sync failed. Check console.';
            status.className = 'text-xs text-center text-red-500 h-4';
        }
        btn.disabled = false;
        btn.textContent = 'Sync Now';
    }

    deferTodayTasksToTomorrow() {
        const todayStr = getLocalDateString();
        const tomorrowStr = getTomorrowDateString();
        const todayTasks = store.getTasks().filter(t => t.dueDate === todayStr && !t.completed);

        if (todayTasks.length === 0) {
            alert('No tasks to defer');
            return;
        }

        // Batch update all today tasks to tomorrow
        todayTasks.forEach(task => {
            store.updateTask(task.id, { dueDate: tomorrowStr });
        });

        // Show confirmation
        const count = todayTasks.length;
        alert(`已将 ${count} 个任务推迟到明天`);

        // The store will automatically trigger sync via debouncedCloudSync
    }

    // --- Rendering ---

    render() {
        this.renderSidebar();
        this.renderMain();
    }

    renderSidebar() {
        const smartLists = [
            { id: 'tomorrow', title: 'Tomorrow', icon: 'ArrowRightIcon' },
            { id: 'today', title: 'Today', icon: 'SunIcon' },
            { id: 'yesterday', title: 'Yesterday', icon: 'ArrowLeftIcon' },
            { id: 'all', title: 'All', icon: 'InboxIcon' },
            { id: 'scheduled', title: 'Scheduled', icon: 'CalendarIcon' },
            { id: 'completed', title: 'Completed', icon: 'CheckCircleIcon' }
        ];

        // 1. Render Smart Lists (only if needed or just update state)
        // For simplicity, we compare a hash or just check if children count matches
        if (this.dom.smartListsNav.children.length === 0) {
            this.dom.smartListsNav.innerHTML = smartLists.map(l => `
                <a href="#" data-view="${l.id}" class="group flex items-center px-3 py-2 text-sm font-medium rounded-md">
                    <span class="truncate">${l.title}</span>
                    <span class="ml-auto p-count inline-block py-0.5 px-2 text-xs rounded-full"></span>
                </a>
            `).join('');
        }

        // Update smart list states
        this.dom.smartListsNav.querySelectorAll('[data-view]').forEach(el => {
            const id = el.dataset.view;
            const count = this.getTaskCount(id);
            const isActive = this.currentView === id;

            el.className = `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`;
            const countEl = el.querySelector('.p-count');
            countEl.textContent = count;
            countEl.className = `ml-auto p-count inline-block py-0.5 px-2 text-xs rounded-full ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'}`;
        });

        // 2. Render Custom Lists
        const customLists = store.state.lists;
        const currentCustomIds = Array.from(this.dom.customListsNav.children).map(c => c.dataset.view).join(',');
        const newCustomIds = customLists.map(l => l.id).join(',');

        if (currentCustomIds !== newCustomIds) {
            this.dom.customListsNav.innerHTML = customLists.map(l => `
                <a href="#" data-view="${l.id}" class="group flex items-center px-3 py-2 text-sm font-medium rounded-md list-item-drop">
                    <span class="w-2.5 h-2.5 mr-3 rounded-full bg-${l.color}-500" aria-hidden="true"></span>
                    <span class="truncate">${l.title}</span>
                    <span class="ml-auto p-count inline-block py-0.5 px-2 text-xs rounded-full"></span>
                </a>
            `).join('');

            // Re-setup drop targets only when structure changes
            this.dom.customListsNav.querySelectorAll('.list-item-drop').forEach(el => {
                setupSidebarDrop(el.dataset.view, el);
            });
        }

        // Update custom list states
        this.dom.customListsNav.querySelectorAll('[data-view]').forEach(el => {
            const id = el.dataset.view;
            const count = this.getTaskCount(id);
            const isActive = this.currentView === id;

            el.className = `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`;
            const countEl = el.querySelector('.p-count');
            countEl.textContent = count;
            countEl.className = `ml-auto p-count inline-block py-0.5 px-2 text-xs rounded-full ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'}`;
        });
    }

    renderMain() {
        const currentList = store.state.lists.find(l => l.id === this.currentView);
        const title = currentList ? currentList.title : (this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1));

        // Only update title if changed
        if (this.dom.currentListTitle.textContent !== title) {
            this.dom.currentListTitle.textContent = title;
            this.dom.currentListDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        }

        // Show/hide defer button
        const deferBtn = document.getElementById('defer-today-btn');
        if (this.currentView === 'today') {
            deferBtn?.classList.remove('hidden');
        } else {
            deferBtn?.classList.add('hidden');
        }

        // Filter Logic
        let tasks = store.getTasks();
        const todayStr = getLocalDateString();
        const tomorrowStr = getTomorrowDateString();
        const yesterdayStr = getYesterdayDateString();

        if (this.currentView === 'today') {
            tasks = tasks.filter(t => t.dueDate === todayStr && !t.completed);
        } else if (this.currentView === 'tomorrow') {
            tasks = tasks.filter(t => t.dueDate === tomorrowStr && !t.completed);
        } else if (this.currentView === 'yesterday') {
            tasks = tasks.filter(t => t.dueDate === yesterdayStr);
        } else if (this.currentView === 'scheduled') {
            tasks = tasks.filter(t => t.dueDate && !t.completed);
        } else if (this.currentView === 'completed') {
            tasks = tasks.filter(t => t.completed);
        } else if (this.currentView === 'all') {
            tasks = tasks.filter(t => !t.completed || !this.isCompletedHidden);
        } else {
            tasks = tasks.filter(t => t.listId === this.currentView);
            if (this.isCompletedHidden) tasks = tasks.filter(t => !t.completed);
        }

        // Compare current task IDs with new ones to avoid full re-render of the list if possible
        const newTaskIds = tasks.map(t => t.id + t.completed + t.priority + t.title).join('|');
        if (this.dom.taskList.dataset.renderedHash === newTaskIds) return;

        this.dom.taskList.innerHTML = tasks.map(task => this.createTaskHTML(task)).join('');
        this.dom.taskList.dataset.renderedHash = newTaskIds;

        const emptyState = document.getElementById('empty-state');
        if (tasks.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    }

    getTaskCount(view) {
        const all = store.getTasks();
        const todayStr = getLocalDateString();
        const tomorrowStr = getTomorrowDateString();
        const yesterdayStr = getYesterdayDateString();

        if (view === 'today') return all.filter(t => t.dueDate === todayStr && !t.completed).length;
        if (view === 'tomorrow') return all.filter(t => t.dueDate === tomorrowStr && !t.completed).length;
        if (view === 'yesterday') return all.filter(t => t.dueDate === yesterdayStr).length;
        if (view === 'scheduled') return all.filter(t => t.dueDate && !t.completed).length;
        if (view === 'all') return all.filter(t => !t.completed).length;
        if (view === 'completed') return all.filter(t => t.completed).length;
        // Custom List
        return all.filter(t => t.listId === view && !t.completed).length;
    }

    createTaskHTML(task) {
        const priorityColors = {
            low: 'border-l-4 border-l-blue-400',
            medium: 'border-l-4 border-l-yellow-400',
            high: 'border-l-4 border-l-red-500'
        };

        return `
            <li class="task-item group bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center p-3 cursor-move ${priorityColors[task.priority] || ''}" draggable="true" data-task-id="${task.id}">
                 <button class="task-checkbox mr-4 flex-shrink-0 text-gray-300 hover:text-indigo-500 ${task.completed ? 'text-indigo-500' : ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="${task.completed ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                 </button>
                 
                 <div class="flex-1 min-w-0">
                     <p class="text-sm font-medium text-gray-900 truncate ${task.completed ? 'line-through text-gray-400' : ''}">${task.title}</p>
                     ${task.dueDate ? `<p class="text-xs text-gray-500 flex items-center mt-1"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>${task.dueDate}</p>` : ''}
                 </div>
                 
                 <button class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity p-2" onclick="event.stopPropagation(); window.app.openDetails('${task.id}')">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                 </button>
            </li>
        `;
    }
}

// Attach to window for debug/interaction
window.app = new App();
