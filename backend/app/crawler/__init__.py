"""WebAtlas Crawler Package."""

from app.crawler.engine import WebAtlasCrawler
from app.crawler.models import CrawlConfig, CrawlResult, PageResult, LinkInfo, LinkType
from app.crawler.exceptions import (
    CrawlerError,
    FetchError,
    RobotsBlockedError,
    InvalidURLError,
    MaxPagesReachedError,
)

__all__ = [
    "WebAtlasCrawler",
    "CrawlConfig",
    "CrawlResult",
    "PageResult",
    "LinkInfo",
    "LinkType",
    "CrawlerError",
    "FetchError",
    "RobotsBlockedError",
    "InvalidURLError",
    "MaxPagesReachedError",
]
