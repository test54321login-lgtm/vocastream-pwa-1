// Web Speech API Module for SpeechFlow PWA
// Handles browser-based text-to-speech using Web Speech API

class WebSpeechEngine {
    constructor() {
        this.synth = null;
        this.voices = [];
        this.currentUtterance = null;
        this.isSpeaking = false;
        this.isPaused = false;
        
        this.callbacks = {
            onStart: null,
            onEnd: null,
            onError: null,
            onBoundary: null,
            onPause: null,
            onResume: null
        };
        
        this.init();
    }

    init() {
        if ('speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.loadVoices();
            
            this.synth.onvoiceschanged = () => {
                this.loadVoices();
            };
            
            this.synth.onboundary = (event) => {
                if (this.callbacks.onBoundary) {
                    this.callbacks.onBoundary(event);
                }
            };
            
            this.synth.onpause = () => {
                this.isPaused = true;
                if (this.callbacks.onPause) {
                    this.callbacks.onPause();
                }
            };
            
            this.synth.onresume = () => {
                this.isPaused = false;
                if (this.callbacks.onResume) {
                    this.callbacks.onResume();
                }
            };
        }
    }

    loadVoices() {
        if (this.synth) {
            this.voices = this.synth.getVoices();
        }
    }

    getVoices() {
        return this.voices;
    }

    getVoicesByLanguage(langCode) {
        return this.voices.filter(voice => 
            voice.lang.toLowerCase().startsWith(langCode.toLowerCase())
        );
    }

    isSupported() {
        return 'speechSynthesis' in window;
    }

    speak(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.synth) {
                reject(new Error('Speech synthesis not supported'));
                return;
            }

            this.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            
            if (options.voice !== undefined) {
                utterance.voice = options.voice;
            }
            
            utterance.lang = options.lang || 'en-US';
            utterance.rate = options.rate || 1;
            utterance.pitch = options.pitch || 1;
            utterance.volume = options.volume || 1;

            utterance.onstart = () => {
                this.isSpeaking = true;
                if (this.callbacks.onStart) {
                    this.callbacks.onStart();
                }
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                this.isPaused = false;
                if (this.callbacks.onEnd) {
                    this.callbacks.onEnd();
                }
                resolve();
            };

            utterance.onerror = (event) => {
                this.isSpeaking = false;
                if (this.callbacks.onError) {
                    this.callbacks.onError(event);
                }
                reject(new Error(event.error));
            };

            this.currentUtterance = utterance;
            this.synth.speak(utterance);
        });
    }

    cancel() {
        if (this.synth) {
            this.synth.cancel();
            this.isSpeaking = false;
            this.isPaused = false;
        }
    }

    pause() {
        if (this.synth && this.isSpeaking) {
            this.synth.pause();
        }
    }

    resume() {
        if (this.synth && this.isPaused) {
            this.synth.resume();
        }
    }

    pauseToggle() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    getState() {
        return {
            isSpeaking: this.isSpeaking,
            isPaused: this.isPaused,
            pending: this.synth ? this.synth.pending : false
        };
    }

    findVoice(name) {
        return this.voices.find(v => v.name === name);
    }

    findVoiceByLang(lang) {
        return this.voices.find(v => v.lang.startsWith(lang));
    }
}

class WebSpeechController {
    constructor() {
        this.engine = new WebSpeechEngine();
        this.defaultSettings = {
            voice: null,
            lang: 'en-US',
            rate: 1,
            pitch: 1,
            volume: 1
        };
        
        this.setupDefaultCallbacks();
    }

    setupDefaultCallbacks() {
        this.engine.setCallbacks({
            onStart: () => console.log('Web speech started'),
            onEnd: () => console.log('Web speech ended'),
            onError: (e) => console.error('Web speech error:', e),
            onBoundary: (e) => console.log('Word boundary:', e.charIndex),
            onPause: () => console.log('Web speech paused'),
            onResume: () => console.log('Web speech resumed')
        });
    }

    setDefaultSettings(settings) {
        this.defaultSettings = { ...this.defaultSettings, ...settings };
    }

    async speak(text, customOptions = {}) {
        const options = { ...this.defaultSettings, ...customOptions };
        return this.engine.speak(text, options);
    }

    speakPreview(text = 'This is a preview of the selected voice. Hello world!') {
        return this.speak(text, {
            rate: this.defaultSettings.rate,
            pitch: this.defaultSettings.pitch,
            volume: this.defaultSettings.volume
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

    cancel() {
        this.engine.cancel();
    }

    getVoices() {
        return this.engine.getVoices();
    }

    getVoicesByLanguage(langCode) {
        return this.engine.getVoicesByLanguage(langCode);
    }

    isSupported() {
        return this.engine.isSupported();
    }

    getState() {
        return this.engine.getState();
    }
}

const webSpeechController = new WebSpeechController();

export { WebSpeechEngine, WebSpeechController, webSpeechController };
export default webSpeechController;