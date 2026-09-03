"""Website Health & Crawl Diagnostics API Endpoint Router."""

import logging
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import crawl_persistence
from app.analysis import CrawlAnalyzer, DiagnosticsResponse
from app.schemas.crawl import CrawlErrorResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crawls", tags=["Diagnostics"])


@router.get(
    "/{crawl_id}/diagnostics",
    response_model=DiagnosticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Crawl Health Diagnostics",
    description=(
        "Analyzes a completed historical crawl session from the database and returns a deterministic "
        "website health score (0-100), HTTP status distribution, link statistics, depth breakdown, "
        "title issues, and severity-categorized diagnostic issues."
    ),
    responses={
        404: {"model": CrawlErrorResponse, "description": "Crawl record not found"},
    },
)
async def get_crawl_diagnostics(
    crawl_id: int, db: Session = Depends(get_db)
) -> DiagnosticsResponse:
    """Retrieve diagnostic health report for a stored crawl by ID."""
    crawl_record = crawl_persistence.get_crawl_by_id(db, crawl_id)
    if not crawl_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crawl record with ID #{crawl_id} not found.",
        )

    return CrawlAnalyzer.analyze_model(crawl_record)
