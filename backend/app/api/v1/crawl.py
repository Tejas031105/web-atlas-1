"""Crawl API Endpoint Router."""

import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.crawl_persistence import (
    create_initial_crawl,
    update_crawl_task_id,
    get_crawl_by_id,
)
from app.crawler.url_utils import normalize_url, extract_domain, is_crawlable_scheme
from app.tasks.crawl_tasks import execute_crawl_task
from app.schemas.crawl import (
    CrawlRequest,
    CrawlResponse,
    CrawlStatusResponse,
    CrawlErrorResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crawl", tags=["Crawler"])


@router.post(
    "",
    response_model=CrawlResponse,
    status_code=status.HTTP_200_OK,
    summary="Crawl Website (Queued)",
    description=(
        "Enqueues a background website crawl job. Creates a database crawl record with QUEUED status, "
        "submits a Celery background task, and immediately returns the crawl session and task identifiers."
    ),
    responses={
        400: {"model": CrawlErrorResponse, "description": "Invalid URL format or scheme"},
        422: {"description": "Validation error in request parameters"},
        500: {"model": CrawlErrorResponse, "description": "Internal server error queuing crawl job"},
    },
)
async def crawl_website(
    request: CrawlRequest, db: Session = Depends(get_db)
) -> CrawlResponse:
    """Enqueue website crawl request into Celery background worker system and return session ID."""
    logger.info(
        "Received crawl request for URL: %s (max_depth=%d, max_pages=%d)",
        request.url,
        request.max_depth,
        request.max_pages,
    )

    try:
        norm_url = normalize_url(request.url)
        if not is_crawlable_scheme(norm_url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported website URL scheme: {request.url}",
            )
        domain = extract_domain(norm_url)
    except HTTPException:
        raise
    except Exception as err:
        logger.warning("Invalid URL scheme or format provided: %s", err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid website URL provided: {err}",
        )

    eff_render_mode = request.render_mode or "auto"

    # 1. Create initial DB record with QUEUED status
    try:
        crawl_record = create_initial_crawl(
            db,
            starting_url=request.url,
            normalized_starting_url=norm_url,
            domain=domain,
            max_depth=request.max_depth,
            max_pages=request.max_pages,
            render_mode=eff_render_mode,
        )
    except Exception as err:
        logger.error("Failed to create initial database crawl record: %s", err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize crawl record in database.",
        )

    # 2. Dispatch Celery background task
    try:
        task = execute_crawl_task.delay(
            crawl_id=crawl_record.id,
            starting_url=request.url,
            max_depth=request.max_depth,
            max_pages=request.max_pages,
            request_delay=request.request_delay,
            respect_robots_txt=request.respect_robots_txt,
            timeout=request.timeout,
            render_mode=eff_render_mode,
        )
        update_crawl_task_id(db, crawl_record.id, task.id)
        task_id = task.id
    except Exception as err:
        logger.error("Failed to queue Celery crawl task: %s", err)
        task_id = None

    return CrawlResponse(
        crawl_id=crawl_record.id,
        task_id=task_id,
        status="QUEUED",
        starting_url=request.url,
        normalized_starting_url=norm_url,
        domain=domain,
        total_pages=0,
        successful_pages=0,
        failed_pages=0,
        total_internal_links=0,
        total_external_links=0,
        max_depth_reached=0,
        pages=[],
        errors=[],
        duration_seconds=0.0,
        completed_at=crawl_record.created_at or datetime.now(timezone.utc),
    )


@router.get(
    "/{crawl_id}/status",
    response_model=CrawlStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Crawl Execution Status",
    description="Check the current status (QUEUED, RUNNING, COMPLETED, FAILED) and summary statistics of a crawl job.",
    responses={
        404: {"model": CrawlErrorResponse, "description": "Crawl record not found"},
    },
)
async def get_crawl_status(
    crawl_id: int, db: Session = Depends(get_db)
) -> CrawlStatusResponse:
    """Retrieve execution status and current metric counters of a background crawl session."""
    record = get_crawl_by_id(db, crawl_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crawl record with ID #{crawl_id} not found.",
        )

    max_p = record.max_pages_requested if record.max_pages_requested is not None else 50
    progress_pct = (
        min(round((record.total_pages / max_p) * 100.0, 1), 100.0)
        if max_p > 0
        else None
    )
    errors = []
    if record.errors_json:
        try:
            parsed = json.loads(record.errors_json)
            errors = parsed if isinstance(parsed, list) else [str(parsed)]
        except Exception:
            errors = [str(record.errors_json)]
    error_str = errors[-1] if errors and record.status == "FAILED" else None

    return CrawlStatusResponse(
        crawl_id=record.id,
        task_id=record.task_id,
        status=record.status,
        starting_url=record.starting_url,
        domain=record.domain,
        pages_discovered=record.pages_discovered or record.total_pages,
        pages_crawled=record.total_pages,
        pages_failed=record.failed_pages,
        successful_pages=record.successful_pages,
        current_depth=record.current_depth,
        max_depth=record.max_depth_requested,
        max_pages=max_p,
        progress_percent=progress_pct,
        started_at=record.started_at,
        completed_at=record.completed_at,
        error=error_str,
        errors=errors,
        duration_seconds=record.duration_seconds,
    )
