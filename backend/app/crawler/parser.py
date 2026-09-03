"""HTML Document Parser using BeautifulSoup4."""

import logging
from typing import List, Tuple, Optional
from bs4 import BeautifulSoup

from app.crawler.url_utils import (
    resolve_url,
    normalize_url,
    is_same_domain,
    is_crawlable_scheme,
    is_html_url,
)

logger = logging.getLogger(__name__)


class ParsedPageData:
    """Parsed metadata and extracted link collections."""

    def __init__(
        self,
        title: Optional[str],
        internal_links: List[str],
        external_links: List[str],
        all_links: List[Tuple[str, str]],  # List of (normalized_url, raw_href)
    ):
        self.title = title
        self.internal_links = internal_links
        self.external_links = external_links
        self.all_links = all_links


class HTMLParser:
    """BeautifulSoup4 HTML Link & Metadata Extractor."""

    @staticmethod
    def parse(html_content: str, base_url: str, target_domain: str) -> ParsedPageData:
        """Parse HTML string and extract page title alongside normalized internal/external links."""
        if not html_content:
            return ParsedPageData(title=None, internal_links=[], external_links=[], all_links=[])

        try:
            soup = BeautifulSoup(html_content, "html.parser")
        except Exception as err:
            logger.warning("Failed to parse HTML for %s: %s", base_url, err)
            return ParsedPageData(title=None, internal_links=[], external_links=[], all_links=[])

        # Extract title tag text
        title: Optional[str] = None
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
            # Truncate title if extremely long
            if len(title) > 200:
                title = title[:197] + "..."

        # Discover base URL if <base href="..."> is declared in HTML
        effective_base_url = base_url
        base_tag = soup.find("base", href=True)
        if base_tag and isinstance(base_tag.get("href"), str):
            candidate_base = base_tag.get("href").strip()
            if candidate_base:
                effective_base_url = resolve_url(base_url, candidate_base)

        internal_links_set: set[str] = set()
        external_links_set: set[str] = set()
        all_links_list: List[Tuple[str, str]] = []

        # Find all <a> tags with href attributes
        for anchor in soup.find_all("a", href=True):
            raw_href = anchor.get("href", "").strip()

            if not raw_href or raw_href.startswith("#"):
                continue

            # Resolve relative link to absolute URL
            resolved_url = resolve_url(effective_base_url, raw_href)

            if not resolved_url or not is_crawlable_scheme(resolved_url):
                continue

            normalized = normalize_url(resolved_url)

            # Categorize link
            if is_same_domain(normalized, target_domain):
                # Filter out static media assets from internal crawl queue
                if is_html_url(normalized):
                    internal_links_set.add(normalized)
            else:
                external_links_set.add(normalized)

            all_links_list.append((normalized, raw_href))

        return ParsedPageData(
            title=title,
            internal_links=sorted(list(internal_links_set)),
            external_links=sorted(list(external_links_set)),
            all_links=all_links_list,
        )
