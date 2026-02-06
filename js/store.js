export class Store {
    constructor() {
        this.users = {
            'sunny': '930328',
            'jackson': '950127'
        };
        this.currentUser = localStorage.getItem('todo_user');
        this.state = this.loadState() || this.getInitialState();
        this.listeners = [];
        this.syncListeners = [];
        this.debounceSyncTimer = null;
        this.autoSyncEnabled = false;
        this.isSyncing = false; // Prevent overlapping syncs
        this.lastPullTime = 0; // Throttle pulls
        this.saveState(false); // Don't sync on initial load
    }

    getInitialState() {
        return {
            lists: [
                { id: 'list-1', title: 'Work', color: 'blue' },
                { id: 'list-2', title: 'Personal', color: 'green' }
            ],
            tasks: [
                { id: 'task-1', listId: 'list-1', title: 'Welcome to your Private ToDo', completed: false, priority: 'medium', dueDate: null, notes: '', createdAt: Date.now() }
            ],
            settings: {
                gistToken: '',
                gistId: ''
            }
        };
    }

    loadState() {
        try {
            const serialized = localStorage.getItem('todo_pwa_state');
            return serialized ? JSON.parse(serialized) : null;
        } catch (e) {
            console.error('Failed to load state', e);
            return null;
        }
    }

    saveState(shouldSync = true) {
        localStorage.setItem('todo_pwa_state', JSON.stringify(this.state));
        this.notifyListeners();

        // Trigger debounced cloud sync if enabled AND requested
        if (this.autoSyncEnabled && shouldSync) {
            this.debouncedCloudSync();
        }
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => this.listeners = this.listeners.filter(l => l !== listener);
    }

    notifyListeners() {
        this.listeners.forEach(l => l(this.state));
    }

    subscribeSyncStatus(listener) {
        this.syncListeners.push(listener);
        return () => this.syncListeners = this.syncListeners.filter(l => l !== listener);
    }

    notifySyncStatus(status) {
        this.syncListeners.forEach(l => l(status));
    }

    // --- Actions ---

    login(username, password) {
        if (this.users[username] === password) {
            this.currentUser = username;
            localStorage.setItem('todo_user', username);
            this.notifyListeners();
            return true;
        }
        return false;
    }

    logout() {
        localStorage.removeItem('todo_user');
        location.reload();
    }

    getTasks(filterFn = null) {
        // Multi-tenancy: Always filter by owner
        const userTasks = this.state.tasks.filter(t => t.owner === this.currentUser);
        if (!filterFn) return userTasks;
        return userTasks.filter(filterFn);
    }

    addTask(task) {
        const newTask = {
            id: 'task-' + Date.now(),
            createdAt: Date.now(),
            completed: false,
            priority: 'medium',
            notes: '',
            dueDate: null,
            owner: this.currentUser, // Inject current user
            ...task
        };
        this.state.tasks.push(newTask);
        this.saveState();
        return newTask;
    }

    updateTask(id, updates) {
        const index = this.state.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.state.tasks[index] = { ...this.state.tasks[index], ...updates };
            this.saveState();
        }
    }

    deleteTask(id) {
        this.state.tasks = this.state.tasks.filter(t => t.id !== id);
        this.saveState();
    }

    addList(title) {
        const newList = {
            id: 'list-' + Date.now(),
            title,
            color: 'indigo'
        };
        this.state.lists.push(newList);
        this.saveState();
        return newList;
    }

    updateSettings(settings) {
        this.state.settings = { ...this.state.settings, ...settings };
        this.saveState();
    }

    // --- Gitee Gist Sync ---

    async syncToGist() {
        if (this.isSyncing) return;
        const { gistToken, gistId } = this.state.settings;
        if (!gistToken) throw new Error('Gitee Token 未配置');
        if (!gistId) throw new Error('Gist ID 未配置');

        this.isSyncing = true;

        const url = `https://gitee.com/api/v5/gists/${gistId}?access_token=${gistToken}`;

        const body = JSON.stringify({
            files: {
                'todo_backup.json': {
                    content: JSON.stringify(this.state, null, 2)
                }
            }
        });

        try {
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(`同步失败: ${response.status} ${result.message || response.statusText}`);
            }
            return true;
        } catch (error) {
            console.error('Gitee Sync Error:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    // --- Cloud to Local Sync (GET) ---
    async pullFromGist(force = false) {
        if (this.isSyncing) return;

        // Throttling: Don't pull more than once per minute unless forced
        const now = Date.now();
        if (!force && now - this.lastPullTime < 60000) {
            console.log('Pull throttled (last pull was < 60s ago)');
            return;
        }

        const { gistToken, gistId } = this.state.settings;
        if (!gistToken || !gistId) {
            throw new Error('同步未配置');
        }

        const url = `https://gitee.com/api/v5/gists/${gistId}?access_token=${gistToken}`;

        try {
            this.isSyncing = true;
            this.lastPullTime = now;
            this.notifySyncStatus({ status: 'syncing', message: '正在拉取...' });

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(`拉取失败: ${response.status} ${result.message || response.statusText}`);
            }

            const gist = await response.json();
            const fileContent = gist.files['todo_backup.json']?.content;

            if (fileContent) {
                const cloudState = JSON.parse(fileContent);
                // Merge cloud state, preserving settings
                this.state = {
                    ...cloudState,
                    settings: this.state.settings // Keep local settings
                };
                localStorage.setItem('todo_pwa_state', JSON.stringify(this.state));
                this.notifyListeners();
                this.notifySyncStatus({ status: 'synced', message: '已同步' });
                return true;
            } else {
                throw new Error('云端文件为空');
            }
        } catch (error) {
            console.error('Pull from Gitee Error:', error);
            this.notifySyncStatus({ status: 'error', message: error.message || '同步失败' });
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    // --- Debounced Auto-Save ---
    debouncedCloudSync() {
        // Set pending status FIRST, before clearing timer
        this.notifySyncStatus({ status: 'pending', message: '等待保存...' });

        if (this.debounceSyncTimer) {
            clearTimeout(this.debounceSyncTimer);
        }

        this.debounceSyncTimer = setTimeout(async () => {
            try {
                this.notifySyncStatus({ status: 'syncing', message: '正在同步...' });
                await this.syncToGist();
                this.notifySyncStatus({ status: 'synced', message: '已同步' });
            } catch (error) {
                console.error('Auto-sync error:', error);
                this.notifySyncStatus({ status: 'error', message: error.message || '同步失败' });
            }
        }, 500); // 500ms debounce
    }

    // --- Initialize Auto-Sync ---
    async initAutoSync() {
        const { gistToken, gistId } = this.state.settings;

        if (gistToken && gistId) {
            this.autoSyncEnabled = true;

            try {
                // Pull from cloud on startup
                await this.pullFromGist();
            } catch (error) {
                console.error('Initial pull failed:', error);
                // Continue even if pull fails - user can work offline
            }
        } else {
            this.notifySyncStatus({ status: 'disabled', message: '未配置' });
        }
    }

    // --- Maintenance & Debugging ---

    async forceSync() {
        console.log('Force Sync Triggered');
        return await this.syncToGist();
    }

    async runMaintenanceMigration() {
        console.log('Starting maintenance migration...');
        let count = 0;

        // Ensure we have latest data
        await this.pullFromGist(true);

        this.state.tasks.forEach(task => {
            if (!task.owner) {
                task.owner = 'jackson';
                count++;
            }
        });

        if (count > 0) {
            this.saveState(false);
            await this.syncToGist();
        }
        return count;
    }

    // --- Enable/Disable Auto-Sync ---
    setAutoSync(enabled) {
        this.autoSyncEnabled = enabled;
        if (!enabled) {
            this.notifySyncStatus({ status: 'disabled', message: '已禁用' });
        }
    }
}

export const store = new Store();

// Expose to window for debugging
window.store = store;
