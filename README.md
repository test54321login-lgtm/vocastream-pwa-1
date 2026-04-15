# VocaStream - Premium Text-to-Speech PWA

A modern Progressive Web Application for converting text to speech using dual speech engines.

## Features

- **Dual Speech Engines**
  - Web Speech API (Browser Voices) - Fast, local processing
  - Sarvam AI - Natural, high-quality voices with multiple language support

- **File Processing**
  - PDF parsing (client-side using PDF.js)
  - Word document parsing (client-side using Mammoth.js)
  - Image OCR (client-side using Tesseract.js)

- **URL Content Import**
  - Fetch content directly from URLs

- **PWA Features**
  - Offline support with Service Worker
  - Installable on mobile devices
  - Dark/Light theme support

- **User Features**
  - Login/Signup modals
  - Document library
  - Speech history
  - Customizable settings (voice, speed, pitch, language)

## Tech Stack

- Pure HTML, CSS, Vanilla JavaScript
- No build required (static PWA)
- Client-side processing (no server needed)

## Getting Started

### Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3001 in your browser.

### Production

Deploy to Vercel:

```bash
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments.

## File Structure

```
vocastream-pwa/
├── public/              # Public assets
│   ├── manifest.json    # PWA manifest
│   ├── sw.js           # Service worker
│   └── robots.txt
├── src/
│   ├── index.html       # Main HTML file
│   ├── styles/          # CSS files
│   ├── scripts/         # JavaScript files
│   ├── public/          # Additional public assets
│   └── assets/          # Images and media
├── vercel.json          # Vercel configuration
├── package.json
└── .gitignore
```

## API Keys

For Sarvam AI TTS functionality:
1. Go to Settings
2. Enter your Sarvam API key
3. Click Save API Key

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT License