"""Custom Exception classes for WebAtlas Crawler Engine."""


class CrawlerError(Exception):
    """Base exception for all web crawler errors."""

    def __init__(self, message: str, url: str | None = None):
        super().__init__(message)
        self.message = message
        self.url = url

    def __str__(self) -> str:
        if self.url:
            return f"[{self.url}] {self.message}"
        return self.message


class FetchError(CrawlerError):
    """Raised when an HTTP request fails, times out, or returns a non-200 status."""

    def __init__(self, message: str, url: str | None = None, status_code: int | None = None):
        super().__init__(message, url)
        self.status_code = status_code


class RobotsBlockedError(CrawlerError):
    """Raised when a URL is prohibited from being crawled according to robots.txt."""

    def __init__(self, url: str):
        super().__init__("Access disallowed by robots.txt rules", url)


class InvalidURLError(CrawlerError):
    """Raised when a URL is malformed or uses an unsupported scheme."""

    def __init__(self, message: str, url: str):
        super().__init__(message, url)


class MaxPagesReachedError(CrawlerError):
    """Raised when the crawler reaches its maximum page limit."""

    def __init__(self, limit: int):
        super().__init__(f"Crawl limit of {limit} pages reached.")
        self.limit = limit
