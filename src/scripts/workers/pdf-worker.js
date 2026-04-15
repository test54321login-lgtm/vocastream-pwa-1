// PDF Worker for SpeechFlow PWA
// Web Worker for non-blocking PDF parsing using PDF.js

let pdfjsLib = null;
let pdfDocument = null;

async function loadPDFJS() {
    if (pdfjsLib) return pdfjsLib;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            pdfjsLib = window.pdfjsLib;
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(pdfjsLib);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function loadDocument(arrayBuffer) {
    const pdfjs = await loadPDFJS();
    pdfDocument = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    return {
        numPages: pdfDocument.numPages,
        metadata: await pdfDocument.getMetadata()
    };
}

async function getPageText(pageNumber) {
    if (!pdfDocument) {
        throw new Error('No PDF document loaded');
    }
    
    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
        throw new Error('Invalid page number');
    }
    
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    
    const text = textContent.items.map(item => item.str).join(' ');
    return text;
}

async function extractAllText() {
    if (!pdfDocument) {
        throw new Error('No PDF document loaded');
    }
    
    const allText = [];
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const text = await getPageText(i);
        allText.push(text);
    }
    
    return allText.join('\n\n');
}

async function getPageInfo(pageNumber) {
    if (!pdfDocument) {
        throw new Error('No PDF document loaded');
    }
    
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    
    return {
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation
    };
}

async function getAllPagesInfo() {
    if (!pdfDocument) {
        throw new Error('No PDF document loaded');
    }
    
    const pagesInfo = [];
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const info = await getPageInfo(i);
        pagesInfo.push(info);
    }
    
    return pagesInfo;
}

async function renderPageAsImage(pageNumber, scale = 1.5) {
    if (!pdfDocument) {
        throw new Error('No PDF document loaded');
    }
    
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
        canvasContext: context,
        viewport
    }).promise;
    
    return canvas.toDataURL('image/png');
}

self.onmessage = async function(e) {
    const { action, data } = e.data;
    
    try {
        let result;
        
        switch (action) {
            case 'load':
                const docInfo = await loadDocument(data.arrayBuffer);
                result = docInfo;
                break;
                
            case 'getPageText':
                const pageText = await getPageText(data.pageNumber);
                result = { text: pageText };
                break;
                
            case 'extractAll':
                const allText = await extractAllText();
                result = { text: allText };
                break;
                
            case 'getPageInfo':
                const pageInfo = await getPageInfo(data.pageNumber);
                result = pageInfo;
                break;
                
            case 'getAllPagesInfo':
                const allPagesInfo = await getAllPagesInfo();
                result = allPagesInfo;
                break;
                
            case 'renderPage':
                const imageData = await renderPageAsImage(data.pageNumber, data.scale);
                result = { image: imageData };
                break;
                
            case 'close':
                pdfDocument = null;
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