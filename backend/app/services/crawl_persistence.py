"""Database Persistence Repository Service for Crawls and Discovered Pages."""

import json
import logging
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from app.crawler.models import CrawlResult, CrawlConfig
from app.models.crawl import CrawlModel, PageModel

logger = logging.getLogger(__name__)


from datetime import datetime, timezone

def create_initial_crawl(
    db: Session,
    starting_url: str,
    normalized_starting_url: str,
    domain: str,
    max_depth: int = 2,
    max_pages: int = 50,
    task_id: Optional[str] = None,
    render_mode: str = "auto",
) -> CrawlModel:
    """Transactionally create an initial crawl session record with QUEUED status."""
    try:
        crawl_record = CrawlModel(
            starting_url=starting_url,
            normalized_starting_url=normalized_starting_url,
            domain=domain,
            max_depth_requested=max_depth,
            max_pages_requested=max_pages,
            status="QUEUED",
            task_id=task_id,
            render_mode=render_mode,
        )
        db.add(crawl_record)
        db.commit()
        db.refresh(crawl_record)
        logger.info("Created initial crawl record #%d for domain '%s' (status: QUEUED, render_mode: %s)", crawl_record.id, domain, render_mode)
        return crawl_record
    except Exception as err:
        db.rollback()
        logger.error("Failed to create initial crawl record: %s", err)
        raise err


def update_crawl_task_id(db: Session, crawl_id: int, task_id: str) -> None:
    """Associate Celery task ID with an existing crawl record."""
    try:
        crawl_record = db.query(CrawlModel).filter(CrawlModel.id == crawl_id).first()
        if crawl_record:
            crawl_record.task_id = task_id
            db.commit()
    except Exception as err:
        db.rollback()
        logger.error("Failed to update task_id for crawl #%d: %s", crawl_id, err)


def update_crawl_running_status(db: Session, crawl_id: int) -> Optional[CrawlModel]:
    """Transition crawl status to RUNNING and record started_at timestamp."""
    try:
        crawl_record = db.query(CrawlModel).filter(CrawlModel.id == crawl_id).first()
        if not crawl_record:
            return None

        crawl_record.status = "RUNNING"
        if not crawl_record.started_at:
            crawl_record.started_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(crawl_record)
        logger.info("Updated crawl #%d status to RUNNING", crawl_id)
        return crawl_record
    except Exception as err:
        db.rollback()
        logger.error("Failed to set RUNNING status for crawl #%d: %s", crawl_id, err)
        raise err


def update_crawl_progress(
    db: Session,
    crawl_id: int,
    pages_discovered: int,
    pages_crawled: int,
    pages_failed: int,
    current_depth: int,
    max_depth_reached: int,
) -> None:
    """Update live progress metrics during crawl execution."""
    try:
        crawl_record = db.query(CrawlModel).filter(CrawlModel.id == crawl_id).first()
        if not crawl_record:
            return

        crawl_record.pages_discovered = pages_discovered
        crawl_record.total_pages = pages_crawled
        crawl_record.failed_pages = pages_failed
        crawl_record.successful_pages = max(0, pages_crawled - pages_failed)
        crawl_record.current_depth = current_depth
        crawl_record.max_depth_reached = max_depth_reached

        db.commit()
    except Exception as err:
        db.rollback()
        logger.warning("Failed to update live progress for crawl #%d: %s", crawl_id, err)


def update_crawl_status(
    db: Session, crawl_id: int, status: str, error_message: Optional[str] = None
) -> Optional[CrawlModel]:
    """Update execution status, completed_at timestamp, and optional error message of a crawl record."""
    try:
        crawl_record = db.query(CrawlModel).filter(CrawlModel.id == crawl_id).first()
        if not crawl_record:
            logger.warning("Attempted to update status for non-existent crawl #%d", crawl_id)
            return None

        crawl_record.status = status
        if status in ("COMPLETED", "FAILED") and not crawl_record.completed_at:
            crawl_record.completed_at = datetime.now(timezone.utc)
            if crawl_record.started_at:
                s_at = crawl_record.started_at.replace(tzinfo=timezone.utc) if crawl_record.started_at.tzinfo is None else crawl_record.started_at
                c_at = crawl_record.completed_at.replace(tzinfo=timezone.utc) if crawl_record.completed_at.tzinfo is None else crawl_record.completed_at
                elapsed = (c_at - s_at).total_seconds()
                crawl_record.duration_seconds = round(elapsed, 2)

        if error_message:
            errors = json.loads(crawl_record.errors_json) if crawl_record.errors_json else []
            if error_message not in errors:
                errors.append(error_message)
            crawl_record.errors_json = json.dumps(errors)

        db.commit()
        db.refresh(crawl_record)
        logger.info("Updated crawl #%d status to '%s'", crawl_id, status)
        return crawl_record
    except Exception as err:
        db.rollback()
        logger.error("Failed to update status for crawl #%d: %s", crawl_id, err)
        raise err


def update_crawl_result(
    db: Session, crawl_id: int, crawl_result: CrawlResult
) -> Optional[CrawlModel]:
    """Update existing crawl record with completed crawl statistics and discovered pages."""
    try:
        crawl_record = db.query(CrawlModel).filter(CrawlModel.id == crawl_id).first()
        if not crawl_record:
            logger.error("Cannot update crawl result: Crawl #%d not found", crawl_id)
            return None

        crawl_record.total_pages = crawl_result.total_pages
        crawl_record.pages_discovered = max(crawl_record.pages_discovered, crawl_result.total_pages)
        crawl_record.successful_pages = crawl_result.successful_pages
        crawl_record.failed_pages = crawl_result.failed_pages
        crawl_record.total_internal_links = crawl_result.total_internal_links
        crawl_record.total_external_links = crawl_result.total_external_links
        crawl_record.max_depth_reached = crawl_result.max_depth_reached
        crawl_record.duration_seconds = crawl_result.duration_seconds
        crawl_record.status = "COMPLETED" if crawl_result.total_pages > 0 else "FAILED"
        crawl_record.completed_at = datetime.now(timezone.utc)
        crawl_record.errors_json = json.dumps(crawl_result.errors) if crawl_result.errors else None

        # Add page records for all discovered pages
        for page in crawl_result.pages:
            page_record = PageModel(
                crawl_id=crawl_record.id,
                url=page.url,
                normalized_url=page.normalized_url,
                parent_url=page.parent_url,
                depth=page.depth,
                title=page.title,
                status_code=page.status_code,
                content_type=page.content_type,
                crawl_success=page.crawl_success,
                error_message=page.error_message,
                response_time=page.response_time,
                internal_links_json=json.dumps(page.internal_links) if page.internal_links else None,
                external_links_json=json.dumps(page.external_links) if page.external_links else None,
                discovered_at=page.discovered_at,
            )
            db.add(page_record)

        db.commit()
        db.refresh(crawl_record)
        logger.info(
            "Successfully updated crawl #%d with %d pages (status: %s)",
            crawl_record.id,
            crawl_record.total_pages,
            crawl_record.status,
        )
        return crawl_record
    except Exception as err:
        db.rollback()
        logger.error("Failed to update crawl result for #%d: %s", crawl_id, err)
        raise err


def save_crawl_result(
    db: Session, crawl_result: CrawlResult, request_config: CrawlConfig
) -> CrawlModel:
    """Transactionally save a completed crawl result and its pages to SQLite."""
    try:
        crawl_record = CrawlModel(
            starting_url=crawl_result.starting_url,
            normalized_starting_url=crawl_result.normalized_starting_url,
            domain=crawl_result.domain,
            total_pages=crawl_result.total_pages,
            successful_pages=crawl_result.successful_pages,
            failed_pages=crawl_result.failed_pages,
            total_internal_links=crawl_result.total_internal_links,
            total_external_links=crawl_result.total_external_links,
            max_depth_requested=request_config.max_depth,
            max_depth_reached=crawl_result.max_depth_reached,
            duration_seconds=crawl_result.duration_seconds,
            status="COMPLETED",
            errors_json=json.dumps(crawl_result.errors) if crawl_result.errors else None,
        )

        db.add(crawl_record)
        db.flush()  # Generate primary key ID for crawl_record

        # Create page records for all discovered pages
        for page in crawl_result.pages:
            page_record = PageModel(
                crawl_id=crawl_record.id,
                url=page.url,
                normalized_url=page.normalized_url,
                parent_url=page.parent_url,
                depth=page.depth,
                title=page.title,
                status_code=page.status_code,
                content_type=page.content_type,
                crawl_success=page.crawl_success,
                error_message=page.error_message,
                response_time=page.response_time,
                internal_links_json=json.dumps(page.internal_links) if page.internal_links else None,
                external_links_json=json.dumps(page.external_links) if page.external_links else None,
                discovered_at=page.discovered_at,
            )
            db.add(page_record)

        db.commit()
        db.refresh(crawl_record)
        logger.info("Successfully persisted crawl #%d for %s (%d pages)", crawl_record.id, crawl_record.domain, crawl_record.total_pages)
        return crawl_record

    except Exception as err:
        db.rollback()
        logger.error("Failed to persist crawl result to database: %s", err)
        raise err


def get_crawl_history(db: Session, limit: int = 100) -> List[CrawlModel]:
    """Retrieve historical crawl session summaries ordered newest first."""
    return (
        db.query(CrawlModel)
        .order_by(CrawlModel.created_at.desc())
        .limit(limit)
        .all()
    )


def get_crawl_by_id(db: Session, crawl_id: int) -> Optional[CrawlModel]:
    """Retrieve single crawl record and eager-load associated pages by ID."""
    return (
        db.query(CrawlModel)
        .options(joinedload(CrawlModel.pages))
        .filter(CrawlModel.id == crawl_id)
        .first()
    )


def delete_crawl_by_id(db: Session, crawl_id: int) -> bool:
    """Delete a crawl record and its cascaded pages by ID."""
    crawl_record = db.query(CrawlModel).filter(CrawlModel.id == crawl_id).first()
    if not crawl_record:
        return False

    try:
        db.delete(crawl_record)
        db.commit()
        logger.info("Successfully deleted crawl #%d from database", crawl_id)
        return True
    except Exception as err:
        db.rollback()
        logger.error("Failed to delete crawl #%d: %s", crawl_id, err)
        raise err
