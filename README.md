# WebAtlas — Intelligent Website Crawler & Site Mapper

WebAtlas is a production-quality website crawling, page discovery, link analysis, and site mapping application built as an internship project. It enables users to input any public URL, recursively discover internal pages, analyze page relationships, track broken links, calculate website health scores, and visualize site architecture as an interactive graph and sitemap.

---

## 🎯 Features

* **Advanced Website Crawling**: Asynchronous page discovery with configurable Max Depth (0–5+), Max Pages (10–1000), Request Delay (0ms–1000ms), Fetch Timeout (5s–30s), and `robots.txt` enforcement.
* **Quick Configuration Presets**: Built-in **Quick**, **Standard**, and **Deep** crawl presets with local settings memory (`localStorage`).
* **Interactive Site Map (React Flow)**: Visual node graph displaying root badges, status colors, response times, edge directionality, toolbar controls (Fit View, Zoom In/Out, Reset), and legend overlays.
* **Website Health Diagnostics**: Calculates a 0–100 Website Health score with issue breakdowns (broken pages, client/server errors, slow responses, redirect ratios).
* **Detailed Page Inspection**: 3-tab drawer (**Overview**, **Links Analysis**, **Technical Info**) with Copy URL, Open Page in new tab, Parent/Child page navigation, internal/external link classification, and broken link indicators.
* **Discovered Pages Directory**: Comprehensive data table with search, status filtering (`2xx`, `3xx`, `4xx`, `5xx`, `Crawl Error`), depth filtering, column sorting, and row auto-scroll selection.
* **Crawl History & Storage**: Automatic SQLite persistence allowing users to review, view, and manage saved crawl records across sessions.
* **Professional Exports**: Client-side data export in **CSV** (UTF-8 BOM), **JSON**, standard **Sitemap.xml**, and printable **HTML Crawl Report**.

---

## 🛠️ Technology Stack

### Backend
* **Python 3.11+**
* **FastAPI** — High-performance asynchronous REST API backend.
* **httpx** — Asynchronous HTTP client for fast, non-blocking page fetches.
* **BeautifulSoup4** — HTML parsing and internal/external link extraction.
* **Pydantic / Pydantic Settings** — Strict data schemas and request validation.
* **SQLAlchemy** — Database ORM for SQLite persistent crawl storage.
* **pytest & pytest-asyncio** — Automated test suite with 32 passing unit/API tests.

### Frontend
* **React 18+** — Component-driven user interface.
* **Vite** — Fast, modern frontend build tool.
* **TypeScript** — Strongly-typed application logic.
* **Tailwind CSS** — Blue-gray light theme styling (`#EAF1F8` canvas, `#F5F8FC` cards, `#2563EB` accents).
* **React Flow** — Interactive node-based site map graph visualizer.
* **Lucide React** — Modern UI icons.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Python 3.11+**
* **Node.js 18+** and **npm**

### 1. Starting the Backend

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (optional)
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Linux/macOS:
source venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Backend API docs available at `http://localhost:8000/docs` and health check at `http://localhost:8000/health`.

### 2. Starting the Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend application will launch at `http://localhost:5173`.

---

## 🛡️ Safety & Domain Boundaries

WebAtlas strictly follows safe crawling policies:
* **Same-Domain Policy**: Strictly restricts crawling to internal pages matching the starting target domain.
* **Robots.txt Enforced**: Checks `robots.txt` disallow directives prior to fetching URLs.
* **Rate Limits**: Configurable delay (default 250ms) between page requests to protect target servers.
* **Content Safety**: Only parses HTML responses; binary assets (images, PDFs, ZIPs, executables) are bypassed safely.

---

## 📜 License
Educational internship project — released under the MIT License.

