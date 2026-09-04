"""Comprehensive tests for Playwright crawler integration, strategy selection, and dynamic rendering."""

import pytest
import http.server
import socketserver
import threading
import time
from unittest.mock import patch, AsyncMock

from app.crawler.engine import WebAtlasCrawler, CrawlConfig
from app.crawler.browser import BrowserRenderer
from app.crawler.strategy import DynamicContentDetector, should_use_playwright, RenderMode
from app.database.session import SessionLocal
from app.services.crawl_persistence import create_initial_crawl
from app.tasks.crawl_tasks import execute_crawl_task


# ------------------------------------------------------------------------------
# Mock HTTP Server with Static, JS App Shell, Robots.txt, and Dynamic Endpoints
# ------------------------------------------------------------------------------

STATIC_HTML = """<!DOCTYPE html>
<html>
<head><title>Static Page</title></head>
<body>
  <h1>Welcome to Static Site</h1>
  <a href="/static-subpage">Static Subpage Link</a>
  <a href="/static-subpage-2">Second Subpage Link</a>
  <a href="/static-subpage-3">Third Subpage Link</a>
  <a href="/static-subpage-4">Fourth Subpage Link</a>
</body>
</html>"""

STATIC_SUBPAGE_HTML = """<!DOCTYPE html>
<html>
<head><title>Static Subpage</title></head>
<body>
  <p>This is a static subpage.</p>
</body>
</html>"""

SPA_SHELL_HTML = """<!DOCTYPE html>
<html>
<head><title>Dynamic SPA Shell</title></head>
<body>
  <div id="root"></div>
  <script>
    var root = document.getElementById("root");
    root.innerHTML = '<a href="/dynamic-page">Dynamic Page Link</a>' +
                     '<a href="https://external-domain-test.com/out">External Link</a>';
  </script>
</body>
</html>"""

DYNAMIC_PAGE_HTML = """<!DOCTYPE html>
<html>
<head><title>Dynamic Content Loaded</title></head>
<body>
  <h1>Successfully Rendered via Playwright</h1>
</body>
</html>"""

ROBOTS_TXT = """User-agent: *
Disallow: /disallowed
"""

DISALLOWED_HTML = """<!DOCTYPE html>
<html>
<head><title>Disallowed Page</title></head>
<body>
  <p>Should not be crawled due to robots.txt</p>
</body>
</html>"""


class MultiEndpointTestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        self.send_response(200)

        if path == "/robots.txt":
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(ROBOTS_TXT.encode("utf-8"))
            return

        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()

        if path == "/":
            self.wfile.write(STATIC_HTML.encode("utf-8"))
        elif path == "/static-subpage":
            self.wfile.write(STATIC_SUBPAGE_HTML.encode("utf-8"))
        elif path == "/spa-shell":
            self.wfile.write(SPA_SHELL_HTML.encode("utf-8"))
        elif path == "/dynamic-page":
            self.wfile.write(DYNAMIC_PAGE_HTML.encode("utf-8"))
        elif path == "/disallowed":
            self.wfile.write(DISALLOWED_HTML.encode("utf-8"))
        else:
            self.wfile.write(STATIC_SUBPAGE_HTML.encode("utf-8"))

    def log_message(self, format, *args):
        pass  # Suppress HTTP logging during test execution


@pytest.fixture(scope="module")
def multi_endpoint_server():
    """Launch local HTTP server hosting static, JS shell, robots.txt, and dynamic routes."""
    server = socketserver.TCPServer(("127.0.0.1", 0), MultiEndpointTestHandler)
    ip, port = server.server_address
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    base_url = f"http://127.0.0.1:{port}"
    yield base_url

    server.shutdown()
    server.server_close()


# ------------------------------------------------------------------------------
# Strategy Unit Tests
# ------------------------------------------------------------------------------

def test_dynamic_content_detector_heuristics():
    """Verify conservative JS application shell detection logic."""
    # 1. Normal static page with scripts should NOT be classified as a JS shell if links exist
    static_with_script = "<html><body><script>console.log('hi');</script><a href='/a'>A</a><a href='/b'>B</a><a href='/c'>C</a><a href='/d'>D</a></body></html>"
    assert not DynamicContentDetector.is_js_shell(static_with_script, internal_links_count=4)

    # 2. Empty SPA root container (<div id="root"></div>) WITH script tag -> IS a JS shell
    assert DynamicContentDetector.is_js_shell(SPA_SHELL_HTML, internal_links_count=0)

    # 3. Mode helper function tests
    assert not should_use_playwright("httpx", SPA_SHELL_HTML)
    assert should_use_playwright("playwright", STATIC_HTML)
    assert should_use_playwright("auto", SPA_SHELL_HTML, internal_links_count=0)
    assert not should_use_playwright("auto", STATIC_HTML, internal_links_count=4)


# ------------------------------------------------------------------------------
# Crawler Integration Tests (A through K)
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_httpx_mode_never_calls_playwright(multi_endpoint_server):
    """A. HTTPX mode: Verify Playwright render is never invoked."""
    target_url = f"{multi_endpoint_server}/spa-shell"
    config = CrawlConfig(render_mode="httpx", max_pages=5, delay=0.0)
    crawler = WebAtlasCrawler(config)

    with patch.object(BrowserRenderer, "render", new_callable=AsyncMock) as mock_render:
        result = await crawler.crawl(target_url)
        assert result.total_pages == 1
        assert mock_render.call_count == 0


@pytest.mark.asyncio
async def test_playwright_mode_invokes_browser(multi_endpoint_server):
    """B. PLAYWRIGHT mode: Verify BrowserRenderer is invoked for crawling."""
    target_url = f"{multi_endpoint_server}/spa-shell"
    config = CrawlConfig(render_mode="playwright", max_pages=2, delay=0.0)
    crawler = WebAtlasCrawler(config)

    result = await crawler.crawl(target_url)
    assert result.total_pages >= 1
    # Check that dynamic link was rendered and discovered
    urls_crawled = [p.url for p in result.pages]
    assert any("/dynamic-page" in u for u in urls_crawled) or result.total_internal_links > 0


@pytest.mark.asyncio
async def test_auto_mode_uses_httpx_for_static_html(multi_endpoint_server):
    """C. AUTO mode with normal static HTML: Uses HTTPX without triggering Playwright fallback."""
    target_url = f"{multi_endpoint_server}/"
    config = CrawlConfig(render_mode="auto", max_pages=5, delay=0.0)
    crawler = WebAtlasCrawler(config)

    with patch.object(BrowserRenderer, "render", new_callable=AsyncMock) as mock_render:
        result = await crawler.crawl(target_url)
        assert result.total_pages > 1
        # Static page with 4 internal links should NOT trigger Playwright fallback
        assert mock_render.call_count == 0


@pytest.mark.asyncio
async def test_auto_mode_js_shell_triggers_playwright_and_discovers_links(multi_endpoint_server):
    """D & E. AUTO mode with JS shell: Fallback occurs and dynamic links are extracted via BeautifulSoup."""
    target_url = f"{multi_endpoint_server}/spa-shell"
    config = CrawlConfig(render_mode="auto", max_pages=5, max_depth=2, delay=0.0)
    crawler = WebAtlasCrawler(config)

    result = await crawler.crawl(target_url)
    crawled_urls = [p.url for p in result.pages]

    # Verify dynamic page link generated by JavaScript was discovered and crawled
    assert any("/dynamic-page" in u for u in crawled_urls)


@pytest.mark.asyncio
async def test_same_domain_restriction_for_dynamic_links(multi_endpoint_server):
    """F. Same-domain restriction: Dynamically generated external links are not crawled as internal targets."""
    target_url = f"{multi_endpoint_server}/spa-shell"
    config = CrawlConfig(render_mode="auto", max_pages=10, delay=0.0)
    crawler = WebAtlasCrawler(config)

    result = await crawler.crawl(target_url)
    crawled_urls = [p.url for p in result.pages]

    # Ensure no external-domain-test.com URL was enqueued as a page crawl target
    assert not any("external-domain-test.com" in u for u in crawled_urls)


@pytest.mark.asyncio
async def test_robots_txt_prevents_playwright_and_httpx(multi_endpoint_server):
    """G. Robots.txt: Disallowed URL is blocked before Playwright or HTTPX fetch."""
    target_url = f"{multi_endpoint_server}/disallowed"
    config = CrawlConfig(render_mode="playwright", respect_robots_txt=True, delay=0.0)
    crawler = WebAtlasCrawler(config)

    with patch.object(BrowserRenderer, "render", new_callable=AsyncMock) as mock_render:
        result = await crawler.crawl(target_url)
        assert result.total_pages == 1
        assert result.pages[0].crawl_success is False
        assert "robots.txt" in result.pages[0].error_message.lower()
        # BrowserRenderer should NOT be called for blocked URL
        assert mock_render.call_count == 0


@pytest.mark.asyncio
async def test_max_depth_enforced_for_dynamic_links(multi_endpoint_server):
    """H. max_depth: Dynamic links cannot bypass depth limits."""
    target_url = f"{multi_endpoint_server}/spa-shell"
    config = CrawlConfig(render_mode="auto", max_depth=0, max_pages=10, delay=0.0)
    crawler = WebAtlasCrawler(config)

    result = await crawler.crawl(target_url)
    # At depth 0, only starting page is crawled even if dynamic links were discovered
    assert result.total_pages == 1
    assert result.max_depth_reached == 0


@pytest.mark.asyncio
async def test_max_pages_enforced_for_dynamic_links(multi_endpoint_server):
    """I. max_pages: Dynamic links cannot bypass page limits."""
    target_url = f"{multi_endpoint_server}/spa-shell"
    config = CrawlConfig(render_mode="auto", max_pages=1, delay=0.0)
    crawler = WebAtlasCrawler(config)

    result = await crawler.crawl(target_url)
    assert result.total_pages == 1


@pytest.mark.asyncio
async def test_playwright_failure_preserves_httpx_result(multi_endpoint_server):
    """J & K. Playwright failure error handling & HTTPX result preservation."""
    target_url = f"{multi_endpoint_server}/spa-shell"
    config = CrawlConfig(render_mode="auto", max_pages=5, delay=0.0)
    crawler = WebAtlasCrawler(config)

    # Mock BrowserRenderer.render to raise an exception during fallback
    with patch.object(BrowserRenderer, "render", side_effect=Exception("Playwright browser crash mock")):
        result = await crawler.crawl(target_url)
        # Crawl should complete safely without unhandled exception, retaining HTTPX page result
        assert result.total_pages >= 1
        assert result.pages[0].status_code == 200


# ------------------------------------------------------------------------------
# Celery Compatibility Test (L)
# ------------------------------------------------------------------------------

def test_celery_task_with_render_mode(multi_endpoint_server):
    """L. Celery task compatibility: execute_crawl_task runs with render_mode."""
    db = SessionLocal()
    try:
        start_url = f"{multi_endpoint_server}/spa-shell"
        crawl_rec = create_initial_crawl(
            db,
            starting_url=start_url,
            normalized_starting_url=start_url,
            domain="127.0.0.1",
            render_mode="auto",
        )
        task_id = crawl_rec.id

        task_result = execute_crawl_task(
            crawl_id=task_id,
            starting_url=start_url,
            max_depth=1,
            max_pages=2,
            request_delay=0.0,
            respect_robots_txt=True,
            timeout=10.0,
            render_mode="auto",
        )

        assert task_result["status"] in ("COMPLETED", "RUNNING")
        assert task_result["total_pages"] >= 1
    finally:
        db.close()
