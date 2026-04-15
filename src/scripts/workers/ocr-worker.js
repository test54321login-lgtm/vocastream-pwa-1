// OCR Worker for SpeechFlow PWA
// Web Worker for non-blocking OCR processing using Tesseract.js

let tesseractWorker = null;
let isInitialized = false;

async function initTesseract() {
    if (isInitialized) return;
    
    if (typeof Tesseract === 'undefined') {
        await loadTesseractFromCDN();
    }
    
    tesseractWorker = await Tesseract.createWorker('eng');
    isInitialized = true;
}

function loadTesseractFromCDN() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function performOCR(imageBlob) {
    if (!isInitialized) {
        await initTesseract();
    }
    
    const result = await tesseractWorker.recognize(imageBlob);
    return {
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words,
        lines: result.data.lines
    };
}

async function performOCRFromURL(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return performOCR(blob);
}

self.onmessage = async function(e) {
    const { action, data } = e.data;
    
    try {
        let result;
        
        switch (action) {
            case 'init':
                await initTesseract();
                result = { success: true };
                break;
                
            case 'ocr':
                const ocrResult = await performOCR(data.blob);
                result = ocrResult;
                break;
                
            case 'ocrFromURL':
                const urlResult = await performOCRFromURL(data.url);
                result = urlResult;
                break;
                
            case 'terminate':
                if (tesseractWorker) {
                    await tesseractWorker.terminate();
                    tesseractWorker = null;
                    isInitialized = false;
                }
                result = { success: true };
                break;
                
            default:
                result = { error: 'Unknown action' };
        }
        
        self.postMessage({ action, result });
    } catch (error) {
        self.postMessage({ 
            action, 
            error: error.message,
            result: null 
        });
    }
};