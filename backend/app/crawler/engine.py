"""WebAtlas Core Crawler Engine (Breadth-First Search Traversal)."""

import asyncio
import collections
import logging
import sys
import time
from typing import Optional, Set, Callable

from app.crawler.exceptions import CrawlerError, FetchError
from app.crawler.fetcher import AsyncFetcher, FetchResult
from app.crawler.browser import BrowserRenderer
from app.crawler.strategy import should_use_playwright, RenderMode
from app.crawler.models import CrawlConfig, CrawlResult, PageResult
from app.crawler.parser import HTMLParser
from app.crawler.robots import RobotsChecker
from app.crawler.url_utils import extract_domain, is_crawlable_scheme, normalize_url

logger = logging.getLogger("webatlas.crawler")


class WebAtlasCrawler:
    """Breadth-First Search (BFS) Web Crawler Engine."""

    def __init__(self, config: Optional[CrawlConfig] = None):
        self.config = config or CrawlConfig()
        self.robots_checker = RobotsChecker(
            user_agent=self.config.user_agent, timeout=self.config.timeout
        )

    async def crawl(
        self,
        starting_url: str,
        on_progress: Optional[Callable[[dict], None]] = None,
    ) -> CrawlResult:
        """Perform recursive internal-page crawl starting from starting_url."""
        start_time = time.perf_counter()

        # Normalize starting URL
        norm_start = normalize_url(starting_url)
        if not is_crawlable_scheme(norm_start):
            raise CrawlerError(f"Invalid or unsupported URL scheme: {starting_url}", url=starting_url)

        domain = extract_domain(norm_start)

        # Initialize tracking structures
        visited_urls: Set[str] = set()
        pages_results: list[PageResult] = []
        errors_list: list[str] = []

        total_internal_links_set: Set[str] = set()
        total_external_links_set: Set[str] = set()
        max_depth_reached = 0

        def emit_progress(cur_depth: int) -> None:
            if on_progress:
                failed_cnt = sum(1 for p in pages_results if not p.crawl_success)
                on_progress({
                    "pages_discovered": len(visited_urls),
                    "pages_crawled": len(pages_results),
                    "pages_failed": failed_cnt,
                    "current_depth": cur_depth,
                    "max_depth_reached": max_depth_reached,
                })

        # Queue storing tuple of (normalized_url, parent_url, depth)
        queue: collections.deque[tuple[str, Optional[str], int]] = collections.deque()
        queue.append((norm_start, None, 0))
        visited_urls.add(norm_start)

        emit_progress(0)
        logger.info("Crawl started for domain '%s' starting at %s", domain, norm_start)

        render_mode = str(getattr(self.config, "render_mode", "auto")).lower()
        browser_renderer: Optional[BrowserRenderer] = None
        if render_mode in (RenderMode.PLAYWRIGHT.value, RenderMode.AUTO.value):
            browser_renderer = BrowserRenderer(
                user_agent=self.config.user_agent,
                timeout=self.config.timeout,
            )

        try:
            async with AsyncFetcher(self.config) as fetcher:
                while queue and len(pages_results) < self.config.max_pages:
                    current_url, parent_url, depth = queue.popleft()
                    max_depth_reached = max(max_depth_reached, depth)

                    # Check robots.txt compliance
                    if self.config.respect_robots_txt:
                        allowed = await self.robots_checker.is_allowed(current_url, client=fetcher.client)
                        if not allowed:
                            msg = f"Robots.txt blocked access to {current_url}"
                            logger.warning(msg)
                            errors_list.append(msg)
                            pages_results.append(
                                PageResult(
                                    url=current_url,
                                    normalized_url=current_url,
                                    parent_url=parent_url,
                                    depth=depth,
                                    crawl_success=False,
                                    error_message="Blocked by robots.txt",
                                )
                            )
                            emit_progress(depth)
                            continue

                    # Optional request delay
                    if self.config.delay > 0 and len(pages_results) > 0:
                        await asyncio.sleep(self.config.delay)

                    # Fetch page content according to render_mode
                    fetch_res: Optional[FetchResult] = None
                    try:
                        if render_mode == RenderMode.PLAYWRIGHT.value:
                            logger.info("Fetching %s directly via Playwright browser renderer", current_url)
                            fetch_res = await browser_renderer.render(current_url)
                        else:
                            # HTTPX first for 'httpx' and 'auto' modes
                            fetch_res = await fetcher.fetch(current_url)

                            if render_mode == RenderMode.AUTO.value and fetch_res and fetch_res.is_html and browser_renderer:
                                tentative_parse = HTMLParser.parse(
                                    html_content=fetch_res.html_content,
                                    base_url=fetch_res.final_url,
                                    target_domain=domain,
                                )
                                if should_use_playwright(
                                    render_mode="auto",
                                    html_content=fetch_res.html_content,
                                    internal_links_count=len(tentative_parse.internal_links),
                                ):
                                    logger.info(
                                        "AUTO mode detected dynamic JS shell for %s. Triggering Playwright fallback...",
                                        current_url,
                                    )
                                    try:
                                        pw_res = await browser_renderer.render(current_url)
                                        if pw_res and pw_res.is_html and pw_res.html_content:
                                            fetch_res = pw_res
                                            logger.info("Playwright fallback rendering succeeded for %s", current_url)
                                    except Exception as pw_err:
                                        logger.warning(
                                            "Playwright fallback failed for %s (%s). Retaining HTTPX result.",
                                            current_url,
                                            pw_err,
                                        )

                    except FetchError as err:
                        logger.warning("Fetch failed for %s: %s", current_url, err.message)
                        errors_list.append(f"[{current_url}] {err.message}")
                        pages_results.append(
                            PageResult(
                                url=current_url,
                                normalized_url=current_url,
                                parent_url=parent_url,
                                depth=depth,
                                crawl_success=False,
                                error_message=err.message,
                            )
                        )
                        emit_progress(depth)
                        continue
                    except Exception as err:
                        msg = f"Unexpected error fetching {current_url}: {err}"
                        logger.error(msg)
                        errors_list.append(msg)
                        pages_results.append(
                            PageResult(
                                url=current_url,
                                normalized_url=current_url,
                                parent_url=parent_url,
                                depth=depth,
                                crawl_success=False,
                                error_message=str(err),
                            )
                        )
                        emit_progress(depth)
                        continue

                    # Parse HTML content
                    parsed_data = HTMLParser.parse(
                        html_content=fetch_res.html_content,
                        base_url=fetch_res.final_url,
                        target_domain=domain,
                    )

                    # Record page results
                    page_res = PageResult(
                        url=current_url,
                        normalized_url=normalize_url(fetch_res.final_url),
                        parent_url=parent_url,
                        depth=depth,
                        title=parsed_data.title,
                        status_code=fetch_res.status_code,
                        content_type=fetch_res.content_type,
                        internal_links=parsed_data.internal_links,
                        external_links=parsed_data.external_links,
                        crawl_success=(fetch_res.status_code < 400),
                        response_time=fetch_res.response_time,
                    )
                    pages_results.append(page_res)

                    # Collect overall link metrics
                    total_internal_links_set.update(parsed_data.internal_links)
                    total_external_links_set.update(parsed_data.external_links)

                    logger.info(
                        "Parsed [%d] %s - Title: '%s' (Found %d internal, %d external links)",
                        fetch_res.status_code,
                        current_url,
                        parsed_data.title or "N/A",
                        len(parsed_data.internal_links),
                        len(parsed_data.external_links),
                    )

                    # Enqueue new internal links if max_depth limit not exceeded
                    if depth < self.config.max_depth:
                        for int_link in parsed_data.internal_links:
                            if int_link not in visited_urls:
                                visited_urls.add(int_link)
                                queue.append((int_link, current_url, depth + 1))
                                logger.debug("Enqueued internal link (depth %d): %s", depth + 1, int_link)

                    emit_progress(depth)
        finally:
            if browser_renderer:
                await browser_renderer.close()

        duration = round(time.perf_counter() - start_time, 2)
        successful_count = sum(1 for p in pages_results if p.crawl_success)
        failed_count = len(pages_results) - successful_count

        logger.info(
            "Crawl completed for %s in %.2fs. Total pages: %d (Success: %d, Failed: %d)",
            domain,
            duration,
            len(pages_results),
            successful_count,
            failed_count,
        )

        return CrawlResult(
            starting_url=starting_url,
            normalized_starting_url=norm_start,
            domain=domain,
            total_pages=len(pages_results),
            successful_pages=successful_count,
            failed_pages=failed_count,
            total_internal_links=len(total_internal_links_set),
            total_external_links=len(total_external_links_set),
            max_depth_reached=max_depth_reached,
            pages=pages_results,
            errors=errors_list,
            duration_seconds=duration,
        )


def main():
    """CLI manual test runner for WebAtlas crawler."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    if len(sys.argv) < 2:
        print("Usage: python -m app.crawler.engine <URL> [max_pages] [max_depth]")
        sys.exit(1)

    target_url = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    max_depth = int(sys.argv[3]) if len(sys.argv) > 3 else 2

    config = CrawlConfig(max_pages=max_pages, max_depth=max_depth, delay=0.1)
    crawler = WebAtlasCrawler(config)

    print(f"\nLaunching WebAtlas Crawler for target: {target_url}")
    print(f"Limits: max_pages={max_pages}, max_depth={max_depth}\n")

    result = asyncio.run(crawler.crawl(target_url))

    print("\nWebAtlas Crawl Report")
    print("--------------------------------------------------------------------------------")
    print(f"Starting URL          : {result.starting_url}")
    print(f"Target Domain         : {result.domain}")
    print(f"Total Pages Crawled   : {result.total_pages}")
    print(f"Successful Pages      : {result.successful_pages}")
    print(f"Failed Pages          : {result.failed_pages}")
    print(f"Total Internal Links  : {result.total_internal_links}")
    print(f"Total External Links  : {result.total_external_links}")
    print(f"Max Depth Reached     : {result.max_depth_reached}")
    print(f"Crawl Duration        : {result.duration_seconds} seconds")
    print("--------------------------------------------------------------------------------")
    print(f"{'Depth':<6} | {'Status':<6} | {'URL':<50} | {'Title'}")
    print("--------------------------------------------------------------------------------")

    for page in result.pages:
        title_str = page.title or "(No Title)"
        status_str = str(page.status_code) if page.status_code else "ERR"
        url_disp = page.url if len(page.url) <= 50 else page.url[:47] + "..."
        print(f"{page.depth:<6} | {status_str:<6} | {url_disp:<50} | {title_str}")

    print("--------------------------------------------------------------------------------\n")


if __name__ == "__main__":
    main()
