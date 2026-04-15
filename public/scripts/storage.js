// Storage manager for SpeechFlow PWA
class StorageManager {
    constructor() {
        this.dbName = 'SpeechFlowDB';
        this.version = 2;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('Database error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('documents')) {
                    const documentsStore = db.createObjectStore('documents', { keyPath: 'id' });
                    documentsStore.createIndex('title', 'title', { unique: false });
                    documentsStore.createIndex('folderId', 'folderId', { unique: false });
                    documentsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('voiceJobs')) {
                    const jobsStore = db.createObjectStore('voiceJobs', { keyPath: 'id' });
                    jobsStore.createIndex('documentId', 'documentId', { unique: false });
                    jobsStore.createIndex('userId', 'userId', { unique: false });
                    jobsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { keyPath: 'id' });
                    historyStore.createIndex('userId', 'userId', { unique: false });
                    historyStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('offlineQueue')) {
                    const queueStore = db.createObjectStore('offlineQueue', { keyPath: 'id' });
                    queueStore.createIndex('status', 'status', { unique: false });
                    queueStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    const settingsStore = db.createObjectStore('settings', { keyPath: 'id' });
                }

                // Version 2 stores
                if (!db.objectStoreNames.contains('users')) {
                    const usersStore = db.createObjectStore('users', { keyPath: 'id' });
                    usersStore.createIndex('email', 'email', { unique: true });
                }
                
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionsStore.createIndex('userId', 'userId', { unique: false });
                    sessionsStore.createIndex('expiresAt', 'expiresAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('folders')) {
                    const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
                    foldersStore.createIndex('userId', 'userId', { unique: false });
                    foldersStore.createIndex('parentId', 'parentId', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('speechSettings')) {
                    const speechSettingsStore = db.createObjectStore('speechSettings', { keyPath: 'id' });
                    speechSettingsStore.createIndex('userId', 'userId', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('favorites')) {
                    const favoritesStore = db.createObjectStore('favorites', { keyPath: 'id' });
                    favoritesStore.createIndex('userId', 'userId', { unique: false });
                    favoritesStore.createIndex('documentId', 'documentId', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('importSources')) {
                    const importSourcesStore = db.createObjectStore('importSources', { keyPath: 'id' });
                    importSourcesStore.createIndex('userId', 'userId', { unique: false });
                    importSourcesStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    // Generic CRUD operations
    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Document operations
    async saveDocument(document) {
        return this.put('documents', {
            ...document,
            updatedAt: new Date()
        });
    }

    async getDocument(id) {
        return this.get('documents', id);
    }

    async getAllDocuments() {
        return this.getAll('documents');
    }

    // Voice job operations
    async saveVoiceJob(job) {
        return this.put('voiceJobs', {
            ...job,
            updatedAt: new Date()
        });
    }

    async getVoiceJob(id) {
        return this.get('voiceJobs', id);
    }

    async getAllVoiceJobs() {
        return this.getAll('voiceJobs');
    }

    // History operations
    async saveHistoryItem(item) {
        return this.put('history', {
            ...item,
            updatedAt: new Date()
        });
    }

    async getHistoryItems(userId, limit = 20) {
        // This would need a more sophisticated query approach
        return this.getAll('history');
    }

    // Offline queue operations
    async addToQueue(item) {
        return this.put('offlineQueue', {
            ...item,
            createdAt: new Date(),
            status: 'pending'
        });
    }

    async getPendingQueueItems() {
        // This would require a more complex query approach
        return this.getAll('offlineQueue');
    }

    async updateQueueItem(id, updates) {
        const item = await this.get('offlineQueue', id);
        if (item) {
            const updatedItem = { ...item, ...updates, updatedAt: new Date() };
            return this.put('offlineQueue', updatedItem);
        }
        return null;
    }

    // Settings operations
    async saveSettings(settings) {
        return this.put('settings', {
            id: 'user-settings',
            ...settings
        });
    }

    async getSettings() {
        return this.get('settings', 'user-settings');
    }

    // User operations
    async saveUser(user) {
        return this.put('users', {
            ...user,
            createdAt: new Date()
        });
    }

    async getUser(id) {
        return this.get('users', id);
    }

    async getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const index = store.index('email');
            const request = index.get(email);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Session operations
    async saveSession(session) {
        return this.put('sessions', {
            ...session,
            createdAt: new Date()
        });
    }

    async getSession(id) {
        return this.get('sessions', id);
    }

    async getUserSessions(userId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const index = store.index('userId');
            const request = index.getAll(userId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteSession(id) {
        return this.delete('sessions', id);
    }

    async clearExpiredSessions() {
        const now = new Date();
        const sessions = await this.getAll('sessions');
        for (const session of sessions) {
            if (new Date(session.expiresAt) < now) {
                await this.delete('sessions', session.id);
            }
        }
    }

    // Folder operations
    async saveFolder(folder) {
        return this.put('folders', {
            ...folder,
            createdAt: new Date()
        });
    }

    async getFolder(id) {
        return this.get('folders', id);
    }

    async getUserFolders(userId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders'], 'readonly');
            const store = transaction.objectStore('folders');
            const index = store.index('userId');
            const request = index.getAll(userId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getChildFolders(parentId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['folders'], 'readonly');
            const store = transaction.objectStore('folders');
            const index = store.index('parentId');
            const request = index.getAll(parentId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFolder(id) {
        return this.delete('folders', id);
    }

    // Speech settings operations
    async saveSpeechSettings(settings) {
        return this.put('speechSettings', {
            id: 'user-speech-settings',
            ...settings,
            updatedAt: new Date()
        });
    }

    async getSpeechSettings() {
        return this.get('speechSettings', 'user-speech-settings');
    }

    // Favorites operations
    async addFavorite(favorite) {
        return this.put('favorites', {
            ...favorite,
            createdAt: new Date()
        });
    }

    async removeFavorite(id) {
        return this.delete('favorites', id);
    }

    async getUserFavorites(userId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['favorites'], 'readonly');
            const store = transaction.objectStore('favorites');
            const index = store.index('userId');
            const request = index.getAll(userId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async isFavorite(userId, documentId) {
        const favorites = await this.getUserFavorites(userId);
        return favorites.some(f => f.documentId === documentId);
    }

    // Import source operations
    async saveImportSource(source) {
        return this.put('importSources', {
            ...source,
            createdAt: new Date()
        });
    }

    async getImportSources(userId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['importSources'], 'readonly');
            const store = transaction.objectStore('importSources');
            const index = store.index('userId');
            const request = index.getAll(userId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteImportSource(id) {
        return this.delete('importSources', id);
    }

    // Offline sync management
    async syncOfflineOperations() {
        const pendingItems = await this.getPendingQueueItems();
        const results = [];
        
        for (const item of pendingItems) {
            try {
                // Attempt to sync the item
                const result = await this.attemptSync(item);
                results.push({ id: item.id, success: true, result });
            } catch (error) {
                results.push({ id: item.id, success: false, error: error.message });
            }
        }
        
        return results;
    }

    async attemptSync(item) {
        // This would implement the actual sync logic
        // For now, we'll just return a mock result
        return { status: 'synced', timestamp: new Date() };
    }

    // Utility methods
    async clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Export singleton instance
export default new StorageManager();