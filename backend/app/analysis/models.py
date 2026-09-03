"""Pydantic Schemas for Website Health & Crawl Diagnostics."""

from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field


class DiagnosticIssue(BaseModel):
    """Represents a single categorized issue or warning discovered during analysis."""

    severity: Literal["critical", "error", "warning", "info"] = Field(
        ..., description="Severity level of the diagnostic issue"
    )
    category: str = Field(..., description="Category group (e.g. HTTP Status, Links, SEO Titles, Structure)")
    message: str = Field(..., description="Human-readable description of the issue")
    affected_count: int = Field(default=1, description="Number of items or pages affected")
    affected_urls: List[str] = Field(default_factory=list, description="Sample list of affected URLs")


class ScoreDeduction(BaseModel):
    """Breakdown entry explaining a point deduction from the health score."""

    reason: str = Field(..., description="Description of the issue triggering deduction")
    deduction: int = Field(..., description="Points deducted from maximum 100")


class StatusDistribution(BaseModel):
    """Distribution counts of pages by HTTP status code categories."""

    count_2xx: int = Field(default=0, description="Healthy 2xx Success responses")
    count_3xx: int = Field(default=0, description="3xx Redirection responses")
    count_4xx: int = Field(default=0, description="4xx Client Error responses")
    count_5xx: int = Field(default=0, description="5xx Server Error responses")
    count_other: int = Field(default=0, description="Other or unknown error responses")
    exact_status_counts: Dict[str, int] = Field(
        default_factory=dict, description="Map of exact HTTP status codes to page counts (e.g. {'200': 18, '404': 1})"
    )


class LinkStatistics(BaseModel):
    """Comprehensive analysis of internal and external link references."""

    total_internal_links: int = Field(default=0)
    unique_internal_links: int = Field(default=0)
    verified_internal_ok: int = Field(default=0, description="Internal links pointing to crawled 2xx/3xx pages")
    verified_internal_broken: int = Field(default=0, description="Internal links pointing to crawled 4xx/5xx/ERR pages")
    unverified_internal: int = Field(default=0, description="Discovered internal links that were not crawled due to depth/limit settings")
    total_external_links: int = Field(default=0)
    unique_external_links: int = Field(default=0)
    unverified_external: int = Field(default=0, description="Discovered external links (not crawled by policy)")


class DepthStatistics(BaseModel):
    """Page distribution and metrics across crawl depth levels."""

    min_depth: int = Field(default=0)
    max_depth_reached: int = Field(default=0)
    average_depth: float = Field(default=0.0)
    depth_counts: Dict[str, int] = Field(default_factory=dict, description="Map of depth levels to page counts")


class TitleStatistics(BaseModel):
    """Analysis of page HTML title presence and uniqueness."""

    total_with_title: int = Field(default=0)
    missing_title_count: int = Field(default=0)
    duplicate_title_count: int = Field(default=0)
    missing_title_urls: List[str] = Field(default_factory=list)
    duplicate_title_groups: Dict[str, List[str]] = Field(
        default_factory=dict, description="Map of duplicate titles to list of URLs sharing that title"
    )


class DiagnosticsResponse(BaseModel):
    """Complete Website Health & Crawl Diagnostics Report."""

    crawl_id: Optional[int] = Field(default=None, description="Associated database primary key ID")
    starting_url: str
    domain: str
    health_score: int = Field(..., ge=0, le=100, description="Overall health score from 0 to 100")
    health_status: Literal["Excellent", "Good", "Needs Attention", "Poor"] = Field(
        ..., description="Human-readable health classification"
    )

    total_pages: int
    successful_pages: int
    failed_pages: int

    score_breakdown: List[ScoreDeduction] = Field(default_factory=list)
    status_distribution: StatusDistribution
    link_statistics: LinkStatistics
    depth_statistics: DepthStatistics
    title_statistics: TitleStatistics

    potential_orphans_count: int = Field(default=0)
    potential_orphan_urls: List[str] = Field(default_factory=list)
    robots_blocked_count: int = Field(default=0)

    issues: List[DiagnosticIssue] = Field(default_factory=list)
