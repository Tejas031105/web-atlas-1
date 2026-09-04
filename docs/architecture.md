# WebAtlas Architecture & Design Overview

## Complete System Architecture

WebAtlas is built using a production-ready, decoupled background processing architecture:

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
SQLite Persistent Database (crawls & pages tables with auto-migration)
      ↓
React UI Polling (GET /api/v1/crawl/{id}/status -> Visual SiteMap, Diagnostics & Results Table)
```

---

## Backend Modules

- **`app/api`**: FastAPI router endpoints (`/health`, `/api/v1/crawl`, `/api/v1/crawl/{id}/status`, `/api/v1/crawls`, `/api/v1/diagnostics`).
- **`app/core`**: Configuration settings (`settings`), logging setup, and environment variables.
- **`app/crawler`**:
  - `engine.py`: Breadth-First Search (BFS) crawler algorithm enforcing depth limits, max pages, delay, and `robots.txt`.
  - `fetcher.py`: Asynchronous HTTPX client wrapper for static HTML page fetching.
  - `browser.py`: Playwright Chromium headless browser rendering service.
  - `strategy.py`: Dynamic content detector (`is_js_shell`) and render strategy selector (`auto`, `httpx`, `playwright`).
  - `parser.py`: BeautifulSoup HTML title and internal/external link parser.
  - `robots.py`: Asynchronous `robots.txt` compliance validator.
  - `url_utils.py`: URL normalization, scheme validation, and domain extraction helpers.
- **`app/models`**: SQLAlchemy ORM models (`CrawlModel`, `PageModel`).
- **`app/schemas`**: Pydantic validation schemas (`CrawlRequest`, `CrawlResponse`, `CrawlStatusResponse`).
- **`app/services`**: Database persistence services (`create_initial_crawl`, `update_crawl_progress`, `update_crawl_result`) and diagnostic calculators.
- **`app/tasks`**: Celery worker application configuration (`celery_app.py`) and background task definitions (`crawl_tasks.py`).
- **`app/database`**: SQLite engine initialization, scoped session factory, and auto-migration helpers (`_auto_migrate_schema`).

---

## Frontend Modules

- **`src/components`**: Modular UI components (`UrlInput`, `CrawlProgressCard`, `SiteMap`, `StatsOverview`, `DiagnosticsOverview`, `PageDetailsPanel`, `CrawlResultsTable`, `CrawlHistoryTable`, `ExportCard`).
- **`src/hooks`**: Custom React hooks (`useCrawlStatus` for periodic non-blocking background status polling).
- **`src/pages`**: Main application dashboard container (`Dashboard.tsx`).
- **`src/services`**: API client modules (`crawlService.ts`, `historyService.ts`, `diagnosticsService.ts`, `exportService.ts`).
- **`src/types`**: TypeScript type definitions mirroring backend Pydantic schemas.

---

## Performance & Scalability Notes

- **Hybrid Fetching**: HTTPX is used by default for high speed and minimal resource usage. Playwright Chromium is launched conditionally only when dynamic JavaScript single-page application (SPA) shells are detected or explicitly requested.
- **Worker Concurrency & Database**: In development and light production deployments, SQLite with `check_same_thread=False` and worker-isolated database sessions is used. For large-scale distributed deployments with multiple concurrent Celery worker nodes, replacing SQLite with PostgreSQL is recommended.
