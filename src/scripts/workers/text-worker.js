// Text Worker for SpeechFlow PWA
// Web Worker for non-blocking text normalization

const TextProcessor = {
    normalize(text) {
        let normalized = text;
        
        normalized = this.fixUnicodeChars(normalized);
        normalized = this.fixCommonTypos(normalized);
        normalized = this.fixPunctuation(normalized);
        normalized = this.removeExtraSpaces(normalized);
        normalized = this.fixLineBreaks(normalized);
        
        return normalized;
    },

    fixUnicodeChars(text) {
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
    },

    fixCommonTypos(text) {
        const commonTypos = {
            'teh': 'the',
            'th e': 'the',
            'dont': "don't",
            'cant': "can't",
            'wont': "won't",
            'isnt': "isn't",
            'arent': "aren't",
            'wasnt': "wasn't",
            'werent': "weren't",
            'hasnt': "hasn't",
            'havent': "haven't",
            'hadnt': "hadn't",
            'doesnt': "doesn't",
            'didnt': "didn't",
            'wont': "won't",
            'wouldnt': "wouldn't",
            'couldnt': "couldn't",
            'shouldnt': "shouldn't",
            'u': 'you',
            'r': 'are',
            'ur': 'your',
            'b4': 'before',
            'bc': 'because',
            'thx': 'thanks',
            'plz': 'please',
            'pls': 'please',
            'info': 'information',
            'msg': 'message',
            'txt': 'text'
        };
        
        let result = text.toLowerCase();
        for (const [typo, correction] of Object.entries(commonTypos)) {
            const regex = new RegExp(`\\b${typo}\\b`, 'gi');
            result = result.replace(regex, correction);
        }
        
        return result;
    },

    fixPunctuation(text) {
        let result = text;
        
        result = result.replace(/\s+([.,!?;:])/g, '$1');
        
        result = result.replace(/([.,!?;:])\s*(?=[.,!?;:])/g, '$1');
        
        result = result.replace(/(\w)\1{2,}/g, '$1$1');
        
        result = result.replace(/(!{2,})/g, '!');
        result = result.replace(/(\?{2,})/g, '?');
        
        result = result.replace(/\.\.\./g, '...');
        
        result = result.replace(/^([A-Z])/, (match) => match);
        
        return result;
    },

    removeExtraSpaces(text) {
        let result = text;
        
        result = result.replace(/[ \t]+/g, ' ');
        
        result = result.replace(/^\s+/gm, '');
        
        result = result.replace(/\s+$/gm, '');
        
        result = result.replace(/\n{3,}/g, '\n\n');
        
        return result;
    },

    fixLineBreaks(text) {
        let result = text;
        
        result = result.replace(/\r\n/g, '\n');
        result = result.replace(/\r/g, '\n');
        
        return result;
    },

    countWords(text) {
        const words = text.trim().split(/\s+/);
        return words[0] === '' ? 0 : words.length;
    },

    countCharacters(text, includeSpaces = true) {
        if (includeSpaces) {
            return text.length;
        }
        return text.replace(/\s/g, '').length;
    },

    estimateReadingTime(wordCount, wordsPerMinute = 150) {
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        return minutes;
    },

    extractSentences(text) {
        const sentenceRegex = /[^.!?]+[.!?]+/g;
        return text.match(sentenceRegex) || [];
    },

    getStatistics(text) {
        return {
            characters: this.countCharacters(text),
            charactersNoSpaces: this.countCharacters(text, false),
            words: this.countWords(text),
            sentences: this.extractSentences(text).length,
            paragraphs: text.split(/\n\s*\n/).filter(p => p.trim()).length,
            readingTime: this.estimateReadingTime(this.countWords(text))
        };
    }
};

self.onmessage = function(e) {
    const { action, data } = e.data;
    
    let result;
    switch (action) {
        case 'normalize':
            result = TextProcessor.normalize(data.text);
            break;
        case 'countWords':
            result = TextProcessor.countWords(data.text);
            break;
        case 'countCharacters':
            result = TextProcessor.countCharacters(data.text, data.includeSpaces);
            break;
        case 'getStatistics':
            result = TextProcessor.getStatistics(data.text);
            break;
        case 'extractSentences':
            result = TextProcessor.extractSentences(data.text);
            break;
        default:
            result = null;
    }
    
    self.postMessage({ action, result });
};