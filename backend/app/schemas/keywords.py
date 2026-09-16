"""Pydantic Schemas for SEO Keywords & Topic Clusters API."""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class PageKeywordSummary(BaseModel):
    """Keyword mapping summary for an individual page."""

    url: str
    title: Optional[str] = None
    primary_keyword: Optional[str] = None
    related_keywords: List[str] = Field(default_factory=list)
    keyword_score: Optional[float] = None
    topic: Optional[str] = None
    cluster_id: Optional[str] = None
    cluster_name: Optional[str] = None


class ClusterPageItem(BaseModel):
    """Lightweight page item included inside a cluster detail response."""

    url: str
    title: Optional[str] = None
    primary_keyword: Optional[str] = None
    topic: Optional[str] = None


class ClusterDetail(BaseModel):
    """Detailed topic cluster item."""

    cluster_id: str
    cluster_name: str
    cluster_primary_topic: str
    keywords: List[str] = Field(default_factory=list)
    page_count: int = 0
    pages: List[ClusterPageItem] = Field(default_factory=list)


class CrawlKeywordsResponse(BaseModel):
    """Response model for GET /api/v1/crawls/{crawl_id}/keywords."""

    crawl_id: int
    starting_url: str
    domain: str
    total_pages_analyzed: int
    keywords: List[PageKeywordSummary] = Field(default_factory=list)


class ClusterSummaryResponse(BaseModel):
    """Response model for GET /api/v1/crawls/{crawl_id}/clusters."""

    crawl_id: int
    starting_url: str
    domain: str
    total_pages_analyzed: int
    total_clusters: int
    clusters: List[ClusterDetail] = Field(default_factory=list)
