// UI Component Module for SpeechFlow PWA
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.focusableElements = [];
        this.previousActiveElement = null;
    }

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        this.activeModal = modal;
        this.previousActiveElement = document.activeElement;
        modal.classList.remove('hidden');

        this.focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (this.focusableElements.length > 0) {
            this.focusableElements[0].focus();
        }

        modal.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close(modalId));
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close(modalId));
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close(modalId);
            }
        });
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.add('hidden');
        this.activeModal = null;

        if (this.previousActiveElement) {
            this.previousActiveElement.focus();
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') {
            if (this.activeModal) {
                this.close(this.activeModal.id);
            }
        }
        
        if (e.key === 'Tab' && this.focusableElements.length > 0) {
            const firstElement = this.focusableElements[0];
            const lastElement = this.focusableElements[this.focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
}

class ToastNotification {
    constructor() {
        this.container = document.getElementById('toast-container');
        this.defaultDuration = 3000;
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
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
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const icon = this.getIcon(type);
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            warning: '⚠',
            error: '✕',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    success(message, duration) {
        this.show(message, 'success', duration);
    }

    error(message, duration) {
        this.show(message, 'error', duration);
    }

    warning(message, duration) {
        this.show(message, 'warning', duration);
    }

    info(message, duration) {
        this.show(message, 'info', duration);
    }
}

class DropZoneHandler {
    constructor(elementId, options = {}) {
        this.element = document.getElementById(elementId);
        this.options = {
            acceptedTypes: options.acceptedTypes || ['text/plain', 'application/pdf', 'image/png', 'image/jpeg'],
            maxSize: options.maxSize || 10 * 1024 * 1024,
            onFilesSelected: options.onFilesSelected || null,
            onError: options.onError || null
        };

        if (this.element) {
            this.init();
        }
    }

    init() {
        const fileInput = this.element.querySelector('input[type="file"]');
        if (!fileInput) return;

        this.element.addEventListener('click', () => fileInput.click());

        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.element.classList.add('dragover');
        });

        this.element.addEventListener('dragleave', () => {
            this.element.classList.remove('dragover');
        });

        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            this.element.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }

    handleFiles(files) {
        const validFiles = [];
        const errors = [];

        Array.from(files).forEach(file => {
            if (!this.options.acceptedTypes.includes(file.type)) {
                errors.push(`Invalid file type: ${file.name}`);
                return;
            }

            if (file.size > this.options.maxSize) {
                errors.push(`File too large: ${file.name}`);
                return;
            }

            validFiles.push(file);
        });

        if (errors.length > 0 && this.options.onError) {
            this.options.onError(errors);
        }

        if (validFiles.length > 0 && this.options.onFilesSelected) {
            this.options.onFilesSelected(validFiles);
        }
    }
}

class VoiceSelector {
    constructor(selectId, options = {}) {
        this.select = document.getElementById(selectId);
        this.options = {
            voices: options.voices || [],
            onChange: options.onChange || null,
            filterByLanguage: options.filterByLanguage || null
        };

        if (this.select) {
            this.init();
        }
    }

    init() {
        if (this.options.onChange) {
            this.select.addEventListener('change', (e) => {
                this.options.onChange(e.target.value);
            });
        }
    }

    setVoices(voices) {
        this.options.voices = voices;
        this.render();
    }

    render(filterLang = null) {
        if (!this.select) return;

        this.select.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a voice...';
        this.select.appendChild(defaultOption);

        const filteredVoices = filterLang 
            ? this.options.voices.filter(v => v.lang.startsWith(filterLang))
            : this.options.voices;

        filteredVoices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            this.select.appendChild(option);
        });
    }

    filterByLanguage(langCode) {
        this.render(langCode);
    }

    getSelectedVoice() {
        if (!this.select) return null;
        const index = this.select.value;
        return index ? this.options.voices[index] : null;
    }
}

class ProgressTracker {
    constructor(elementId) {
        this.element = document.getElementById(elementId);
    }

    setProgress(percent) {
        if (this.element) {
            this.element.style.width = `${percent}%`;
        }
    }

    setStatus(text) {
        if (this.element) {
            const statusElement = this.element.querySelector('.progress-status');
            if (statusElement) {
                statusElement.textContent = text;
            }
        }
    }

    show() {
        if (this.element) {
            this.element.classList.remove('hidden');
        }
    }

    hide() {
        if (this.element) {
            this.element.classList.add('hidden');
        }
    }
}

export const modalManager = new ModalManager();
export const toast = new ToastNotification();
export { DropZoneHandler, VoiceSelector, ProgressTracker };
export default { modalManager, toast, DropZoneHandler, VoiceSelector, ProgressTracker };