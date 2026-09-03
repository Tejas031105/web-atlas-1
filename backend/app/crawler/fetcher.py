"""HTTP Fetcher using httpx for WebAtlas Crawler."""

import time
import logging
from typing import Tuple, Optional
import httpx

from app.crawler.models import CrawlConfig
from app.crawler.exceptions import FetchError

logger = logging.getLogger(__name__)


class FetchResult:
    """Container for HTTP response metadata and raw content."""

    def __init__(
        self,
        url: str,
        final_url: str,
        status_code: int,
        content_type: str,
        html_content: str,
        response_time: float,
        is_html: bool,
    ):
        self.url = url
        self.final_url = final_url
        self.status_code = status_code
        self.content_type = content_type
        self.html_content = html_content
        self.response_time = response_time
        self.is_html = is_html


class AsyncFetcher:
    """Asynchronous HTTP page fetcher wrapper."""

    def __init__(self, config: CrawlConfig):
        self.config = config
        self.client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        headers = {
            "User-Agent": self.config.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
        timeout = httpx.Timeout(self.config.timeout, connect=5.0)

        self.client = httpx.AsyncClient(
            headers=headers,
            limits=limits,
            timeout=timeout,
            follow_redirects=self.config.follow_redirects,
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    async def fetch(self, url: str) -> FetchResult:
        """Fetch page content at the specified URL safely."""
        if not self.client:
            raise FetchError("Fetcher client not initialized", url=url)

        start_time = time.perf_counter()
        try:
            logger.info("Fetching URL: %s", url)
            response = await self.client.get(url)
            elapsed_time = round(time.perf_counter() - start_time, 4)

            final_url = str(response.url)
            status_code = response.status_code
            content_type_header = response.headers.get("content-type", "").lower()
            content_type = content_type_header.split(";")[0].strip() if content_type_header else "unknown"

            is_html = "text/html" in content_type_header or "application/xhtml+xml" in content_type_header

            # Content length check for safety
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > self.config.max_response_size:
                logger.warning("Skipping URL %s: Content length (%s) exceeds max limit.", url, content_length)
                return FetchResult(
                    url=url,
                    final_url=final_url,
                    status_code=status_code,
                    content_type=content_type,
                    html_content="",
                    response_time=elapsed_time,
                    is_html=False,
                )

            if not is_html:
                logger.info("Non-HTML response for %s (Content-Type: %s)", url, content_type)
                return FetchResult(
                    url=url,
                    final_url=final_url,
                    status_code=status_code,
                    content_type=content_type,
                    html_content="",
                    response_time=elapsed_time,
                    is_html=False,
                )

            # Cap raw text length if header missing but payload large
            text_content = response.text
            if len(text_content.encode("utf-8")) > self.config.max_response_size:
                text_content = text_content[: self.config.max_response_size]

            return FetchResult(
                url=url,
                final_url=final_url,
                status_code=status_code,
                content_type=content_type,
                html_content=text_content,
                response_time=elapsed_time,
                is_html=True,
            )

        except httpx.TimeoutException as exc:
            elapsed_time = round(time.perf_counter() - start_time, 4)
            raise FetchError(f"Request timeout after {self.config.timeout}s: {exc}", url=url) from exc
        except httpx.NetworkError as exc:
            elapsed_time = round(time.perf_counter() - start_time, 4)
            raise FetchError(f"Network error / DNS resolution failed: {exc}", url=url) from exc
        except httpx.HTTPError as exc:
            elapsed_time = round(time.perf_counter() - start_time, 4)
            raise FetchError(f"HTTP request error: {exc}", url=url) from exc
        except Exception as exc:
            elapsed_time = round(time.perf_counter() - start_time, 4)
            raise FetchError(f"Unexpected fetch error: {exc}", url=url) from exc
