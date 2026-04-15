// Document Processor Module for SpeechFlow PWA
// Handles text extraction, file processing, and URL content fetching

class DocumentProcessor {
    constructor() {
        this.textWorker = null;
        this.ocrWorker = null;
        this.pdfWorker = null;
        this.workersLoaded = false;
    }

    async initWorkers() {
        if (this.workersLoaded) return;
        
        try {
            this.textWorker = new Worker('scripts/workers/text-worker.js');
            this.ocrWorker = new Worker('scripts/workers/ocr-worker.js');
            this.pdfWorker = new Worker('scripts/workers/pdf-worker.js');
            this.workersLoaded = true;
        } catch (error) {
            console.warn('Web Workers not available, falling back to main thread');
            this.workersLoaded = false;
        }
    }

    async normalizeText(text) {
        await this.initWorkers();
        
        if (this.textWorker && !this.isMainThread()) {
            return this.sendToWorker(this.textWorker, { action: 'normalize', data: { text } });
        }
        
        return this.normalizeTextSync(text);
    }

    normalizeTextSync(text) {
        let normalized = text;
        
        normalized = this.fixUnicode(normalized);
        normalized = this.fixPunctuation(normalized);
        normalized = this.removeExtraSpaces(normalized);
        
        return normalized;
    }

    fixUnicode(text) {
        const unicodeMap = {
            '\u2018': "'",
            '\u2019': "'",
            '\u201c': '"',
            '\u201d': '"',
            '\u2013': '-',
            '\u2014': '--',
            '\u2026': '...',
            '\u00a0': ' ',
            '\u200b': ''
        };
        
        let result = text;
        for (const [char, replacement] of Object.entries(unicodeMap)) {
            result = result.replace(new RegExp(char, 'g'), replacement);
        }
        
        return result;
    }

    fixPunctuation(text) {
        let result = text;
        result = result.replace(/\s+([.,!?;:])/g, '$1');
        result = result.replace(/(!{2,})/g, '!');
        result = result.replace(/(\?{2,})/g, '?');
        result = result.replace(/\.\.\./g, '...');
        return result;
    }

    removeExtraSpaces(text) {
        let result = text;
        result = result.replace(/[ \t]+/g, ' ');
        result = result.replace(/^\s+/gm, '');
        result = result.replace(/\s+$/gm, '');
        result = result.replace(/\n{3,}/g, '\n\n');
        return result;
    }

    isMainThread() {
        return typeof window !== 'undefined' && typeof Worker === 'function';
    }

    sendToWorker(worker, message) {
        return new Promise((resolve, reject) => {
            const handler = (e) => {
                if (e.data.action === message.action) {
                    worker.removeEventListener('message', handler);
                    resolve(e.data.result);
                }
            };
            
            worker.addEventListener('message', handler);
            worker.postMessage(message);
            
            setTimeout(() => {
                worker.removeEventListener('message', handler);
                reject(new Error('Worker timeout'));
            }, 10000);
        });
    }

    getTextStats(text) {
        const words = text.trim().split(/\s+/);
        const wordCount = words[0] === '' ? 0 : words.length;
        
        return {
            characters: text.length,
            charactersNoSpaces: text.replace(/\s/g, '').length,
            words: wordCount,
            sentences: (text.match(/[^.!?]+[.!?]+/g) || []).length,
            paragraphs: text.split(/\n\s*\n/).filter(p => p.trim()).length,
            readingTime: Math.ceil(wordCount / 150)
        };
    }

    estimateDuration(text, wordsPerMinute = 150) {
        const words = text.trim().split(/\s+/).length;
        return Math.ceil((words / wordsPerMinute) * 60);
    }
}

class FileProcessor {
    constructor() {
        this.maxFileSize = 10 * 1024 * 1024;
        this.allowedTypes = [
            'text/plain',
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg'
        ];
    }

    async processFile(file) {
        const validation = this.validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        let content = '';

        if (file.type === 'text/plain') {
            content = await this.readTextFile(file);
        } else if (file.type === 'application/pdf') {
            content = await this.processPDF(file);
        } else if (file.type.startsWith('image/')) {
            content = await this.processImage(file);
        }

        return {
            name: file.name,
            type: file.type,
            size: file.size,
            content
        };
    }

    validateFile(file) {
        if (file.size > this.maxFileSize) {
            return { valid: false, error: `File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit` };
        }
        
        if (!this.allowedTypes.includes(file.type)) {
            return { valid: false, error: 'File type not supported' };
        }
        
        return { valid: true };
    }

    readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    async processPDF(file) {
        console.log('PDF processing requires PDF.js worker');
        return `[PDF Document: ${file.name}]\n\nPDF text extraction would be performed here using the PDF worker.`;
    }

    async processImage(file) {
        console.log('Image processing requires OCR worker');
        return `[Image: ${file.name}]\n\nOCR text extraction would be performed here using the OCR worker.`;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
    }
}

class URLProcessor {
    constructor() {
        this.maxContentLength = 50000;
    }

    async fetchContent(url) {
        const validation = this.validateURL(url);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('text/html')) {
                return this.processHTML(await response.text(), url);
            }
            
            return await response.text();
            
        } catch (error) {
            throw new Error(`Failed to fetch URL: ${error.message}`);
        }
    }

    validateURL(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL is required' };
        }

        try {
            const parsed = new URL(url);
            
            if (!['https:', 'http:'].includes(parsed.protocol)) {
                return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
            }
            
            const dangerous = ['javascript:', 'data:', 'vbscript:'];
            if (dangerous.includes(parsed.protocol)) {
                return { valid: false, error: 'Invalid URL protocol' };
            }
            
            return { valid: true };
        } catch (e) {
            return { valid: false, error: 'Invalid URL format' };
        }
    }

    processHTML(html, url) {
        const text = this.stripHTML(html);
        const cleaned = this.cleanContent(text);
        
        if (cleaned.length > this.maxContentLength) {
            return cleaned.substring(0, this.maxContentLength) + '...';
        }
        
        return cleaned;
    }

    stripHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    cleanContent(text) {
        let cleaned = text;
        
        cleaned = cleaned.replace(/\s+/g, ' ');
        cleaned = cleaned.trim();
        
        const noisePatterns = [
            /Cookie Policy.*?\.?\s*/i,
            /Privacy Policy.*?\.?\s*/i,
            /Terms of Service.*?\.?\s*/i,
            /Subscribe to.*?newsletter.*?\.?\s*/i,
            /Follow us on.*?\.?\s*/i,
            /Share on.*?\.?\s*/i
        ];
        
        noisePatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });
        
        return cleaned;
    }

    extractMetadata(url) {
        try {
            const parsed = new URL(url);
            return {
                hostname: parsed.hostname,
                pathname: parsed.pathname,
                protocol: parsed.protocol
            };
        } catch (e) {
            return null;
        }
    }
}

const documentProcessor = new DocumentProcessor();
const fileProcessor = new FileProcessor();
const urlProcessor = new URLProcessor();

export { DocumentProcessor, FileProcessor, URLProcessor, documentProcessor, fileProcessor, urlProcessor };
export default { DocumentProcessor, FileProcessor, URLProcessor, documentProcessor, fileProcessor, urlProcessor };