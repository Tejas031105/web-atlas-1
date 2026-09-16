"""Pydantic Request and Response Schemas for Crawl API."""

from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator


class CrawlRequest(BaseModel):
    """Input payload for initiating a website crawl operation."""

    url: str = Field(
        ...,
        description="Public website starting URL (must include http:// or https:// scheme)",
        examples=["https://example.com"],
    )
    max_depth: int = Field(
        default=2,
        ge=0,
        le=10,
        description="Maximum recursion depth for following internal links (0 = single page)",
    )
    max_pages: int = Field(
        default=50,
        ge=1,
        le=200,
        description="Maximum total number of internal pages to discover and parse",
    )
    request_delay: float = Field(
        default=0.1,
        ge=0.0,
        le=5.0,
        description="Delay in seconds between successive HTTP requests",
    )
    respect_robots_txt: bool = Field(
        default=True,
        description="Enforce robots.txt disallow policies during crawl",
    )
    timeout: float = Field(
        default=10.0,
        ge=1.0,
        le=60.0,
        description="HTTP request timeout in seconds per page fetch",
    )
    render_mode: Optional[str] = Field(
        default="auto",
        description="Rendering strategy: auto (HTTPX with JS shell fallback), httpx (HTTPX only), or playwright (browser)",
    )

    @field_validator("render_mode")
    @classmethod
    def validate_render_mode(cls, value: Optional[str]) -> str:
        """Ensure render_mode is one of 'auto', 'httpx', 'playwright'."""
        if not value:
            return "auto"
        val = value.strip().lower()
        if val not in ("auto", "httpx", "playwright"):
            raise ValueError("render_mode must be one of: 'auto', 'httpx', or 'playwright'")
        return val

    @field_validator("url")
    @classmethod
    def validate_url_scheme_and_syntax(cls, value: str) -> str:
        """Validate that the URL is a non-empty, syntactically valid HTTP or HTTPS URL."""
        if not value or not isinstance(value, str):
            raise ValueError("URL must be a non-empty string.")

        trimmed = value.strip()
        if not trimmed:
            raise ValueError("URL cannot be empty or whitespace.")

        parsed = urlparse(trimmed)
        if parsed.scheme.lower() not in ("http", "https"):
            raise ValueError("URL scheme must be 'http://' or 'https://'.")

        if not parsed.netloc:
            raise ValueError("Invalid URL format: missing domain/hostname.")

        return trimmed


class PageResponse(BaseModel):
    """Representation of a single crawled page result in API responses."""

    url: str
    normalized_url: str
    parent_url: Optional[str] = None
    depth: int
    title: Optional[str] = None
    status_code: Optional[int] = None
    content_type: Optional[str] = None
    internal_links: List[str] = Field(default_factory=list)
    external_links: List[str] = Field(default_factory=list)
    meta_description: Optional[str] = None
    h1: Optional[str] = None
    headings: List[str] = Field(default_factory=list)
    main_text: Optional[str] = None
    primary_keyword: Optional[str] = None
    related_keywords: List[str] = Field(default_factory=list)
    keyword_score: Optional[float] = None
    topic: Optional[str] = None
    cluster_id: Optional[str] = None
    cluster_name: Optional[str] = None
    crawl_success: bool
    error_message: Optional[str] = None
    response_time: float
    discovered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CrawlResponse(BaseModel):
    """Complete summary and page collection returned by crawl operation."""

    crawl_id: Optional[int] = Field(default=None, description="Unique primary key database identifier for the crawl session")
    task_id: Optional[str] = Field(default=None, description="Celery background task ID")
    status: str = Field(default="QUEUED", description="Crawl job status: QUEUED, RUNNING, COMPLETED, FAILED")
    starting_url: str
    normalized_starting_url: str
    domain: str
    total_pages: int = 0
    successful_pages: int = 0
    failed_pages: int = 0
    total_internal_links: int = 0
    total_external_links: int = 0
    max_depth_reached: int = 0
    pages: List[PageResponse] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    duration_seconds: float = 0.0
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CrawlStatusResponse(BaseModel):
    """Detailed progress and execution status for a crawl session."""

    crawl_id: int
    task_id: Optional[str] = None
    status: str
    starting_url: str
    domain: str
    pages_discovered: int = 0
    pages_crawled: int = 0
    pages_failed: int = 0
    successful_pages: int = 0
    current_depth: int = 0
    max_depth: int = 2
    max_pages: int = 50
    progress_percent: Optional[float] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    errors: List[str] = Field(default_factory=list)
    duration_seconds: float = 0.0


class CrawlHistoryItem(BaseModel):
    """Lightweight summary item for crawl history listings."""

    crawl_id: int
    task_id: Optional[str] = None
    status: str = "COMPLETED"
    starting_url: str
    normalized_starting_url: str
    domain: str
    total_pages: int
    successful_pages: int
    failed_pages: int
    duration_seconds: float
    created_at: datetime


class DeleteCrawlResponse(BaseModel):
    """Response payload returned when a historical crawl is deleted."""

    message: str
    crawl_id: int


class CrawlErrorResponse(BaseModel):
    """Standardized error payload returned when crawl request fails."""

    detail: str
