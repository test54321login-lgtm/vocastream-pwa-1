// Validation utilities for SpeechFlow PWA
const Validation = {
    MAX_TEXT_LENGTH: 50000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: ['text/plain', 'application/pdf', 'image/png', 'image/jpeg'],
    ALLOWED_URL_PROTOCOLS: ['https:', 'http:'],
    
    validateText(text) {
        if (!text || typeof text !== 'string') {
            return { valid: false, error: 'Text is required' };
        }
        
        const trimmed = text.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: 'Text cannot be empty' };
        }
        
        if (trimmed.length > this.MAX_TEXT_LENGTH) {
            return { valid: false, error: `Text exceeds maximum length of ${this.MAX_TEXT_LENGTH} characters` };
        }
        
        return { valid: true };
    },
    
    validateFile(file) {
        if (!file) {
            return { valid: false, error: 'File is required' };
        }
        
        if (file.size > this.MAX_FILE_SIZE) {
            return { valid: false, error: `File size exceeds maximum of ${this.MAX_FILE_SIZE / 1024 / 1024}MB` };
        }
        
        if (!this.ALLOWED_FILE_TYPES.includes(file.type)) {
            return { valid: false, error: 'File type not supported. Allowed: txt, pdf, png, jpg' };
        }
        
        return { valid: true };
    },
    
    validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL is required' };
        }
        
        try {
            const parsed = new URL(url);
            
            if (!this.ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)) {
                return { valid: false, error: 'Only http and https URLs are allowed' };
            }
            
            // Basic XSS prevention - reject URLs with dangerous protocols
            const dangerous = ['javascript:', 'data:', 'vbscript:'];
            if (dangerful.includes(parsed.protocol)) {
                return { valid: false, error: 'Invalid URL protocol' };
            }
            
            return { valid: true };
        } catch (e) {
            return { valid: false, error: 'Invalid URL format' };
        }
    },
    
    sanitizeText(text) {
        if (!text) return '';
        
        return text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },
    
    sanitizeFilename(filename) {
        if (!filename) return 'unnamed';
        
        return filename
            .replace(/[^a-z0-9.-]/gi, '_')
            .substring(0, 200);
    },
    
    validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { valid: false, error: 'API key is required' };
        }
        
        const trimmed = key.trim();
        if (trimmed.length < 10) {
            return { valid: false, error: 'Invalid API key format' };
        }
        
        return { valid: true };
    }
};

export default Validation;