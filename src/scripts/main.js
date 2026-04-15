// Main application entry point
class SpeechFlowApp {
    constructor() {
        this.currentView = 'home';
        this.currentEngine = 'web';
        this.isPlayerVisible = false;
        this.isOnline = navigator.onLine;
        this.storage = null;
        this.synth = null;
        this.utterance = null;
        this.sarvamAudio = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.totalTime = 0;
        this.speechQueue = [];
        this.voices = [];
        this.apiKey = '';
        this.debouncedUpdateStats = null;
        this.helpers = null;
        this.validation = null;
        
        this.init();
    }

    async init() {
        this.setupGlobalErrorHandler();
        
        try {
            await this.loadModules();
            this.storage = await this.initStorage();
            
            this.setupEventListeners();
            this.initViews();
            this.checkServiceWorkerSupport();
            this.checkOnlineStatus();
            this.initSpeechSynthesis();
            this.loadSettings();
            this.setupKeyboardShortcuts();
            this.setupDebouncers();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    async loadModules() {
        try {
            const helpersModule = await import('./helpers.js');
            this.helpers = helpersModule.default;
            
            const validationModule = await import('./validation.js');
            this.validation = validationModule.default;
        } catch (error) {
            console.warn('Modules could not be loaded:', error);
            // Create fallback inline helpers
            this.helpers = {
                debounce: (func, wait) => {
                    let timeout;
                    return function(...args) {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => func.apply(this, args), wait);
                    };
                },
                generateId: (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                formatTime: (seconds) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                },
                formatFileSize: (bytes) => {
                    if (bytes < 1024) return bytes + ' B';
                    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                }
            };
            this.validation = {
                validateText: (text) => ({ valid: text && text.trim().length > 0 }),
                validateFile: () => ({ valid: true }),
                validateUrl: (url) => ({ valid: url && url.startsWith('http') }),
                sanitizeText: (text) => text
            };
        }
    }

    setupGlobalErrorHandler() {
        window.onerror = (message, source, lineno, colno, error) => {
            console.error('Global error:', { message, source, lineno, colno, error });
            this.showError('An unexpected error occurred. Please try again.');
            return true;
        };
        
        window.onunhandledrejection = (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showError('An unexpected error occurred. Please try again.');
        };
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        this.generateSpeech();
                        break;
                    case 'u':
                        e.preventDefault();
                        this.showFileUploadModal();
                        break;
                    case 'l':
                        e.preventDefault();
                        this.showUrlModal();
                        break;
                }
            }
            
            switch (e.key) {
                case ' ':
                    if (this.isPlayerVisible) {
                        e.preventDefault();
                        this.togglePlayPause();
                    }
                    break;
                case 'Escape':
                    this.closeAllModals();
                    break;
                case 'ArrowLeft':
                    if (this.isPlayerVisible && this.sarvamAudio) {
                        this.sarvamAudio.currentTime = Math.max(0, this.sarvamAudio.currentTime - 5);
                    }
                    break;
                case 'ArrowRight':
                    if (this.isPlayerVisible && this.sarvamAudio) {
                        this.sarvamAudio.currentTime = Math.min(this.totalTime, this.sarvamAudio.currentTime + 5);
                    }
                    break;
                case 'm':
                    if (this.isPlayerVisible) {
                        this.toggleMute();
                    }
                    break;
            }
        });
    }

    setupDebouncers() {
        if (this.helpers && this.helpers.debounce) {
            this.debouncedUpdateStats = this.helpers.debounce(() => {
                this.updateTextInputStats();
            }, 300);
        } else {
            this.debouncedUpdateStats = () => this.updateTextInputStats();
        }
    }

    toggleMute() {
        const volumeSlider = document.getElementById('player-volume');
        if (volumeSlider) {
            if (volumeSlider.value > 0) {
                this.previousVolume = volumeSlider.value;
                volumeSlider.value = 0;
            } else {
                volumeSlider.value = this.previousVolume || 1;
            }
            
            if (this.sarvamAudio) {
                this.sarvamAudio.volume = parseFloat(volumeSlider.value);
            }
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    async initStorage() {
        try {
            const { default: storageManager } = await import('./storage.js');
            return storageManager;
        } catch (error) {
            console.error('Failed to initialize storage:', error);
            return null;
        }
    }

    initSpeechSynthesis() {
        if ('speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.loadVoices();
            
            this.synth.onvoiceschanged = () => {
                this.loadVoices();
            };
        }
    }

    loadVoices() {
        this.voices = this.synth.getVoices();
        const voiceSelect = document.getElementById('voice-select');
        
        if (voiceSelect && this.voices.length > 0) {
            voiceSelect.innerHTML = '';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select a voice...';
            voiceSelect.appendChild(defaultOption);
            
            this.voices.forEach((voice, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${voice.name} (${voice.lang})`;
                option.setAttribute('data-lang', voice.lang);
                voiceSelect.appendChild(option);
            });
        }
    }

    async loadSettings() {
        try {
            if (this.storage) {
                const settings = await this.storage.getSettings();
                if (settings) {
                    this.apiKey = settings.sarvamApiKey || '';
                    document.getElementById('sarvam-api-key').value = this.apiKey;
                    
                    if (settings.defaultEngine) {
                        this.selectEngine(settings.defaultEngine);
                        document.getElementById('default-engine').value = settings.defaultEngine;
                    }
                    
                    if (settings.theme) {
                        this.applyTheme(settings.theme);
                        document.getElementById('theme-select').value = settings.theme;
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (theme === 'light') {
            document.documentElement.removeAttribute('data-theme');
        } else if (theme === 'system') {
            const handleSystemThemeChange = (e) => {
                if (e.matches) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                }
            };
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
            prefersDark.addEventListener('change', handleSystemThemeChange);
            if (prefersDark.matches) {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        document.querySelectorAll('.engine-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectEngine(e.target.closest('.engine-btn').dataset.engine);
            });
        });

        document.getElementById('generate-btn')?.addEventListener('click', () => {
            this.generateSpeech();
        });

        document.getElementById('clear-btn')?.addEventListener('click', () => {
            document.getElementById('text-input').value = '';
            this.updateTextInputStats();
        });

        document.getElementById('play-pause-btn')?.addEventListener('click', () => {
            this.togglePlayPause();
        });

        document.getElementById('stop-btn')?.addEventListener('click', () => {
            this.stopSpeech();
        });

        document.getElementById('preview-voice-btn')?.addEventListener('click', () => {
            this.previewVoice();
        });

        document.getElementById('upload-file-btn')?.addEventListener('click', () => {
            this.showFileUploadModal();
        });

        document.getElementById('upload-btn')?.addEventListener('click', () => {
            this.showFileUploadModal();
        });

        document.getElementById('login-btn')?.addEventListener('click', () => {
            this.showLoginModal();
        });

        document.getElementById('signup-btn')?.addEventListener('click', () => {
            this.showSignupModal();
        });

        document.getElementById('profile-btn')?.addEventListener('click', () => {
            this.showProfileModal();
        });

        document.getElementById('import-url-btn')?.addEventListener('click', () => {
            this.showUrlModal();
        });

        document.getElementById('documents-list')?.addEventListener('click', (e) => {
            const playBtn = e.target.closest('.play-doc-btn');
            const deleteBtn = e.target.closest('.delete-doc-btn');
            if (playBtn) {
                this.playDocument(playBtn.dataset.id);
            } else if (deleteBtn) {
                this.deleteDocument(deleteBtn.dataset.id);
            }
        });

        document.getElementById('history-list')?.addEventListener('click', (e) => {
            const replayBtn = e.target.closest('.replay-btn');
            if (replayBtn) {
                this.replayHistoryItem(replayBtn.dataset.id);
            }
        });

        document.getElementById('clear-history-btn')?.addEventListener('click', () => {
            this.clearHistory();
        });

        this.setupRangeInputs();
        this.setupModals();
        this.setupSettingsListeners();
        
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
    }

    setupRangeInputs() {
        const ranges = [
            { input: 'speed-range', display: 'speed-value', format: v => `${v.toFixed(1)}x` },
            { input: 'pitch-range', display: 'pitch-value', format: v => v.toFixed(1) },
            { input: 'volume-range', display: 'volume-value', format: v => `${Math.round(v * 100)}%` },
            { input: 'sarvam-pace-range', display: 'sarvam-pace-value', format: v => `${v.toFixed(1)}x` },
            { input: 'sarvam-pitch-range', display: 'sarvam-pitch-value', format: v => v.toFixed(1) }
        ];

        ranges.forEach(({ input, display, format }) => {
            const inputEl = document.getElementById(input);
            const displayEl = document.getElementById(display);
            
            if (inputEl && displayEl) {
                inputEl.addEventListener('input', () => {
                    displayEl.textContent = format(parseFloat(inputEl.value));
                });
            }
        });

        const playerVolume = document.getElementById('player-volume');
        if (playerVolume) {
            playerVolume.addEventListener('input', (e) => {
                if (this.sarvamAudio) {
                    this.sarvamAudio.volume = parseFloat(e.target.value);
                }
            });
        }
    }

    setupModals() {
        const fileModal = document.getElementById('file-upload-modal');
        const urlModal = document.getElementById('url-modal');
        const loginModal = document.getElementById('login-modal');
        const profileModal = document.getElementById('profile-modal');
        
        if (fileModal) {
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-input');
            
            dropZone?.addEventListener('click', () => fileInput?.click());
            
            fileInput?.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
            });
            
            dropZone?.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            
            dropZone?.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            
            dropZone?.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                this.handleFileSelect(e.dataTransfer.files);
            });
            
            document.getElementById('process-files-btn')?.addEventListener('click', () => {
                this.processSelectedFiles();
            });
            
            fileModal.querySelector('.modal-close, .modal-cancel')?.addEventListener('click', () => {
                this.hideModal('file-upload-modal');
            });
        }
        
        if (urlModal) {
            document.getElementById('fetch-url-btn')?.addEventListener('click', () => {
                this.fetchUrlContent();
            });
            
            urlModal.querySelector('.modal-close, .modal-cancel')?.addEventListener('click', () => {
                this.hideModal('url-modal');
            });
        }

        if (loginModal) {
            document.getElementById('login-submit-btn')?.addEventListener('click', () => {
                this.handleLogin();
            });
            
            loginModal.querySelector('.modal-close, .modal-cancel')?.addEventListener('click', () => {
                this.hideModal('login-modal');
            });
        }

        const signupModal = document.getElementById('signup-modal');
        if (signupModal) {
            document.getElementById('signup-submit-btn')?.addEventListener('click', () => {
                this.handleSignup();
            });
            
            signupModal.querySelector('.modal-close, .modal-cancel')?.addEventListener('click', () => {
                this.hideModal('signup-modal');
            });
        }

        if (profileModal) {
            profileModal.querySelector('.modal-close, .modal-cancel')?.addEventListener('click', () => {
                this.hideModal('profile-modal');
            });
        }
    }

    setupSettingsListeners() {
        document.getElementById('save-api-key-btn')?.addEventListener('click', async () => {
            const apiKeyInput = document.getElementById('sarvam-api-key');
            this.apiKey = apiKeyInput.value.trim();
            
            if (this.storage) {
                await this.storage.saveSettings({
                    sarvamApiKey: this.apiKey
                });
            }
            
            this.showNotification('API key saved successfully', 'success');
        });

        document.getElementById('default-engine')?.addEventListener('change', async (e) => {
            if (this.storage) {
                await this.storage.saveSettings({
                    defaultEngine: e.target.value
                });
            }
        });

        document.getElementById('theme-select')?.addEventListener('change', async (e) => {
            this.applyTheme(e.target.value);
            if (this.storage) {
                await this.storage.saveSettings({
                    theme: e.target.value
                });
            }
        });

        document.getElementById('sync-now-btn')?.addEventListener('click', () => {
            this.syncOfflineOperations();
        });

        document.getElementById('clear-cache-btn')?.addEventListener('click', async () => {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
                this.showNotification('Cache cleared', 'success');
            }
        });

        document.getElementById('clear-offline-btn')?.addEventListener('click', async () => {
            if (this.storage) {
                await this.storage.clearStore('offlineQueue');
                this.showNotification('Offline data cleared', 'success');
            }
        });

        document.getElementById('download-btn')?.addEventListener('click', () => {
            this.downloadAudio();
        });
    }

    initViews() {
        this.initHomeView();
        this.initDocumentsView();
        this.initHistoryView();
        this.initSettingsView();
    }

    initHomeView() {
        const textInput = document.getElementById('text-input');
        if (textInput) {
            textInput.addEventListener('input', () => {
                if (this.debouncedUpdateStats) {
                    this.debouncedUpdateStats();
                } else {
                    this.updateTextInputStats();
                }
            });
        }
    }

    initDocumentsView() {
        this.loadDocuments();
    }

    initHistoryView() {
        this.loadHistory();
    }

    initSettingsView() {
        this.updateQueueStatus();
    }

    switchView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        document.getElementById(`${viewName}-view`)?.classList.add('active');
        document.getElementById(`${viewName}-btn`)?.classList.add('active');

        this.currentView = viewName;
    }

    selectEngine(engine) {
        document.querySelectorAll('.engine-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${engine}-speech-btn`)?.classList.add('active');
        
        document.getElementById('web-speech-settings')?.classList.toggle('hidden', engine !== 'web');
        document.getElementById('sarvam-speech-settings')?.classList.toggle('hidden', engine !== 'sarvam');
        
        const playerEngine = document.getElementById('player-engine');
        if (playerEngine) {
            playerEngine.textContent = engine === 'sarvam' ? '(Sarvam AI)' : '(Web Speech)';
        }
        
        this.currentEngine = engine;
    }

    updateTextInputStats() {
        const textInput = document.getElementById('text-input');
        const statsElement = document.getElementById('text-stats');
        
        if (textInput && statsElement) {
            const text = textInput.value;
            const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
            const charCount = text.length;
            
            statsElement.textContent = `${wordCount} words, ${charCount} characters`;
        }
    }

    async generateSpeech() {
        const text = document.getElementById('text-input').value.trim();
        
        if (!text) {
            this.showError('Please enter some text to convert to speech');
            return;
        }

        if (this.currentEngine === 'web') {
            await this.generateWebSpeech(text);
        } else {
            await this.generateSarvamSpeech(text);
        }
    }

    async generateWebSpeech(text) {
        try {
            const generateBtn = document.getElementById('generate-btn');
            const originalText = generateBtn.textContent;
            generateBtn.textContent = 'Generating...';
            generateBtn.disabled = true;

            this.stopSpeech();

            const voiceSelect = document.getElementById('voice-select');
            const selectedIndex = voiceSelect?.value;
            const voice = selectedIndex ? this.voices[selectedIndex] : null;
            
            const speed = parseFloat(document.getElementById('speed-range')?.value || 1);
            const pitch = parseFloat(document.getElementById('pitch-range')?.value || 1);
            const volume = parseFloat(document.getElementById('volume-range')?.value || 1);

            this.utterance = new SpeechSynthesisUtterance(text);
            
            if (voice) {
                this.utterance.voice = voice;
            }
            
            this.utterance.rate = speed;
            this.utterance.pitch = pitch;
            this.utterance.volume = volume;

            this.utterance.onstart = () => {
                this.isPlaying = true;
                this.showPlayer();
            };

            this.utterance.onend = () => {
                this.isPlaying = false;
                this.isPaused = false;
                const playPauseBtn = document.getElementById('play-pause-btn');
                if (playPauseBtn) {
                    playPauseBtn.querySelector('.icon').textContent = '▶';
                }
            };

            this.utterance.onerror = (event) => {
                console.error('Speech error:', event);
                this.isPlaying = false;
                this.showError('Speech generation failed');
            };

            this.synth.speak(this.utterance);

            generateBtn.textContent = originalText;
            generateBtn.disabled = false;

            if (this.isOnline && this.storage) {
                await this.saveToHistory(text, 'web');
            }

        } catch (error) {
            console.error('Speech generation failed:', error);
            this.showError('Failed to generate speech. Please try again.');
            
            const generateBtn = document.getElementById('generate-btn');
            generateBtn.textContent = 'Generate Speech';
            generateBtn.disabled = false;
        }
    }

    async generateSarvamSpeech(text) {
        if (!this.apiKey) {
            this.showError('Please configure your Sarvam AI API key in Settings');
            return;
        }

        try {
            const generateBtn = document.getElementById('generate-btn');
            const originalText = generateBtn.textContent;
            generateBtn.textContent = 'Generating...';
            generateBtn.disabled = true;

            if (!this.apiKey) {
                this.showError('Please enter your Sarvam API key in Settings');
                generateBtn.textContent = originalText;
                generateBtn.disabled = false;
                return;
            }

            const voiceSelect = document.getElementById('sarvam-voice-select');
            const languageSelect = document.getElementById('sarvam-language-select');
            const pace = parseFloat(document.getElementById('sarvam-pace-range')?.value || 1);

            const MAX_TEXT_LENGTH = 2500;
            let truncatedText = text;
            if (text.length > MAX_TEXT_LENGTH) {
                truncatedText = text.substring(0, MAX_TEXT_LENGTH);
                this.showNotification(`Text truncated to ${MAX_TEXT_LENGTH} characters for API limit`, 'warning');
            }

            const requestBody = {
                text: truncatedText,
                target_language_code: languageSelect?.value || 'en-IN',
                speaker: voiceSelect?.value || 'shubh',
                model: 'bulbul:v3',
                pace: pace
            };

            console.log('Sarvam API request:', JSON.stringify(requestBody));
            console.log('API key first 10 chars:', this.apiKey.substring(0, 10));
            console.log('Text length:', truncatedText.length, 'characters');

            let audioBlob;
            try {
                const response = await axios.post('https://api.sarvam.ai/text-to-speech', requestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                        'api-subscription-key': this.apiKey
                    },
                    timeout: 60000
                });
                
                console.log('Response type:', typeof response.data);
                console.log('Response keys:', response.data ? Object.keys(response.data) : 'none');
                
                if (response.data && response.data.audios && response.data.audios.length > 0) {
                    const base64Audio = response.data.audios[0];
                    console.log('Base64 audio length:', base64Audio.length);
                    
                    const binaryString = atob(base64Audio);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
                    console.log('Audio blob size:', audioBlob.size, 'bytes');
                } else {
                    throw new Error('No audio data in API response');
                }
            } catch (axiosError) {
                console.error('Axios error:', axiosError);
                if (axiosError.response) {
                    try {
                        const errorData = JSON.parse(new TextDecoder().decode(axiosError.response.data));
                        console.error('Server error response:', errorData);
                        throw new Error(`API error ${axiosError.response.status}: ${errorData.error?.message || JSON.stringify(errorData)}`);
                    } catch (parseError) {
                        console.error('Could not parse error response');
                        throw new Error(`API error ${axiosError.response.status}: ${axiosError.response.statusText}`);
                    }
                } else if (axiosError.request) {
                    throw new Error('Network error: No response from server. Check your internet connection.');
                } else {
                    throw new Error(`Request error: ${axiosError.message}`);
                }
            }
            const audioUrl = URL.createObjectURL(audioBlob);

            if (this.sarvamAudio) {
                this.sarvamAudio.pause();
                this.sarvamAudio = null;
            }

            this.sarvamAudio = new Audio(audioUrl);
            
            this.sarvamAudio.onended = () => {
                this.isPlaying = false;
                const playPauseBtn = document.getElementById('play-pause-btn');
                if (playPauseBtn) {
                    playPauseBtn.querySelector('.icon').textContent = '▶';
                }
            };

            this.sarvamAudio.onerror = (e) => {
                console.error('Audio error:', e);
                console.error('Audio error code:', this.sarvamAudio.error?.code);
                console.error('Audio error message:', this.sarvamAudio.error?.message);
                this.showError('Audio playback failed: ' + (this.sarvamAudio.error?.message || 'Unknown error'));
                this.isPlaying = false;
            };

            this.sarvamAudio.onloadedmetadata = () => {
                this.totalTime = this.sarvamAudio.duration;
                this.updateTimeDisplay();
            };

            this.sarvamAudio.ontimeupdate = () => {
                this.currentTime = this.sarvamAudio.currentTime;
                this.updateTimeDisplay();
                this.updateProgressBar();
            };

            this.showPlayer();
            await this.sarvamAudio.play();
            this.isPlaying = true;
            
            const playPauseBtn = document.getElementById('play-pause-btn');
            if (playPauseBtn) {
                playPauseBtn.querySelector('.icon').textContent = '⏸';
            }

            generateBtn.textContent = originalText;
            generateBtn.disabled = false;

            if (this.isOnline && this.storage) {
                await this.saveToHistory(text, 'sarvam');
            }

        } catch (error) {
            console.error('Sarvam API error:', error);
            this.showError('Failed to generate speech. Check your API key and try again.');
            
            const generateBtn = document.getElementById('generate-btn');
            generateBtn.textContent = 'Generate Speech';
            generateBtn.disabled = false;
        }
    }

    previewVoice() {
        const previewText = 'This is a preview of the selected voice. Hello world!';
        
        if (this.currentEngine === 'web') {
            this.stopSpeech();
            
            const voiceSelect = document.getElementById('voice-select');
            const selectedIndex = voiceSelect?.value;
            const voice = selectedIndex ? this.voices[selectedIndex] : null;
            
            const speed = parseFloat(document.getElementById('speed-range')?.value || 1);
            const pitch = parseFloat(document.getElementById('pitch-range')?.value || 1);

            this.utterance = new SpeechSynthesisUtterance(previewText);
            
            if (voice) {
                this.utterance.voice = voice;
            }
            
            this.utterance.rate = speed;
            this.utterance.pitch = pitch;

            this.synth.speak(this.utterance);
        } else {
            this.generateSarvamSpeech(previewText);
        }
    }

    async saveToHistory(text, engine) {
        try {
            if (this.storage) {
                const historyItem = {
                    id: `hist_${Date.now()}`,
                    text: text.substring(0, 100),
                    engine: engine,
                    createdAt: new Date()
                };
                await this.storage.saveHistoryItem(historyItem);
            }
        } catch (error) {
            console.error('Failed to save to history:', error);
        }
    }

    showPlayer() {
        const playerContainer = document.getElementById('player-container');
        if (playerContainer) {
            playerContainer.classList.remove('hidden');
            playerContainer.setAttribute('aria-hidden', 'false');
            this.isPlayerVisible = true;
        }
    }

    hidePlayer() {
        const playerContainer = document.getElementById('player-container');
        if (playerContainer) {
            playerContainer.classList.add('hidden');
            playerContainer.setAttribute('aria-hidden', 'true');
            this.isPlayerVisible = false;
        }
    }

    togglePlayPause() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const icon = playPauseBtn?.querySelector('.icon');
        
        if (this.currentEngine === 'web') {
            if (this.isPlaying) {
                if (this.isPaused) {
                    this.synth.resume();
                    this.isPaused = false;
                    icon.textContent = '⏸';
                } else {
                    this.synth.pause();
                    this.isPaused = true;
                    icon.textContent = '▶';
                }
            } else {
                const text = document.getElementById('text-input').value.trim();
                if (text) {
                    this.generateWebSpeech(text);
                }
            }
        } else {
            if (this.sarvamAudio) {
                if (this.isPlaying && !this.isPaused) {
                    this.sarvamAudio.pause();
                    this.isPaused = true;
                    icon.textContent = '▶';
                } else if (this.isPaused) {
                    this.sarvamAudio.play();
                    this.isPaused = false;
                    icon.textContent = '⏸';
                } else {
                    const text = document.getElementById('text-input').value.trim();
                    if (text) {
                        this.generateSarvamSpeech(text);
                    }
                }
            }
        }
    }

    stopSpeech() {
        if (this.currentEngine === 'web') {
            this.synth.cancel();
            this.isPlaying = false;
            this.isPaused = false;
        } else {
            if (this.sarvamAudio) {
                this.sarvamAudio.pause();
                this.sarvamAudio.currentTime = 0;
                this.isPlaying = false;
                this.isPaused = false;
            }
        }
        
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.querySelector('.icon').textContent = '▶';
        }
        
        this.currentTime = 0;
        this.updateTimeDisplay();
        this.updateProgressBar();
    }

    updateTimeDisplay() {
        const currentTimeEl = document.getElementById('current-time');
        const totalTimeEl = document.getElementById('total-time');
        
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(this.currentTime);
        }
        if (totalTimeEl) {
            totalTimeEl.textContent = this.formatTime(this.totalTime);
        }
    }

    updateProgressBar() {
        const progressFill = document.getElementById('progress-fill');
        if (progressFill && this.totalTime > 0) {
            const percent = (this.currentTime / this.totalTime) * 100;
            progressFill.style.width = `${percent}%`;
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    downloadAudio() {
        if (this.currentEngine === 'sarvam' && this.sarvamAudio) {
            const text = document.getElementById('text-input').value.trim();
            const filename = text.substring(0, 30).replace(/[^a-z0-9]/gi, '_') + '.mp3';
            
            fetch(this.sarvamAudio.src)
                .then(response => response.blob())
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
        }
    }

    showFileUploadModal() {
        this.showModal('file-upload-modal');
    }

    showUrlModal() {
        this.showModal('url-modal');
    }

    showLoginModal() {
        this.showModal('login-modal');
    }

    showSignupModal() {
        this.showModal('signup-modal');
    }

    showProfileModal() {
        this.showModal('profile-modal');
    }

    handleLogin() {
        const email = document.getElementById('login-email')?.value;
        const password = document.getElementById('login-password')?.value;
        
        if (!email || !password) {
            this.showError('Please enter email and password');
            return;
        }
        
        this.showNotification('Login functionality coming soon!', 'info');
        this.hideModal('login-modal');
    }

    handleSignup() {
        const name = document.getElementById('signup-name')?.value;
        const email = document.getElementById('signup-email')?.value;
        const password = document.getElementById('signup-password')?.value;
        const confirm = document.getElementById('signup-confirm')?.value;
        
        if (!name || !email || !password) {
            this.showError('Please fill in all fields');
            return;
        }
        
        if (password !== confirm) {
            this.showError('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }
        
        this.showNotification('Signup functionality coming soon!', 'info');
        this.hideModal('signup-modal');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    handleFileSelect(files) {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;
        
        fileList.innerHTML = '';
        
        Array.from(files).forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="file-size">${this.formatFileSize(file.size)}</span>
            `;
            fileList.appendChild(fileItem);
        });
        
        const processBtn = document.getElementById('process-files-btn');
        if (processBtn) {
            processBtn.disabled = files.length === 0;
        }
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async processSelectedFiles() {
        const fileInput = document.getElementById('file-input');
        if (!fileInput?.files) return;
        
        const textInput = document.getElementById('text-input');
        const generateBtn = document.getElementById('generate-btn');
        
        for (const file of fileInput.files) {
            try {
                let content = '';
                const fileName = file.name.toLowerCase();
                
                if (file.type === 'text/plain') {
                    content = await this.readTextFile(file);
                    this.showNotification(`Processed text file: ${file.name}`, 'success');
                } 
                else if (fileName.endsWith('.pdf')) {
                    generateBtn.textContent = 'Processing PDF...';
                    generateBtn.disabled = true;
                    content = await this.parsePDF(file);
                    this.showNotification(`Processed PDF: ${file.name}`, 'success');
                } 
                else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
                    generateBtn.textContent = 'Processing Word...';
                    generateBtn.disabled = true;
                    content = await this.parseWordDocument(file);
                    this.showNotification(`Processed Word doc: ${file.name}`, 'success');
                } 
                else if (file.type.startsWith('image/')) {
                    generateBtn.textContent = 'Performing OCR...';
                    generateBtn.disabled = true;
                    content = await this.performOCR(file);
                    this.showNotification(`Extracted text from image: ${file.name}`, 'success');
                } 
                else {
                    content = `[File: ${file.name}]\nUnsupported file type`;
                }
                
                if (textInput) {
                    textInput.value += (textInput.value ? '\n\n' : '') + content;
                }
                
                generateBtn.textContent = 'Generate Speech';
                generateBtn.disabled = false;
                
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                this.showError(`Failed to process ${file.name}`);
                generateBtn.textContent = 'Generate Speech';
                generateBtn.disabled = false;
            }
        }
        
        this.updateTextInputStats();
        this.hideModal('file-upload-modal');
    }

    async parsePDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n\n';
            }
            
            return fullText || 'No text content found in PDF';
        } catch (error) {
            console.error('PDF parsing error:', error);
            return `Error parsing PDF: ${file.name}`;
        }
    }

    async parseWordDocument(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            return result.value || 'No text content found in document';
        } catch (error) {
            console.error('Word document parsing error:', error);
            return `Error parsing Word document: ${file.name}`;
        }
    }

    async performOCR(file) {
        try {
            const result = await Tesseract.recognize(file, 'eng', {
                logger: m => console.log(m)
            });
            return result.data.text || 'No text found in image';
        } catch (error) {
            console.error('OCR error:', error);
            return `Error performing OCR: ${file.name}`;
        }
    }

    readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    async fetchUrlContent() {
        const urlInput = document.getElementById('url-input');
        const url = urlInput?.value.trim();
        
        if (!url) {
            this.showError('Please enter a URL');
            return;
        }

        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'Accept': 'text/html,text/plain,*/*'
                }
            });
            
            let text = '';
            if (typeof response.data === 'string') {
                text = response.data;
            } else {
                text = JSON.stringify(response.data);
            }
            
            const textInput = document.getElementById('text-input');
            if (textInput) {
                textInput.value += (textInput.value ? '\n\n' : '') + `[URL: ${url}]\n` + text.substring(0, 5000);
            }
            
            this.updateTextInputStats();
            this.hideModal('url-modal');
            this.showNotification('Content imported successfully', 'success');
        } catch (error) {
            console.error('URL fetch error:', error);
            
            let errorMessage = 'Failed to fetch URL content. ';
            
            if (error.code === 'ECONNABORTED') {
                errorMessage += 'Request timed out. Please try a different URL.';
            } else if (error.response) {
                errorMessage += `Server returned: ${error.response.status} ${error.response.statusText}`;
            } else if (error.request) {
                errorMessage += 'The URL does not allow cross-origin requests (CORS). This is a browser security restriction. Try copying and pasting text directly instead, or use a URL that allows public access.';
            } else {
                errorMessage += 'Please check the URL and try again.';
            }
            
            this.showError(errorMessage);
        }
    }

    async loadDocuments() {
        const documentsList = document.getElementById('documents-list');
        if (!documentsList) return;
        
        try {
            if (this.storage) {
                const documents = await this.storage.getAllDocuments();
                
                if (documents.length === 0) {
                    documentsList.innerHTML = `
                        <div class="empty-state">
                            <p>No documents yet. Create or upload a document to get started.</p>
                        </div>
                    `;
                } else {
                    documentsList.innerHTML = '';
                    documents.forEach(doc => {
                        const item = document.createElement('div');
                        item.className = 'document-item';
                        item.innerHTML = `
                            <div class="document-info">
                                <h3>${doc.title || 'Untitled'}</h3>
                                <p class="document-meta">${doc.wordCount || 0} words</p>
                            </div>
                            <div class="document-actions">
                                <button class="btn btn-small btn-primary play-doc-btn" data-id="${doc.id}">▶</button>
                                <button class="btn btn-small btn-secondary delete-doc-btn" data-id="${doc.id}">✕</button>
                            </div>
                        `;
                        documentsList.appendChild(item);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
        }
    }

    async loadHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        try {
            if (this.storage) {
                const history = await this.storage.getAll('history');
                
                if (history.length === 0) {
                    historyList.innerHTML = `
                        <div class="empty-state">
                            <p>No history yet. Your speech generations will appear here.</p>
                        </div>
                    `;
                } else {
                    historyList.innerHTML = '';
                    history.reverse().forEach(item => {
                        const historyItem = document.createElement('div');
                        historyItem.className = 'history-item';
                        historyItem.innerHTML = `
                            <div class="history-info">
                                <h3>${item.text || 'Speech'}</h3>
                                <p class="history-meta">${item.engine} • ${new Date(item.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div class="history-actions">
                                <button class="btn btn-small btn-primary replay-btn" data-id="${item.id}">▶</button>
                            </div>
                        `;
                        historyList.appendChild(historyItem);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    async updateQueueStatus() {
        const queueStatus = document.getElementById('queue-status');
        if (!queueStatus) return;
        
        try {
            if (this.storage) {
                const items = await this.storage.getPendingQueueItems();
                queueStatus.textContent = `${items.length} pending items`;
            }
        } catch (error) {
            queueStatus.textContent = '0 pending items';
        }
    }

    checkServiceWorkerSupport() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                    this.setupServiceWorkerMessaging(registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        } else {
            console.warn('Service Worker is not supported');
        }
    }

    setupServiceWorkerMessaging(registration) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('Message from service worker:', event.data);
        });
    }

    checkOnlineStatus() {
        const statusIndicator = document.getElementById('online-status');
        if (statusIndicator) {
            statusIndicator.textContent = this.isOnline ? 'Online' : 'Offline';
            statusIndicator.className = this.isOnline ? 'status-indicator online' : 'status-indicator offline';
        }
    }

    handleOnlineStatus(isNowOnline) {
        this.isOnline = isNowOnline;
        this.checkOnlineStatus();
        
        const message = isNowOnline ? 'You are now online' : 'You are offline';
        this.showNotification(message, isNowOnline ? 'success' : 'warning');
        
        if (isNowOnline && this.storage) {
            this.syncOfflineOperations();
        }
    }

    async syncOfflineOperations() {
        try {
            if (this.storage) {
                const results = await this.storage.syncOfflineOperations();
                console.log('Sync results:', results);
                this.showNotification(`Synced ${results.length} offline operations`, 'success');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            this.showError('Failed to sync offline operations');
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const colors = {
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#6366f1'
        };
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        container?.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    async playDocument(id) {
        try {
            if (this.storage) {
                const doc = await this.storage.getDocument(id);
                if (doc) {
                    const textInput = document.getElementById('text-input');
                    if (textInput) {
                        textInput.value = doc.content || '';
                        this.updateTextInputStats();
                    }
                    this.switchView('home');
                    await this.generateSpeech();
                }
            }
        } catch (error) {
            console.error('Failed to play document:', error);
            this.showError('Failed to play document');
        }
    }

    async deleteDocument(id) {
        try {
            if (this.storage) {
                await this.storage.delete('documents', id);
                this.loadDocuments();
                this.showNotification('Document deleted', 'success');
            }
        } catch (error) {
            console.error('Failed to delete document:', error);
            this.showError('Failed to delete document');
        }
    }

    async replayHistoryItem(id) {
        try {
            if (this.storage) {
                const history = await this.storage.get('history', id);
                if (history) {
                    const textInput = document.getElementById('text-input');
                    if (textInput) {
                        textInput.value = history.text || '';
                        this.updateTextInputStats();
                    }
                    this.switchView('home');
                    if (history.engine === 'sarvam') {
                        this.selectEngine('sarvam');
                    } else {
                        this.selectEngine('web');
                    }
                    await this.generateSpeech();
                }
            }
        } catch (error) {
            console.error('Failed to replay history item:', error);
            this.showError('Failed to replay');
        }
    }

    async clearHistory() {
        try {
            if (this.storage) {
                await this.storage.clearStore('history');
                this.loadHistory();
                this.showNotification('History cleared', 'success');
            }
        } catch (error) {
            console.error('Failed to clear history:', error);
            this.showError('Failed to clear history');
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SpeechFlowApp();
});
