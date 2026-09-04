# WebAtlas — Intelligent Website Crawler & Site Mapper

WebAtlas is a production-grade website crawling, page discovery, link analysis, and site mapping application built as an engineering internship project. It enables users to input any public URL, recursively discover internal pages, analyze page relationships, track broken links, calculate website health scores, and visualize site architecture as an interactive node graph and sitemap.

---

## 🎯 Overview & Architecture

WebAtlas uses a decoupled, background-job processing architecture powered by **FastAPI**, **Celery**, **Redis**, **HTTPX**, **Playwright Chromium**, **BeautifulSoup**, and **React Flow**.

```text
User / Browser
      ↓
React Frontend (Vite + TypeScript + Tailwind CSS + React Flow)
      ↓
FastAPI Backend (POST /api/v1/crawl -> Returns QUEUED status & task_id immediately)
      ↓
Celery Task Producer
      ↓
Redis Message Broker (redis://localhost:6379/0 & result backend /1)
      ↓
Celery Worker Process (execute_crawl_task)
      ↓
WebAtlas Crawler Engine (BFS Traversal)
      ↓
 ┌────┴───────────────────────────┐
 ↓                                ↓
HTTPX Async Fetcher        Playwright Chromium Browser
(Fast static HTML)         (JS SPA Shell rendering)
 ↓                                ↓
 └────┬───────────────────────────┘
      ↓
BeautifulSoup HTML Link Parser
      ↓
SQLite Persistent Database (crawls & pages tables)
      ↓
React UI Polling (GET /api/v1/crawl/{id}/status -> Visual SiteMap, Diagnostics & Results Table)
```

### Core Architecture Components

- **React Frontend**: Modern UI constructed with React 18, TypeScript, Tailwind CSS, and React Flow. Features interactive node graphs, live progress counters, health diagnostics, filtering, and multi-format exports.
- **FastAPI Server**: High-performance asynchronous REST API handling crawl creation, status polling, history retrieval, and health diagnostics.
- **Celery Task Engine**: Distributed background task worker executing web crawl tasks asynchronously without blocking HTTP requests.
- **Redis In-Memory Broker**: Acts as Celery message broker (`redis://localhost:6379/0`) and result storage backend (`redis://localhost:6379/1`).
- **HTTPX Fetcher**: Fast, lightweight, non-blocking HTTP client used as default fetcher for traditional static HTML pages.
- **Playwright Chromium Browser**: Real headless browser executing client-side JavaScript for dynamic single-page applications (SPAs) and JavaScript-generated links.
- **BeautifulSoup4 Parser**: Parses raw and rendered HTML DOMs to extract page titles, HTTP metadata, and internal/external hyperlinks.
- **SQLite Database**: Persistent ORM storage for historical crawl sessions and discovered pages with automatic schema migrations.

---

## 🌐 JavaScript Rendering & Crawl Modes

WebAtlas supports hybrid rendering strategies:

| Crawl Mode | Mechanism | Description | Best Used For |
| :--- | :--- | :--- | :--- |
| **`auto`** *(Default)* | HTTPX + Playwright Fallback | Fetches via HTTPX first. Automatically detects JS app shell signatures (e.g. empty `<div id="root"></div>`) and falls back to Playwright Chromium rendering when needed. | **Recommended for all websites** (Fastest performance with dynamic fallback). |
| **`httpx`** | HTTPX Only | Fetches raw HTML responses directly from the server. Playwright browser is never launched. | Traditional static HTML websites, blogs, documentation sites. |
| **`playwright`** | Playwright Chromium | Opens target URL in real Chromium browser, waits for JavaScript DOM execution, and captures rendered HTML. | Heavily dynamic client-side JavaScript applications (React, Vue, Angular SPAs). |

### Policy Enforcement Across All Renderers

Regardless of renderer selection, WebAtlas strictly enforces:
- **`robots.txt` Compliance**: Evaluated *before* initiating any HTTPX or Playwright request. Disallowed URLs are blocked prior to browser execution.
- **Same-Domain Restriction**: Extracted internal links are filtered so external target domains are never enqueued.
- **Max Depth & Max Pages**: Crawl traversal strictly respects `max_depth` and `max_pages` limits.
- **Request Delay**: Configurable request delay is respected between page fetches.

---

## ⚡ Background Job Progress & Lifecycle States

When a user initiates a crawl, the job moves through four lifecycle states:

```text
QUEUED ──> RUNNING ──> COMPLETED
                          │
                          └──> FAILED
```

- **`QUEUED`**: Initial state returned immediately by `POST /api/v1/crawl`. The crawl job is waiting in Redis for an available Celery worker.
- **`RUNNING`**: Worker process is actively fetching, rendering, parsing, and discovering pages.
- **`COMPLETED`**: Crawling finished successfully and all page records were committed to the database.
- **`FAILED`**: Crawling encountered an unrecoverable exception or error condition.

### Progress Metrics

- **`pages_discovered`**: Total count of unique internal page URLs discovered during crawl traversal.
- **`pages_crawled`**: Count of pages processed so far.
- **`pages_failed`**: Count of pages that returned fetch or HTTP status errors.
- **`current_depth`**: Current BFS traversal recursion depth (`0` to `max_depth`).
- **`progress_percent`**: Estimated completion percentage (`(pages_crawled / max_pages) * 100`).

---

## 🛠️ Crawl Configuration Options

| Option | Parameter | Default | Range / Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Target URL** | `url` | *Required* | `http://` or `https://` | Public starting website URL |
| **Max Depth** | `max_depth` | `2` | `0` to `10` | Maximum link recursion depth (`0` = root page only) |
| **Max Pages** | `max_pages` | `50` | `1` to `2000` | Maximum total internal pages to crawl |
| **Request Delay** | `request_delay` | `0.25` | `0.0s` to `5.0s` | Delay between consecutive page fetches |
| **Robots.txt** | `respect_robots_txt`| `true` | `true` / `false` | Respect robots.txt disallow rules |
| **Timeout** | `timeout` | `10.0` | `1.0s` to `60.0s` | HTTP request / browser navigation timeout per page |
| **Render Mode** | `render_mode` | `"auto"` | `"auto"`, `"httpx"`, `"playwright"` | Page fetching and rendering strategy |

---

## 🚀 Quick Start Guide

### Prerequisites
* **Python 3.11+**
* **Node.js 18+** and **npm**
* **Redis** (running locally on port 6379 or via Docker)

---

### 1. Backend Setup & Run

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (optional)
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Linux / macOS:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright Chromium browser binaries
playwright install chromium
```

To run the background crawling system locally, open 3 terminal windows:

* **Terminal 1: Start Redis Broker**
  ```bash
  docker compose up redis
  # Or: redis-server
  ```

* **Terminal 2: Start Celery Worker**
  ```bash
  cd backend
  # Windows PowerShell / CMD:
  celery -A app.tasks.celery_app worker --loglevel=info -P solo

  # Linux / macOS:
  celery -A app.tasks.celery_app worker --loglevel=info
  ```

* **Terminal 3: Start FastAPI Server**
  ```bash
  cd backend
  uvicorn app.main:app --reload --port 8000
  ```

Backend API documentation is available at `http://localhost:8000/docs` and health endpoint at `http://localhost:8000/health`.

---

### 2. Frontend Setup & Run

```bash
# Open terminal and navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Frontend application will launch at `http://localhost:5173`.

---

## 🐳 Docker Deployment

You can run Redis, FastAPI backend, and Vite frontend using Docker Compose:

```bash
# Start all services
docker compose up --build

# Or start only Redis broker
docker compose up redis
```

---

## 🧪 Testing & Verification

### Running Backend Pytest Suite
```bash
cd backend
pytest
```
*Executes all 56 unit, integration, API, task, and Playwright crawler tests.*

### Running Frontend Production Build
```bash
cd frontend
npm run build
```
*Validates TypeScript compilation and bundles production asset packages.*

---

## 🛡️ Safety & Security Guidelines

WebAtlas strictly enforces:
- **Same-Domain Policy**: Restricts crawling to internal pages belonging to the starting target domain.
- **Robots.txt Enforced**: Checks `robots.txt` disallow policies prior to fetching URLs.
- **Rate Limits**: Configurable delay between page requests to protect target servers.
- **Content Safety**: Parses HTML responses only; binary assets (images, PDFs, ZIPs, executables) are safely bypassed.
- **Public Scope**: Designed for publicly accessible websites only. No CAPTCHA bypass, anti-bot circumvention, or authenticated scraping functionality is included.

---

## 📜 License

Educational engineering internship project — released under the MIT License.
