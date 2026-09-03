"""Crawl History API Endpoint Router."""

import json
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import crawl_persistence
from app.schemas.crawl import (
    CrawlHistoryItem,
    CrawlResponse,
    PageResponse,
    DeleteCrawlResponse,
    CrawlErrorResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crawls", tags=["History"])


@router.get(
    "",
    response_model=List[CrawlHistoryItem],
    status_code=status.HTTP_200_OK,
    summary="List Crawl History",
    description="Retrieves a list of historical crawl session summaries ordered newest first.",
)
async def list_crawl_history(
    limit: int = 100, db: Session = Depends(get_db)
) -> List[CrawlHistoryItem]:
    """Retrieve lightweight historical crawl summaries."""
    crawl_records = crawl_persistence.get_crawl_history(db, limit=limit)
    return [
        CrawlHistoryItem(
            crawl_id=record.id,
            starting_url=record.starting_url,
            normalized_starting_url=record.normalized_starting_url,
            domain=record.domain,
            total_pages=record.total_pages,
            successful_pages=record.successful_pages,
            failed_pages=record.failed_pages,
            duration_seconds=record.duration_seconds,
            created_at=record.created_at,
        )
        for record in crawl_records
    ]


@router.get(
    "/{crawl_id}",
    response_model=CrawlResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Individual Crawl Result",
    description="Retrieves complete stored crawl result and all discovered pages by crawl ID.",
    responses={
        404: {"model": CrawlErrorResponse, "description": "Crawl record not found"},
    },
)
async def get_crawl(crawl_id: int, db: Session = Depends(get_db)) -> CrawlResponse:
    """Retrieve full historical crawl result by database primary key ID."""
    record = crawl_persistence.get_crawl_by_id(db, crawl_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crawl record with ID #{crawl_id} not found.",
        )

    # Reconstruct PageResponse list from PageModel records
    pages_list: List[PageResponse] = []
    for p in record.pages:
        int_links = json.loads(p.internal_links_json) if p.internal_links_json else []
        ext_links = json.loads(p.external_links_json) if p.external_links_json else []
        pages_list.append(
            PageResponse(
                url=p.url,
                normalized_url=p.normalized_url,
                parent_url=p.parent_url,
                depth=p.depth,
                title=p.title,
                status_code=p.status_code,
                content_type=p.content_type,
                internal_links=int_links,
                external_links=ext_links,
                crawl_success=p.crawl_success,
                error_message=p.error_message,
                response_time=p.response_time,
                discovered_at=p.discovered_at,
            )
        )

    errors = json.loads(record.errors_json) if record.errors_json else []

    return CrawlResponse(
        crawl_id=record.id,
        starting_url=record.starting_url,
        normalized_starting_url=record.normalized_starting_url,
        domain=record.domain,
        total_pages=record.total_pages,
        successful_pages=record.successful_pages,
        failed_pages=record.failed_pages,
        total_internal_links=record.total_internal_links,
        total_external_links=record.total_external_links,
        max_depth_reached=record.max_depth_reached,
        pages=pages_list,
        errors=errors,
        duration_seconds=record.duration_seconds,
        completed_at=record.created_at,
    )


@router.delete(
    "/{crawl_id}",
    response_model=DeleteCrawlResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Crawl History Record",
    description="Deletes a historical crawl session and all associated page records from local storage.",
    responses={
        404: {"model": CrawlErrorResponse, "description": "Crawl record not found"},
    },
)
async def delete_crawl(crawl_id: int, db: Session = Depends(get_db)) -> DeleteCrawlResponse:
    """Delete a crawl record and its pages by ID."""
    deleted = crawl_persistence.delete_crawl_by_id(db, crawl_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crawl record with ID #{crawl_id} not found.",
        )

    return DeleteCrawlResponse(
        message="Crawl history record deleted successfully",
        crawl_id=crawl_id,
    )
