# WebAtlas Architecture & Design Overview

## Overview
WebAtlas is designed using a decoupled, modular architecture separated cleanly into a Python/FastAPI backend and a React/TypeScript frontend.

```
WebAtlas Architecture
┌─────────────────────────┐         HTTP/REST         ┌─────────────────────────┐
│     React Frontend      │ <───────────────────────> │     FastAPI Backend     │
│   (Vite, TS, ReactFlow) │                           │   (App, Crawler, Core)  │
└─────────────────────────┘                           └────────────┬────────────┘
                                                                   │
                                                                   ▼
                                                      ┌─────────────────────────┐
                                                      │   SQLite DB (ORM)       │
                                                      └─────────────────────────┘
```

## Backend Modules

- **`app/api`**: FastAPI routers and HTTP endpoint controllers (e.g. `/health`, `/crawls`).
- **`app/core`**: Application configuration, logging settings, and global constants.
- **`app/models`**: SQLAlchemy database models for persistent crawl results and page relationships.
- **`app/schemas`**: Pydantic models for request/response validation and data serialization.
- **`app/services`**: Business logic orchestration connecting database operations with graph generation.
- **`app/crawler`**: Asynchronous web crawling engine, link extractor, and `robots.txt` compliance parser.
- **`app/database`**: Engine initialization and session creation wrappers.

## Frontend Modules

- **`src/components`**: Modular UI components (Header, UrlInput, Stats cards, Graph visualizers).
- **`src/pages`**: View-level containers (Dashboard, Sitemap detail page).
- **`src/services`**: API client modules for fetching backend status and managing crawl sessions.
- **`src/types`**: TypeScript type definitions mirroring API response contracts.
