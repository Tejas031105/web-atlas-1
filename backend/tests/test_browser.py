"""Unit and local integration tests for Playwright BrowserRenderer service."""

import pytest
import http.server
import socketserver
import threading
import time
from unittest.mock import AsyncMock, patch

from app.core.config import settings
from app.crawler.browser import BrowserRenderer
from app.crawler.fetcher import AsyncFetcher, CrawlConfig
from app.crawler.exceptions import FetchError


# ------------------------------------------------------------------------------
# Local Test HTTP Server Fixture for JavaScript Link Injection Testing
# ------------------------------------------------------------------------------

HTML_WITH_JS = """<!DOCTYPE html>
<html>
<head><title>JS Render Test Page</title></head>
<body>
  <h1>Base Page Content</h1>
  <script>
    // Dynamically inject link via JavaScript after DOM load
    const linkPath = "/dynamic" + "-js" + "-link";
    const linkText = "Dynamic" + " JS" + " Generated" + " Link";
    var a = document.createElement('a');
    a.href = linkPath;
    a.textContent = linkText;
    document.body.appendChild(a);
  </script>
</body>
</html>"""


class LocalJSServerHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(HTML_WITH_JS.encode("utf-8"))

    def log_message(self, format, *args):
        pass  # Suppress HTTP server output logs in test runner


@pytest.fixture(scope="module")
def local_js_server():
    """Start a local HTTP server serving JavaScript test HTML on a random free port."""
    server = socketserver.TCPServer(("127.0.0.1", 0), LocalJSServerHandler)
    ip, port = server.server_address
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    server_url = f"http://127.0.0.1:{port}"
    yield server_url

    server.shutdown()
    server.server_close()


# ------------------------------------------------------------------------------
# Unit Tests for BrowserRenderer Configuration & Teardown
# ------------------------------------------------------------------------------

def test_browser_renderer_import_and_configuration():
    """Verify BrowserRenderer can be instantiated with settings defaults."""
    renderer = BrowserRenderer()
    assert renderer.headless == settings.PLAYWRIGHT_HEADLESS
    assert renderer.timeout == settings.PLAYWRIGHT_TIMEOUT
    assert renderer.user_agent == "WebAtlas/0.1.0"
    assert renderer.wait_until == settings.PLAYWRIGHT_WAIT_UNTIL


@pytest.mark.asyncio
async def test_browser_renderer_invalid_url_scheme():
    """Verify renderer rejects non-HTTP schemes safely without launching browser."""
    async with BrowserRenderer() as renderer:
        with pytest.raises(FetchError) as exc_info:
            await renderer.render("ftp://invalid.scheme/file.txt")
        assert "scheme" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_browser_renderer_timeout_handling():
    """Verify navigation timeout raises FetchError and cleans up resources cleanly."""
    async with BrowserRenderer(timeout=0.001) as renderer:
        with pytest.raises(FetchError) as exc_info:
            await renderer.render("http://127.0.0.1:54321/unreachable")
        assert "timeout" in str(exc_info.value).lower() or "rendering error" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_browser_renderer_custom_user_agent():
    """Verify custom user_agent parameter configuration."""
    renderer = BrowserRenderer(user_agent="CustomWebAtlasAgent/1.0")
    assert renderer.user_agent == "CustomWebAtlasAgent/1.0"


# ------------------------------------------------------------------------------
# Local Integration Test: HTTPX vs Playwright JavaScript Rendering
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_httpx_vs_playwright_javascript_rendering(local_js_server):
    """Local integration test proving HTTPX raw fetch lacks JS-generated links while Playwright renders them."""
    # 1. Fetch raw HTML using HTTPX
    config = CrawlConfig(timeout=5.0)
    async with AsyncFetcher(config) as fetcher:
        raw_res = await fetcher.fetch(local_js_server)
        assert raw_res.status_code == 200
        # Raw HTTPX HTML contains the script tag but NOT the rendered DOM element/link
        assert "<script>" in raw_res.html_content
        assert '<a href="/dynamic-js-link">' not in raw_res.html_content
        assert "Dynamic JS Generated Link" not in raw_res.html_content

    # 2. Render HTML using Playwright Chromium BrowserRenderer
    async with BrowserRenderer(headless=True, timeout=10.0) as renderer:
        rendered_res = await renderer.render(local_js_server)
        assert rendered_res.status_code == 200
        assert rendered_res.final_url.startswith(local_js_server)
        # Rendered Playwright DOM DOES contain the JavaScript-generated link!
        assert '<a href="/dynamic-js-link">' in rendered_res.html_content or "Dynamic JS Generated Link" in rendered_res.html_content
