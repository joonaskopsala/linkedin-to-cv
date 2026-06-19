# LinkedIn to CV Builder

A Chrome (Manifest V3) extension that converts your LinkedIn PDF export into a polished, downloadable CV — in three click.

## How it works

1. **Export your LinkedIn profile as a PDF**  
   On LinkedIn: click _Me → View Profile → More → Save to PDF_

2. **Open the extension popup** and drag-and-drop (or click to select) the downloaded PDF.

3. **Choose a CV style** (Harvard, Editorial, or Executive), optionally review and edit your skills, then click **Export CV as PDF**.

The extension parses the PDF locally in your browser — no data leaves your machine.

**Profile photo (optional):** If you are logged into LinkedIn, the extension can open a background tab to fetch your profile photo. If you are not logged in, or if the photo cannot be retrieved, the CV is still generated without it.

---

## Features

- **Three CV styles** — Harvard (traditional), Editorial (modern), Executive (executive summary)
- **Skills editor** — review, remove, or add skills before exporting
- **Profile photo** — automatically fetched from LinkedIn if you are logged in
- **Fully local** — PDF parsing runs in-browser via [PDF.js](https://mozilla.github.io/pdf.js/); nothing is sent to a server

---

## Installation (unpacked extension)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the repository folder.
5. The extension icon will appear in your toolbar.

> The extension requires **Chrome 116+** (Manifest V3 with ES module support).

---

## Project structure

```
manifest.json           Extension manifest (MV3)
popup/
  popup.html            Extension popup UI
  popup.css             Popup styles
  popup.js              Popup logic: PDF upload, parsing, export
extractor/
  pdfParser.js          LinkedIn PDF → structured profile object (uses PDF.js)
  photoExtractor.js     Content script injected into LinkedIn to fetch profile photo
renderer/
  cvTemplates.js        HTML CV templates for each style
vendor/
  pdf.min.mjs           PDF.js library (ES module build)
  pdf.worker.min.mjs    PDF.js worker
  html2canvas.min.js    html2canvas for PDF rendering
  jspdf.umd.min.js      jsPDF for PDF generation
```

---

## Privacy

All processing is done locally in your browser. The only external request is the optional tab opened to your own LinkedIn profile page to retrieve your profile photo.
