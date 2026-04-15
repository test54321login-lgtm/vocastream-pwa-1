// API Services Module for SpeechFlow PWA
// Centralized API handling for external services

class ApiService {
    constructor() {
        this.baseTimeout = 30000;
        this.maxRetries = 3;
    }

    async request(url, options = {}) {
        const defaultOptions = {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: this.createTimeoutSignal(options.timeout || this.baseTimeout)
        };

        const fetchOptions = { ...defaultOptions, ...options };
        
        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(url, fetchOptions);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                }
                
                return await response.blob();
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.maxRetries && this.isRetryable(error)) {
                    await this.delay(this.calculateRetryDelay(attempt));
                    continue;
                }
                
                throw error;
            }
        }
        
        throw lastError;
    }

    createTimeoutSignal(timeout) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), timeout);
        return controller.signal;
    }

    isRetryable(error) {
        if (error.name === 'AbortError') return false;
        if (error.message && error.message.includes('network')) return true;
        if (error.message && error.message.includes('timeout')) return true;
        return false;
    }

    calculateRetryDelay(attempt) {
        return Math.min(1000 * Math.pow(2, attempt), 10000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class SarvamApiService extends ApiService {
    constructor() {
        super();
        this.baseUrl = 'https://api.text.sarvam.ai';
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'api-subscription-key': this.apiKey
        };
    }

    async textToSpeech(text, options = {}) {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        const body = {
            inputs: [text],
            target_language: options.language || 'en-IN',
            speaker: options.voice || 'ai_speaker',
            pace: options.pace || 1.0,
            pitch: options.pitch || 1.0,
            mode: options.mode || 'conversational'
        };

        return this.request(`${this.baseUrl}/text/to_speech`, {
            method: 'POST',
            headers: this.getHeaders(),
            body
        });
    }

    isConfigured() {
        return this.apiKey && this.apiKey.length > 0;
    }
}

class CacheService {
    constructor() {
        this.cacheName = 'speechflow-cache';
        this.cacheVersion = 'v1';
    }

    async getCache() {
        if ('caches' in window) {
            return await caches.open(`${this.cacheName}-${this.cacheVersion}`);
        }
        return null;
    }

    async get(key) {
        try {
            const cache = await this.getCache();
            if (!cache) return null;
            
            const response = await cache.match(key);
            if (response) {
                return await response.blob();
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }
        return null;
    }

    async set(key, data) {
        try {
            const cache = await this.getCache();
            if (!cache) return;
            
            const response = new Response(data, {
                headers: { 'Content-Type': 'audio/mpeg' }
            });
            
            await cache.put(key, response);
        } catch (error) {
            console.warn('Cache set error:', error);
        }
    }

    async delete(key) {
        try {
            const cache = await this.getCache();
            if (cache) {
                await cache.delete(key);
            }
        } catch (error) {
            console.warn('Cache delete error:', error);
        }
    }

    async clear() {
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                for (const key of keys) {
                    if (key.startsWith(this.cacheName)) {
                        await caches.delete(key);
                    }
                }
            }
        } catch (error) {
            console.warn('Cache clear error:', error);
        }
    }

    generateCacheKey(text, engine, settings) {
        const settingsStr = JSON.stringify(settings);
        const hash = this.simpleHash(text + settingsStr);
        return `audio_${engine}_${hash}.mp3`;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
}

class StorageService {
    constructor() {
        this.storageKey = 'speechflow_data';
    }

    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Storage save error:', error);
            return false;
        }
    }

    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Storage load error:', error);
            return defaultValue;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('speechflow_')) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    saveApiKey(key) {
        return this.save('speechflow_api_key', key);
    }

    getApiKey() {
        return this.load('speechflow_api_key', '');
    }

    saveSettings(settings) {
        return this.save('speechflow_settings', settings);
    }

    getSettings() {
        return this.load('speechflow_settings', {});
    }
}

const apiService = new ApiService();
const sarvamApiService = new SarvamApiService();
const cacheService = new CacheService();
const storageService = new StorageService();

export { ApiService, SarvamApiService, CacheService, StorageService, apiService, sarvamApiService, cacheService, storageService };
export default { ApiService, SarvamApiService, CacheService, StorageService, apiService, sarvamApiService, cacheService, storageService };