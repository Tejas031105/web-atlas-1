"""Crawl API Endpoint Router."""

import logging
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.crawl_persistence import save_crawl_result
from app.crawler import (
    WebAtlasCrawler,
    CrawlConfig,
    CrawlerError,
    FetchError,
    InvalidURLError,
    RobotsBlockedError,
)
from app.schemas.crawl import (
    CrawlRequest,
    CrawlResponse,
    CrawlErrorResponse,
    PageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crawl", tags=["Crawler"])


@router.post(
    "",
    response_model=CrawlResponse,
    status_code=status.HTTP_200_OK,
    summary="Crawl Website",
    description=(
        "Initiates a recursive internal page discovery crawl starting from the provided website URL. "
        "Respects robots.txt rules, maximum depth boundaries, and max page limits. "
        "Saves completed crawls and discovered pages to local database storage."
    ),
    responses={
        400: {"model": CrawlErrorResponse, "description": "Invalid URL or target website unreachable"},
        422: {"description": "Validation error in request parameters"},
        500: {"model": CrawlErrorResponse, "description": "Internal server error during crawl operation"},
    },
)
async def crawl_website(
    request: CrawlRequest, db: Session = Depends(get_db)
) -> CrawlResponse:
    """Execute website crawl request asynchronously, persist results, and return page map data."""
    logger.info(
        "Received crawl request for URL: %s (max_depth=%d, max_pages=%d)",
        request.url,
        request.max_depth,
        request.max_pages,
    )

    # Build crawler configuration
    config = CrawlConfig(
        max_pages=request.max_pages,
        max_depth=request.max_depth,
        delay=request.request_delay,
        respect_robots_txt=request.respect_robots_txt,
        timeout=request.timeout,
    )

    crawler = WebAtlasCrawler(config)

    try:
        crawl_result = await crawler.crawl(request.url)
    except InvalidURLError as err:
        logger.warning("Invalid URL supplied to crawl API: %s", err.message)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid website URL provided: {err.message}",
        )
    except RobotsBlockedError as err:
        logger.warning("Target URL blocked by robots.txt: %s", err.url)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target URL access is prohibited by robots.txt rules.",
        )
    except FetchError as err:
        logger.warning("Fetch failure during crawl: %s", err.message)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to reach target website: {err.message}",
        )
    except CrawlerError as err:
        logger.error("Crawler engine error: %s", err.message)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"WebAtlas crawler error: {err.message}",
        )
    except Exception as err:
        logger.exception("Unexpected exception executing crawl for %s: %s", request.url, err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected internal error occurred while processing the website crawl.",
        )

    # Check if starting URL failed to fetch completely
    if crawl_result.total_pages == 0:
        error_msg = (
            crawl_result.errors[0]
            if crawl_result.errors
            else "Unable to fetch or parse starting page."
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Crawl failed for target URL: {error_msg}",
        )

    # Transactionally persist crawl result and pages into SQLite DB
    saved_crawl_record = None
    try:
        saved_crawl_record = save_crawl_result(db, crawl_result, config)
    except Exception as err:
        logger.error("Failed to persist crawl result to SQLite database: %s", err)
        # Crawl executed successfully, so log warning without failing API response

    # Convert CrawlResult PageResults to PageResponse schemas
    pages_list = [
        PageResponse(
            url=p.url,
            normalized_url=p.normalized_url,
            parent_url=p.parent_url,
            depth=p.depth,
            title=p.title,
            status_code=p.status_code,
            content_type=p.content_type,
            internal_links=p.internal_links,
            external_links=p.external_links,
            crawl_success=p.crawl_success,
            error_message=p.error_message,
            response_time=p.response_time,
            discovered_at=p.discovered_at,
        )
        for p in crawl_result.pages
    ]

    return CrawlResponse(
        crawl_id=saved_crawl_record.id if saved_crawl_record else None,
        starting_url=crawl_result.starting_url,
        normalized_starting_url=crawl_result.normalized_starting_url,
        domain=crawl_result.domain,
        total_pages=crawl_result.total_pages,
        successful_pages=crawl_result.successful_pages,
        failed_pages=crawl_result.failed_pages,
        total_internal_links=crawl_result.total_internal_links,
        total_external_links=crawl_result.total_external_links,
        max_depth_reached=crawl_result.max_depth_reached,
        pages=pages_list,
        errors=crawl_result.errors,
        duration_seconds=crawl_result.duration_seconds,
        completed_at=crawl_result.completed_at,
    )
