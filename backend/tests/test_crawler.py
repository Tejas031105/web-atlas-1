"""Unit tests for WebAtlas Crawler Engine components."""

import pytest
from unittest.mock import AsyncMock, patch

from app.crawler.url_utils import (
    normalize_url,
    resolve_url,
    extract_domain,
    is_same_domain,
    is_crawlable_scheme,
    is_html_url,
)
from app.crawler.parser import HTMLParser
from app.crawler.models import CrawlConfig
from app.crawler.engine import WebAtlasCrawler
from app.crawler.fetcher import FetchResult


# ------------------------------------------------------------------------------
# 1. URL Normalization Tests
# ------------------------------------------------------------------------------

def test_url_normalization_fragments():
    """Verify URL fragment identifiers (#section) are stripped."""
    raw = "https://example.com/page#section-1"
    expected = "https://example.com/page"
    assert normalize_url(raw) == expected


def test_url_normalization_trailing_slash():
    """Verify trailing slash handling for root path vs subpaths."""
    # Root path preserves single slash
    assert normalize_url("https://example.com") == "https://example.com/"
    assert normalize_url("https://example.com/") == "https://example.com/"
    # Subpath strips trailing slash
    assert normalize_url("https://example.com/about/") == "https://example.com/about"
    assert normalize_url("https://example.com/about") == "https://example.com/about"


def test_url_normalization_case_sensitivity():
    """Verify scheme and netloc are lowercased."""
    raw = "HTTP://EXAMPLE.COM/About/Page"
    expected = "http://example.com/About/Page"
    assert normalize_url(raw) == expected


def test_url_normalization_default_ports():
    """Verify default HTTP/HTTPS port numbers are stripped."""
    assert normalize_url("http://example.com:80/path") == "http://example.com/path"
    assert normalize_url("https://example.com:443/path") == "https://example.com/path"
    # Custom non-default ports should be preserved
    assert normalize_url("http://example.com:8080/path") == "http://example.com:8080/path"


def test_url_normalization_sorted_query_params():
    """Verify query parameters are sorted deterministically."""
    url1 = "https://example.com/search?b=2&a=1"
    url2 = "https://example.com/search?a=1&b=2"
    assert normalize_url(url1) == normalize_url(url2)


# ------------------------------------------------------------------------------
# 2. Relative URL Resolution Tests
# ------------------------------------------------------------------------------

def test_resolve_relative_urls():
    """Verify resolving relative links against base URLs."""
    base = "https://example.com/products/index.html"
    assert resolve_url(base, "/about") == "https://example.com/about"
    assert resolve_url(base, "item1") == "https://example.com/products/item1"
    assert resolve_url(base, "../contact") == "https://example.com/contact"
    assert resolve_url(base, "//cdn.example.com/assets") == "https://cdn.example.com/assets"


# ------------------------------------------------------------------------------
# 3. Domain Detection Tests
# ------------------------------------------------------------------------------

def test_domain_extraction():
    """Verify clean domain extraction."""
    assert extract_domain("https://example.com/about") == "example.com"
    assert extract_domain("https://www.example.com/about") == "example.com"
    assert extract_domain("http://sub.example.com:8000/page") == "sub.example.com"


def test_is_same_domain():
    """Verify internal vs external domain classification."""
    target = "example.com"
    assert is_same_domain("https://example.com/about", target) is True
    assert is_same_domain("https://www.example.com/contact", target) is True
    assert is_same_domain("https://blog.example.com/post", target) is True
    assert is_same_domain("https://google.com", target) is False
    assert is_same_domain("https://example.org", target) is False


# ------------------------------------------------------------------------------
# 4. Scheme Validation & Non-HTML Asset Filtering Tests
# ------------------------------------------------------------------------------

def test_unsupported_schemes():
    """Verify non-HTTP schemes are rejected."""
    assert is_crawlable_scheme("https://example.com") is True
    assert is_crawlable_scheme("http://example.com") is True
    assert is_crawlable_scheme("javascript:void(0)") is False
    assert is_crawlable_scheme("mailto:user@example.com") is False
    assert is_crawlable_scheme("tel:+1234567890") is False
    assert is_crawlable_scheme("data:image/png;base64,123") is False


def test_non_html_file_filtering():
    """Verify static assets (.pdf, .png, .zip) are excluded from crawl target status."""
    assert is_html_url("https://example.com/about") is True
    assert is_html_url("https://example.com/page.html") is True
    assert is_html_url("https://example.com/document.pdf") is False
    assert is_html_url("https://example.com/logo.png") is False
    assert is_html_url("https://example.com/styles.css") is False
    assert is_html_url("https://example.com/bundle.js") is False
    assert is_html_url("https://example.com/archive.zip") is False


# ------------------------------------------------------------------------------
# 5. HTML Parser Link & Title Extraction Tests
# ------------------------------------------------------------------------------

def test_html_parser_title_and_links():
    """Verify BeautifulSoup parser extracts page title and categorizes links."""
    sample_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title> Example Test Page </title>
    </head>
    <body>
        <h1>Welcome</h1>
        <a href="/about">About Us</a>
        <a href="https://example.com/products">Products</a>
        <a href="https://external.com/docs">External Docs</a>
        <a href="mailto:info@example.com">Email Us</a>
        <a href="javascript:alert(1)">Click Me</a>
        <a href="/image.png">Logo</a>
    </body>
    </html>
    """
    base_url = "https://example.com/"
    target_domain = "example.com"

    parsed = HTMLParser.parse(sample_html, base_url, target_domain)

    assert parsed.title == "Example Test Page"
    assert "https://example.com/about" in parsed.internal_links
    assert "https://example.com/products" in parsed.internal_links
    # Non-HTML image should be excluded from internal crawl queue
    assert "https://example.com/image.png" not in parsed.internal_links
    # Mailto & Javascript should be excluded
    assert not any("mailto" in l for l in parsed.internal_links)
    assert not any("javascript" in l for l in parsed.internal_links)
    # External link recorded separately
    assert "https://external.com/docs" in parsed.external_links


# ------------------------------------------------------------------------------
# 6. Crawler Engine Limits & Duplicate Prevention Tests (Async)
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crawler_max_pages_limit():
    """Verify crawler respects max_pages limit."""
    config = CrawlConfig(max_pages=2, max_depth=5, delay=0.0, respect_robots_txt=False)
    crawler = WebAtlasCrawler(config)

    # Mock fetcher responses with a loop of internal links
    mock_html = """
    <html><head><title>Page</title></head>
    <body>
        <a href="/p1">Page 1</a>
        <a href="/p2">Page 2</a>
        <a href="/p3">Page 3</a>
    </body></html>
    """

    async def mock_fetch(url):
        return FetchResult(
            url=url,
            final_url=url,
            status_code=200,
            content_type="text/html",
            html_content=mock_html,
            response_time=0.01,
            is_html=True,
        )

    with patch("app.crawler.engine.AsyncFetcher") as mock_fetcher_cls:
        mock_instance = AsyncMock()
        mock_instance.fetch.side_effect = mock_fetch
        mock_fetcher_cls.return_value.__aenter__.return_value = mock_instance

        result = await crawler.crawl("https://example.com")

        assert result.total_pages == 2
        assert len(result.pages) == 2


@pytest.mark.asyncio
async def test_crawler_max_depth_limit():
    """Verify crawler respects max_depth limit."""
    config = CrawlConfig(max_pages=100, max_depth=1, delay=0.0, respect_robots_txt=False)
    crawler = WebAtlasCrawler(config)

    # Page 0 links to Page 1, Page 1 links to Page 2
    async def mock_fetch(url):
        if url == "https://example.com/":
            html = '<html><body><a href="/page1">Page 1</a></body></html>'
        elif url == "https://example.com/page1":
            html = '<html><body><a href="/page2">Page 2</a></body></html>'
        else:
            html = '<html><body>Deep Page</body></html>'

        return FetchResult(
            url=url,
            final_url=url,
            status_code=200,
            content_type="text/html",
            html_content=html,
            response_time=0.01,
            is_html=True,
        )

    with patch("app.crawler.engine.AsyncFetcher") as mock_fetcher_cls:
        mock_instance = AsyncMock()
        mock_instance.fetch.side_effect = mock_fetch
        mock_fetcher_cls.return_value.__aenter__.return_value = mock_instance

        result = await crawler.crawl("https://example.com")

        # Depth 0 (https://example.com/) and Depth 1 (https://example.com/page1) should be fetched.
        # Depth 2 (https://example.com/page2) should NOT be enqueued/crawled.
        urls_crawled = [p.url for p in result.pages]
        assert "https://example.com/" in urls_crawled
        assert "https://example.com/page1" in urls_crawled
        assert "https://example.com/page2" not in urls_crawled
        assert result.max_depth_reached == 1


@pytest.mark.asyncio
async def test_crawler_duplicate_url_prevention():
    """Verify duplicate URLs and fragment aliases are crawled only once."""
    config = CrawlConfig(max_pages=50, max_depth=3, delay=0.0, respect_robots_txt=False)
    crawler = WebAtlasCrawler(config)

    # HTML with duplicate variations pointing to the same about page
    html = """
    <html><body>
        <a href="/about">About</a>
        <a href="/about/">About Slash</a>
        <a href="/about#team">About Team</a>
        <a href="/about#contact">About Contact</a>
    </body></html>
    """

    async def mock_fetch(url):
        return FetchResult(
            url=url,
            final_url=url,
            status_code=200,
            content_type="text/html",
            html_content=html,
            response_time=0.01,
            is_html=True,
        )

    with patch("app.crawler.engine.AsyncFetcher") as mock_fetcher_cls:
        mock_instance = AsyncMock()
        mock_instance.fetch.side_effect = mock_fetch
        mock_fetcher_cls.return_value.__aenter__.return_value = mock_instance

        result = await crawler.crawl("https://example.com")

        # Root page + 1 about page = 2 unique pages crawled
        crawled_urls = [p.url for p in result.pages]
        assert len(crawled_urls) == 2
        assert "https://example.com/" in crawled_urls
        assert "https://example.com/about" in crawled_urls
