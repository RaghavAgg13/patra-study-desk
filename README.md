# Patra (पत्र) — Study Desk & Doubt Workbench

**Patra (पत्र)** is a local-first academic study workbench and assignment reader that transforms scanned lecture notes, multi-column research PDFs, and handwritten problem sets into an interactive, layout-faithful editable canvas with an integrated AI Doubt Studio.

Built end-to-end with **Sarvam Document Intelligence (`Sarvam Vision 1.5`)** for high-fidelity document conversion and **Sarvam-105B** for grounded, context-aware doubt resolution.

---

## ✨ Key Features

- **Layout-Faithful Document Digitisation**:
  - Converts PDFs, scanned notes, and images into semantic HTML or Markdown while preserving multi-column grids, centered derivations, tables, and extracted cropped figures.
  - **Auto-Batching Pipeline**: Automatically splits PDFs larger than 10 pages into batches, digitises them concurrently, and stitches the pages and embedded diagram assets seamlessly.
- **In-Place WYSIWYG & Live LaTeX Equation Editing**:
  - Click any paragraph, heading, or table cell to edit your notes directly in place.
  - Click any mathematical equation to open a floating **LaTeX Formula Editor** with live KaTeX preview, instant updates, and full **Undo / Redo (`Ctrl+Z` / `Ctrl+Y`)** history.
- **Adobe Acrobat-Style Page Scrubber & Split PDF View**:
  - Jump or scrub smoothly across pages with the interactive page slider, or open **Split View** to inspect the original PDF side-by-side via a zero-download `PDF.js` canvas renderer (with Dark Mode diagram adaptation).
- **Projects, Course Folders & Assignment Tracker**:
  - Organize documents into color-coded course projects, filter by category (*Assignment*, *Lecture Notes*, *Paper*, *Exam Prep*), and track assignment progress (*To Do*, *In Progress*, *Completed*).
- **Grounded Multi-Thread AI Doubt Studio**:
  - **Highlight-to-Ask**: Select any passage or derivation in the reader to quote it directly into your doubt prompt (*Ask Doubt*, *Verify Step*, or *Explain*).
  - **Multiple Doubt Threads**: Create, rename, switch, or delete doubt threads per document (with one-click **Undo** toast notifications) and search across all past conversations in the global archive.
  - **Append to Notes**: One-click append any AI derivation or explanation directly into your document notes.

---

## 🛠️ Tech Stack

- **Backend**: Python, FastAPI, Uvicorn, HTTPX, PyMuPDF (`fitz`)
- **Document Intelligence**: Sarvam Vision 1.5 (`/doc-ai/v1/job/digitise`) supporting 22 scheduled Indian languages + English (`en-IN`)
- **Reasoning LLM**: `Sarvam-105B` & `Sarvam-105B Conv` (`/v1/chat/completions` with Server-Sent Events & configurable reasoning effort)
- **Frontend**: Vanilla ES6 JavaScript, CSS Grid/Custom Properties (Warm Archival Paper & Deep Obsidian Dark themes), KaTeX, Marked.js, PDF.js

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/RaghavAgg13/patra-study-desk.git
cd patra-study-desk
```

### 2. Install Dependencies
```bash
python -m venv .venv
# Windows (PowerShell)
.\.venv\Scripts\pip install -r requirements.txt
# macOS / Linux
source .venv/bin/activate && pip install -r requirements.txt
```

### 3. Configure Your API Key
Copy `.env.example` to `.env` and add your API subscription key from [dashboard.sarvam.ai](https://dashboard.sarvam.ai/):
```env
SARVAM_API_KEY=your_api_subscription_key_here
PORT=8000
```
*(Alternatively, launch the app and click **Set API Key** in the top navigation bar to save your key directly from the UI.)*

### 4. Run the Application
```bash
# Windows
.\start.bat
# Or run directly with Python:
.\.venv\Scripts\python.exe app.py
```
Open **`http://localhost:8000`** in your browser.

---

## 📂 Project Structure

```text
patra-study-desk/
├── app.py                 # FastAPI backend, PDF auto-batching, local storage & SSE streaming
├── requirements.txt       # Python dependencies (FastAPI, Uvicorn, HTTPX, PyMuPDF, python-dotenv)
├── start.bat              # One-click Windows launcher
├── .env.example           # Example environment configuration
└── static/
    ├── index.html         # 3-pane collapsible study workbench UI
    ├── styles.css         # Editorial typography, A4 sheet geometry & dark/light theming
    └── app.js             # Reader controller, in-place editor, KaTeX popover & multi-thread chat
```
