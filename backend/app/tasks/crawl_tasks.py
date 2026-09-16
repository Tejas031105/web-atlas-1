"""Celery Background Tasks for Asynchronous WebAtlas Website Crawling."""

import asyncio
import logging
import time
from typing import Any, Dict

from app.tasks.celery_app import celery_app
from app.database.session import SessionLocal
from app.crawler import WebAtlasCrawler, CrawlConfig
from app.services.crawl_persistence import (
    update_crawl_running_status,
    update_crawl_progress,
    update_crawl_status,
    update_crawl_result,
)

logger = logging.getLogger("webatlas.tasks.crawl")


@celery_app.task(name="app.tasks.crawl_tasks.execute_crawl_task", bind=True)
def execute_crawl_task(
    self: Any,
    crawl_id: int,
    starting_url: str,
    max_depth: int = 2,
    max_pages: int = 50,
    request_delay: float = 0.1,
    respect_robots_txt: bool = True,
    timeout: float = 10.0,
    render_mode: str = "auto",
) -> Dict[str, Any]:
    """Asynchronously execute WebAtlas website crawl task in Celery worker process.
    
    Accepts only JSON-serializable primitives (ints, floats, strings, bools).
    Manages its own database session independently from FastAPI thread context.
    """
    logger.info(
        "Starting background crawl task #%s (crawl_id=%d, render_mode=%s) for URL: %s",
        self.request.id,
        crawl_id,
        render_mode,
        starting_url,
    )

    db = SessionLocal()
    last_db_update = 0.0

    def handle_progress(stats: dict) -> None:
        nonlocal last_db_update
        now = time.monotonic()
        # Update Celery state metadata (only if bound to active task ID)
        if getattr(self.request, "id", None):
            try:
                self.update_state(state="PROGRESS", meta=stats)
            except Exception:
                pass

        # Update database progress metrics (throttled to at most once per 0.5s to avoid lock contention)
        if now - last_db_update >= 0.5 or stats.get("pages_crawled", 0) >= max_pages:
            last_db_update = now
            update_crawl_progress(
                db,
                crawl_id=crawl_id,
                pages_discovered=stats.get("pages_discovered", 0),
                pages_crawled=stats.get("pages_crawled", 0),
                pages_failed=stats.get("pages_failed", 0),
                current_depth=stats.get("current_depth", 0),
                max_depth_reached=stats.get("max_depth_reached", 0),
            )

    try:
        # 1. Update crawl status to RUNNING with started_at timestamp
        update_crawl_running_status(db, crawl_id)

        # 2. Instantiate crawler with configuration
        config = CrawlConfig(
            max_pages=max_pages,
            max_depth=max_depth,
            delay=request_delay,
            respect_robots_txt=respect_robots_txt,
            timeout=timeout,
            render_mode=render_mode,
        )
        crawler = WebAtlasCrawler(config)

        # 3. Execute crawl with progress callback
        crawl_result = asyncio.run(crawler.crawl(starting_url, on_progress=handle_progress))

        # 4. Persist completed crawl results
        updated_record = update_crawl_result(db, crawl_id, crawl_result)

        final_status = updated_record.status if updated_record else "COMPLETED"
        logger.info("Finished background crawl task #%s (status: %s)", self.request.id, final_status)
        return {
            "crawl_id": crawl_id,
            "status": final_status,
            "total_pages": crawl_result.total_pages,
        }

    except Exception as err:
        logger.exception(
            "Unexpected error in Celery crawl task #%s for crawl #%d: %s",
            self.request.id,
            crawl_id,
            err,
        )
        try:
            db.rollback()
        except Exception:
            pass
        update_crawl_status(db, crawl_id, "FAILED", error_message=str(err))
        return {
            "crawl_id": crawl_id,
            "status": "FAILED",
            "error": str(err),
        }
    finally:
        db.close()
