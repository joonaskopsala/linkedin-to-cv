# LinkedIn to CV Builder

A Chrome Manifest V3 extension that extracts profile data from the currently open LinkedIn profile tab and exports a polished CV as PDF.

## What this extension does

- Validates that the active tab is a LinkedIn profile URL in this format: `https://www.linkedin.com/in/username/`
- Extracts profile sections from the page (name, headline, about, experience, education, skills, contact)
- Generates a styled CV using one of three layouts:
  - Harvard Style
  - Modern Editorial
  - Executive Minimal
- Exports directly to PDF by default

## Local setup (step by step)

### 1. Get the project locally

If you already have this folder on your machine, skip this step.

```bash
git clone <your-repo-url>
cd linkedin_to_cv
```

### 2. Open Chrome extensions page

Open this URL in Chrome:

`chrome://extensions`

### 3. Enable Developer Mode

Turn on the **Developer mode** toggle in the top-right corner.

### 4. Load the extension

1. Click **Load unpacked**
2. Select this project root folder (the folder containing `manifest.json`)

Example path on Windows:

`C:/Projects/linkedin_to_cv`

### 5. Pin the extension (recommended)

1. Click the puzzle icon in Chrome toolbar
2. Pin **LinkedIn to CV Builder** for quick access

## How to use

1. Open a LinkedIn profile page, for example: `https://www.linkedin.com/in/username/`
2. Click the extension icon
3. Choose a CV style from the dropdown
4. Click **Export PDF from Current Profile Tab**
5. Wait for extraction and PDF generation to finish

## How to update after code changes

When you edit extension files locally:

1. Go to `chrome://extensions`
2. Find **LinkedIn to CV Builder**
3. Click the **Reload** button on the extension card
4. Re-run export from a LinkedIn profile tab

## Quick validation commands (optional)

Use these to catch JavaScript syntax issues before reloading in Chrome:

```bash
node --check popup/popup.js
node --check extractor/linkedinExtractor.js
node --check renderer/cvTemplates.js
```

## Project structure

- `manifest.json`: Extension metadata, permissions, popup entry
- `popup/`: Popup UI and export flow controller
- `extractor/`: LinkedIn DOM extraction logic
- `renderer/`: CV HTML template and styles
- `vendor/`: Bundled `html2canvas` and `jsPDF` libraries

## Notes

- The extension runs client-side on the active tab.
- No backend service is required.
- LinkedIn DOM structure changes over time; selectors may need maintenance.

## Troubleshooting

- **Button does nothing**
  - Ensure the active tab is a LinkedIn profile URL under `/in/`
- **Old behavior after edits**
  - Reload the extension in `chrome://extensions`
- **Data missing in CV**
  - LinkedIn profile sections vary by account and locale; some fields may not be present in the DOM
