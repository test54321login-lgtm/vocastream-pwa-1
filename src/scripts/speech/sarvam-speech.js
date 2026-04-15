// Sarvam AI Speech Module for SpeechFlow PWA
// Handles text-to-speech using Sarvam AI API

class SarvamSpeechEngine {
    constructor() {
        this.apiKey = '';
        this.baseUrl = 'https://api.text.sarvam.ai/text/to_speech';
        
        this.availableVoices = [
            { id: 'ai_speaker', name: 'AI Speaker (Default)', lang: 'multi' },
            { id: 'ai_speaker_female', name: 'AI Speaker Female', lang: 'multi' },
            { id: 'ai_speaker_male', name: 'AI Speaker Male', lang: 'multi' }
        ];
        
        this.availableLanguages = [
            { code: 'en-IN', name: 'English (India)' },
            { code: 'hi-IN', name: 'Hindi' },
            { code: 'ta-IN', name: 'Tamil' },
            { code: 'te-IN', name: 'Telugu' },
            { code: 'kn-IN', name: 'Kannada' },
            { code: 'ml-IN', name: 'Malayalam' },
            { code: 'mr-IN', name: 'Marathi' },
            { code: 'gu-IN', name: 'Gujarati' },
            { code: 'bn-IN', name: 'Bengali' }
        ];
        
        this.defaultSettings = {
            voice: 'ai_speaker',
            language: 'en-IN',
            pace: 1.0,
            pitch: 1.0,
            mode: 'conversational'
        };
        
        this.currentAudio = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.duration = 0;
        
        this.callbacks = {
            onStart: null,
            onEnd: null,
            onError: null,
            onTimeUpdate: null,
            onProgress: null,
            onLoaded: null
        };
        
        this.retryCount = 3;
        this.retryDelay = 1000;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    getApiKey() {
        return this.apiKey;
    }

    isConfigured() {
        return this.apiKey && this.apiKey.trim().length > 0;
    }

    getVoices() {
        return this.availableVoices;
    }

    getLanguages() {
        return this.availableLanguages;
    }

    setDefaultSettings(settings) {
        this.defaultSettings = { ...this.defaultSettings, ...settings };
    }

    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    buildRequestBody(text, options = {}) {
        const settings = { ...this.defaultSettings, ...options };
        
        return {
            inputs: [text],
            target_language: settings.language,
            speaker: settings.voice,
            pace: settings.pace,
            pitch: settings.pitch,
            mode: settings.mode || 'conversational'
        };
    }

    async synthesize(text, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('API key not configured. Please set your Sarvam AI API key in Settings.');
        }

        const requestBody = this.buildRequestBody(text, options);
        
        let lastError;
        for (let attempt = 1; attempt <= this.retryCount; attempt++) {
            try {
                const response = await this.makeRequest(requestBody);
                return response;
            } catch (error) {
                lastError = error;
                console.error(`Attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.retryCount) {
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }
        
        throw new Error(`Failed to synthesize speech after ${this.retryCount} attempts: ${lastError.message}`);
    }

    async makeRequest(body) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': this.apiKey
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('audio')) {
            throw new Error('Invalid response: expected audio content');
        }

        return await response.blob();
    }

    async speak(text, options = {}) {
        this.stop();

        try {
            if (this.callbacks.onProgress) {
                this.callbacks.onProgress(10);
            }

            const audioBlob = await this.synthesize(text, options);
            
            if (this.callbacks.onProgress) {
                this.callbacks.onProgress(50);
            }

            const audioUrl = URL.createObjectURL(audioBlob);
            this.currentAudio = new Audio(audioUrl);
            
            this.currentAudio.onloadedmetadata = () => {
                this.duration = this.currentAudio.duration;
                if (this.callbacks.onLoaded) {
                    this.callbacks.onLoaded(this.duration);
                }
                if (this.callbacks.onProgress) {
                    this.callbacks.onProgress(70);
                }
            };

            this.currentAudio.ontimeupdate = () => {
                this.currentTime = this.currentAudio.currentTime;
                if (this.callbacks.onTimeUpdate) {
                    this.callbacks.onTimeUpdate(this.currentTime, this.duration);
                }
            };

            this.currentAudio.onended = () => {
                this.isPlaying = false;
                this.isPaused = false;
                if (this.callbacks.onEnd) {
                    this.callbacks.onEnd();
                }
            };

            this.currentAudio.onerror = (event) => {
                this.isPlaying = false;
                if (this.callbacks.onError) {
                    this.callbacks.onError(new Error('Audio playback error'));
                }
            };

            await this.currentAudio.play();
            this.isPlaying = true;
            
            if (this.callbacks.onStart) {
                this.callbacks.onStart();
            }
            if (this.callbacks.onProgress) {
                this.callbacks.onProgress(100);
            }

        } catch (error) {
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            throw error;
        }
    }

    pause() {
        if (this.currentAudio && this.isPlaying && !this.isPaused) {
            this.currentAudio.pause();
            this.isPaused = true;
        }
    }

    resume() {
        if (this.currentAudio && this.isPaused) {
            this.currentAudio.play();
            this.isPaused = false;
        }
    }

    pauseToggle() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.duration = 0;
    }

    seek(time) {
        if (this.currentAudio) {
            this.currentAudio.currentTime = time;
        }
    }

    setVolume(volume) {
        if (this.currentAudio) {
            this.currentAudio.volume = Math.max(0, Math.min(1, volume));
        }
    }

    getCurrentTime() {
        return this.currentTime;
    }

    getDuration() {
        return this.duration;
    }

    getState() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTime: this.currentTime,
            duration: this.duration
        };
    }

    async downloadAudio(text, options = {}) {
        const audioBlob = await this.synthesize(text, options);
        return audioBlob;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class SarvamSpeechController {
    constructor() {
        this.engine = new SarvamSpeechEngine();
        this.setupDefaultCallbacks();
    }

    setupDefaultCallbacks() {
        this.engine.setCallbacks({
            onStart: () => console.log('Sarvam speech started'),
            onEnd: () => console.log('Sarvam speech ended'),
            onError: (e) => console.error('Sarvam speech error:', e),
            onTimeUpdate: (current, total) => console.log(`Time: ${current}/${total}`),
            onProgress: (p) => console.log(`Progress: ${p}%`),
            onLoaded: (d) => console.log(`Duration: ${d}s`)
        });
    }

    setApiKey(key) {
        this.engine.setApiKey(key);
    }

    isConfigured() {
        return this.engine.isConfigured();
    }

    getVoices() {
        return this.engine.getVoices();
    }

    getLanguages() {
        return this.engine.getLanguages();
    }

    setDefaultSettings(settings) {
        this.engine.setDefaultSettings(settings);
    }

    setCallbacks(callbacks) {
        this.engine.setCallbacks(callbacks);
    }

    async speak(text, options = {}) {
        return this.engine.speak(text, options);
    }

    async speakPreview(text = 'This is a preview of the selected voice. Hello world!') {
        return this.engine.speak(text, {
            pace: this.engine.defaultSettings.pace,
            pitch: this.engine.defaultSettings.pitch
        });
    }

    pause() {
        this.engine.pause();
    }

    resume() {
        this.engine.resume();
    }

    pauseToggle() {
        this.engine.pauseToggle();
    }

    stop() {
        this.engine.stop();
    }

    seek(time) {
        this.engine.seek(time);
    }

    setVolume(volume) {
        this.engine.setVolume(volume);
    }

    getState() {
        return this.engine.getState();
    }

    async downloadAudio(text, options = {}) {
        return this.engine.downloadAudio(text, options);
    }
}

const sarvamSpeechController = new SarvamSpeechController();

export { SarvamSpeechEngine, SarvamSpeechController, sarvamSpeechController };
export default sarvamSpeechController;