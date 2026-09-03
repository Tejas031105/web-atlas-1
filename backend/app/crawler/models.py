"""Data Models for WebAtlas Crawler Engine using Pydantic."""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl


class LinkType(str, Enum):
    """Link category relative to target crawl domain."""
    INTERNAL = "internal"
    EXTERNAL = "external"


class LinkInfo(BaseModel):
    """Metadata for a discovered link."""
    url: str
    normalized_url: str
    link_type: LinkType
    anchor_text: Optional[str] = None
    parent_url: str


class CrawlConfig(BaseModel):
    """Configuration options for crawl sessions."""
    max_pages: int = Field(default=100, ge=1, le=5000, description="Maximum total pages to crawl.")
    max_depth: int = Field(default=3, ge=0, le=20, description="Maximum crawl depth traversal limit.")
    timeout: float = Field(default=10.0, gt=0, le=60.0, description="HTTP request timeout in seconds.")
    delay: float = Field(default=0.1, ge=0.0, le=5.0, description="Delay between requests in seconds.")
    user_agent: str = Field(default="WebAtlas/0.1.0", description="User-Agent header string.")
    respect_robots_txt: bool = Field(default=True, description="Respect robots.txt restrictions.")
    follow_redirects: bool = Field(default=True, description="Follow HTTP redirects.")
    max_response_size: int = Field(default=5_242_880, description="Max HTML response size in bytes (5MB).")


class PageResult(BaseModel):
    """Details and extraction results for a single crawled page."""
    url: str
    normalized_url: str
    parent_url: Optional[str] = None
    depth: int = 0
    title: Optional[str] = None
    status_code: Optional[int] = None
    content_type: Optional[str] = None
    internal_links: List[str] = Field(default_factory=list)
    external_links: List[str] = Field(default_factory=list)
    crawl_success: bool = True
    error_message: Optional[str] = None
    response_time: float = 0.0  # seconds
    discovered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CrawlResult(BaseModel):
    """Overall summary report for a complete website crawl operation."""
    starting_url: str
    normalized_starting_url: str
    domain: str
    total_pages: int = 0
    successful_pages: int = 0
    failed_pages: int = 0
    total_internal_links: int = 0
    total_external_links: int = 0
    max_depth_reached: int = 0
    pages: List[PageResult] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    duration_seconds: float = 0.0
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
