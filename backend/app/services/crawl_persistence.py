"""Database Persistence Repository Service for Crawls and Discovered Pages."""

import json
import logging
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from app.crawler.models import CrawlResult, CrawlConfig
from app.models.crawl import CrawlModel, PageModel

logger = logging.getLogger(__name__)


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
            status="completed",
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
