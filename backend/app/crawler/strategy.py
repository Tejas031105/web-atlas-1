"""Rendering Strategy and Dynamic Content Detection for WebAtlas Crawler."""

import re
import logging
from enum import Enum
from typing import Optional

logger = logging.getLogger("webatlas.crawler.strategy")


class RenderMode(str, Enum):
    """Supported website rendering modes."""
    AUTO = "auto"
    HTTPX = "httpx"
    PLAYWRIGHT = "playwright"


# Common Single Page Application (SPA) mounting root selectors / HTML signatures
SPA_ROOT_PATTERNS = [
    re.compile(r'<div\s+id=["\'](?:root|app|__next|__nuxt|main-app)["\']\s*>\s*</div>', re.IGNORECASE),
    re.compile(r'<app-root(?:\s+[^>]*)?>\s*</app-root>', re.IGNORECASE),
    re.compile(r'<div\s+class=["\'](?:react-root|vue-app|angular-container)["\']\s*>\s*</div>', re.IGNORECASE),
]

SCRIPT_TAG_PATTERN = re.compile(r'<script\b[^>]*>', re.IGNORECASE)
LINK_TAG_PATTERN = re.compile(r'<a\b[^>]*href=["\'][^"\']+["\']', re.IGNORECASE)


class DynamicContentDetector:
    """Detects whether raw HTTP HTML response represents an unrendered JavaScript app shell."""

    @staticmethod
    def is_js_shell(html_content: str, internal_links_count: int = 0) -> bool:
        """Conservatively determine if the HTML content requires Playwright JavaScript execution.
        
        Rules:
        - If internal_links_count > 3, the page already contains substantial static HTML links -> NOT a shell.
        - Must contain <script> tags.
        - Must either match an empty SPA root container (e.g. <div id="root"></div>) OR have very little raw text with zero href links.
        """
        if not html_content or not html_content.strip():
            return True

        # If we already extracted multiple internal links, page is already rendered/static enough
        if internal_links_count > 3:
            return False

        # Fast check: must contain script tags
        if not SCRIPT_TAG_PATTERN.search(html_content):
            return False

        # 1. Check for empty SPA mounting elements
        for pattern in SPA_ROOT_PATTERNS:
            if pattern.search(html_content):
                logger.info("Dynamic JS shell detected: empty SPA root element matching pattern %s", pattern.pattern)
                return True

        # 2. Check for script-heavy minimal HTML with zero href links
        has_hrefs = bool(LINK_TAG_PATTERN.search(html_content))
        html_len = len(html_content.strip())

        if not has_hrefs and html_len < 600:
            logger.info("Dynamic JS shell detected: script-heavy minimal HTML (length %d bytes, 0 href links)", html_len)
            return True

        return False


def should_use_playwright(
    render_mode: str,
    html_content: Optional[str] = None,
    internal_links_count: int = 0,
) -> bool:
    """Determine whether Playwright browser rendering should be executed based on render_mode and HTML content."""
    normalized_mode = str(render_mode).lower().strip()

    if normalized_mode == RenderMode.PLAYWRIGHT.value:
        return True

    if normalized_mode == RenderMode.HTTPX.value:
        return False

    # Default / AUTO mode: fallback to Playwright only if raw HTML is identified as a JS application shell
    if html_content is not None:
        return DynamicContentDetector.is_js_shell(html_content, internal_links_count)

    return False
