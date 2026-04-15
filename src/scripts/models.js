// Data Models for SpeechFlow PWA
// Based on data-models.md specification

export class User {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.email = data.email || '';
        this.username = data.username || '';
        this.displayName = data.displayName || '';
        this.avatarUrl = data.avatarUrl || '';
        this.createdAt = data.createdAt || new Date();
        this.lastLogin = data.lastLogin || null;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.preferences = data.preferences || {
            theme: 'light',
            language: 'en',
            speechSettings: {}
        };
        this.auth = data.auth || {
            jwtToken: '',
            refreshToken: '',
            tokenExpiry: null
        };
    }

    generateId() {
        return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            email: this.email,
            username: this.username,
            displayName: this.displayName,
            avatarUrl: this.avatarUrl,
            createdAt: this.createdAt,
            lastLogin: this.lastLogin,
            isActive: this.isActive,
            preferences: this.preferences,
            auth: this.auth
        };
    }

    static validate(data) {
        const errors = [];
        if (!data.email || !data.email.includes('@')) {
            errors.push('Valid email is required');
        }
        return { valid: errors.length === 0, errors };
    }
}

export class Session {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.userId = data.userId || '';
        this.token = data.token || '';
        this.expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        this.userAgent = data.userAgent || navigator.userAgent;
        this.ipAddress = data.ipAddress || '';
        this.isActive = data.isActive !== undefined ? data.isActive : true;
    }

    generateId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    isExpired() {
        return new Date(this.expiresAt) < new Date();
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            token: this.token,
            expiresAt: this.expiresAt,
            userAgent: this.userAgent,
            ipAddress: this.ipAddress,
            isActive: this.isActive
        };
    }
}

export class Document {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || 'Untitled';
        this.content = data.content || '';
        this.type = data.type || 'text';
        this.source = data.source || {
            type: 'input',
            details: {}
        };
        this.metadata = data.metadata || {
            wordCount: 0,
            charCount: 0,
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
            fileSize: 0
        };
        this.tags = data.tags || [];
        this.folderId = data.folderId || null;
        this.isFavorite = data.isFavorite || false;
        this.isDraft = data.isDraft !== undefined ? data.isDraft : true;
    }

    generateId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    updateMetadata() {
        const content = this.content || '';
        this.metadata.charCount = content.length;
        this.metadata.wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
        this.metadata.updatedAt = new Date();
    }

    setContent(content) {
        this.content = content;
        this.updateMetadata();
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            type: this.type,
            source: this.source,
            metadata: this.metadata,
            tags: this.tags,
            folderId: this.folderId,
            isFavorite: this.isFavorite,
            isDraft: this.isDraft
        };
    }

    static validate(data) {
        const errors = [];
        if (!data.content || data.content.trim().length === 0) {
            errors.push('Content is required');
        }
        if (data.content && data.content.length > 50000) {
            errors.push('Content exceeds maximum length of 50000 characters');
        }
        return { valid: errors.length === 0, errors };
    }
}

export class Folder {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || 'New Folder';
        this.parentId = data.parentId || null;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.isSystem = data.isSystem || false;
        this.sortOrder = data.sortOrder || 0;
    }

    generateId() {
        return `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    rename(newName) {
        this.name = newName;
        this.updatedAt = new Date();
    }

    moveTo(parentId) {
        this.parentId = parentId;
        this.updatedAt = new Date();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            parentId: this.parentId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isSystem: this.isSystem,
            sortOrder: this.sortOrder
        };
    }
}

export class VoiceJob {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.documentId = data.documentId || null;
        this.userId = data.userId || null;
        this.engine = data.engine || 'web';
        this.settings = data.settings || {
            voiceId: '',
            language: 'en-IN',
            speed: 1,
            pitch: 1,
            volume: 1,
            voiceName: 'ai_speaker',
            pace: 1,
            emotion: 'neutral'
        };
        this.status = data.status || 'pending';
        this.progress = data.progress || 0;
        this.result = data.result || {
            audioUrl: '',
            duration: 0,
            createdAt: null
        };
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.attempts = data.attempts || 0;
    }

    generateId() {
        return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    updateProgress(progress) {
        this.progress = Math.min(100, Math.max(0, progress));
        this.updatedAt = new Date();
    }

    setStatus(status) {
        this.status = status;
        this.updatedAt = new Date();
    }

    complete(audioUrl, duration) {
        this.status = 'completed';
        this.progress = 100;
        this.result = {
            audioUrl,
            duration,
            createdAt: new Date()
        };
        this.updatedAt = new Date();
    }

    fail(error) {
        this.status = 'failed';
        this.attempts++;
        this.updatedAt = new Date();
    }

    canRetry() {
        return this.attempts < 3 && this.status === 'failed';
    }

    toJSON() {
        return {
            id: this.id,
            documentId: this.documentId,
            userId: this.userId,
            engine: this.engine,
            settings: this.settings,
            status: this.status,
            progress: this.progress,
            result: this.result,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            attempts: this.attempts
        };
    }
}

export class SpeechSettings {
    constructor(data = {}) {
        this.id = data.id || 'user-speech-settings';
        this.userId = data.userId || null;
        this.engine = data.engine || 'web';
        this.defaultVoiceId = data.defaultVoiceId || '';
        this.defaultLanguage = data.defaultLanguage || 'en-IN';
        this.defaultSpeed = data.defaultSpeed || 1;
        this.defaultPitch = data.defaultPitch || 1;
        this.defaultVolume = data.defaultVolume || 1;
        this.sarvamApiKey = data.sarvamApiKey || '';
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    updateSetting(key, value) {
        if (key in this) {
            this[key] = value;
            this.updatedAt = new Date();
        }
    }

    setSarvamApiKey(apiKey) {
        this.sarvamApiKey = apiKey;
        this.updatedAt = new Date();
    }

    getSettings() {
        return {
            engine: this.engine,
            voiceId: this.defaultVoiceId,
            language: this.defaultLanguage,
            speed: this.defaultSpeed,
            pitch: this.defaultPitch,
            volume: this.defaultVolume
        };
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            engine: this.engine,
            defaultVoiceId: this.defaultVoiceId,
            defaultLanguage: this.defaultLanguage,
            defaultSpeed: this.defaultSpeed,
            defaultPitch: this.defaultPitch,
            defaultVolume: this.defaultVolume,
            sarvamApiKey: this.sarvamApiKey,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

export class HistoryItem {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.userId = data.userId || null;
        this.documentId = data.documentId || null;
        this.jobId = data.jobId || null;
        this.title = data.title || 'Speech';
        this.engine = data.engine || 'web';
        this.voiceName = data.voiceName || '';
        this.language = data.language || 'en-IN';
        this.duration = data.duration || 0;
        this.createdAt = data.createdAt || new Date();
        this.isFavorite = data.isFavorite || false;
    }

    generateId() {
        return `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    toggleFavorite() {
        this.isFavorite = !this.isFavorite;
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            documentId: this.documentId,
            jobId: this.jobId,
            title: this.title,
            engine: this.engine,
            voiceName: this.voiceName,
            language: this.language,
            duration: this.duration,
            createdAt: this.createdAt,
            isFavorite: this.isFavorite
        };
    }
}

export class FavoriteItem {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.userId = data.userId || null;
        this.itemId = data.itemId || '';
        this.itemType = data.itemType || 'document';
        this.title = data.title || '';
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    generateId() {
        return `fav_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            itemId: this.itemId,
            itemType: this.itemType,
            title: this.title,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

export class OfflineQueueItem {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.userId = data.userId || null;
        this.operation = data.operation || 'sync';
        this.payload = data.payload || {};
        this.status = data.status || 'pending';
        this.retryCount = data.retryCount || 0;
        this.maxRetries = data.maxRetries || 3;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    generateId() {
        return `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    updateStatus(status) {
        this.status = status;
        this.updatedAt = new Date();
    }

    incrementRetry() {
        this.retryCount++;
        this.updatedAt = new Date();
    }

    canRetry() {
        return this.retryCount < this.maxRetries && this.status === 'failed';
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            operation: this.operation,
            payload: this.payload,
            status: this.status,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

export class ImportSource {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.userId = data.userId || null;
        this.type = data.type || 'input';
        this.details = data.details || {
            fileName: '',
            fileType: '',
            url: '',
            folderPath: '',
            fileSize: 0
        };
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    generateId() {
        return `import_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            type: this.type,
            details: this.details,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

export default {
    User,
    Session,
    Document,
    Folder,
    VoiceJob,
    SpeechSettings,
    HistoryItem,
    FavoriteItem,
    OfflineQueueItem,
    ImportSource
};