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
    """Parsed metadata, content elements, and extracted link collections."""

    def __init__(
        self,
        title: Optional[str],
        internal_links: List[str],
        external_links: List[str],
        all_links: List[Tuple[str, str]],  # List of (normalized_url, raw_href)
        meta_description: Optional[str] = None,
        h1: Optional[str] = None,
        headings: Optional[List[str]] = None,
        main_text: Optional[str] = None,
        anchor_texts: Optional[List[Tuple[str, str]]] = None,  # List of (normalized_target_url, anchor_text)
    ):
        self.title = title
        self.internal_links = internal_links
        self.external_links = external_links
        self.all_links = all_links
        self.meta_description = meta_description
        self.h1 = h1
        self.headings = headings or []
        self.main_text = main_text
        self.anchor_texts = anchor_texts or []


class HTMLParser:
    """BeautifulSoup4 HTML Link & Metadata Extractor."""

    @staticmethod
    def parse(html_content: str, base_url: str, target_domain: str) -> ParsedPageData:
        """Parse HTML string and extract page title, metadata, headings, main text, and links."""
        if not html_content:
            return ParsedPageData(
                title=None,
                internal_links=[],
                external_links=[],
                all_links=[],
                meta_description=None,
                h1=None,
                headings=[],
                main_text=None,
                anchor_texts=[],
            )

        try:
            soup = BeautifulSoup(html_content, "html.parser")
        except Exception as err:
            logger.warning("Failed to parse HTML for %s: %s", base_url, err)
            return ParsedPageData(
                title=None,
                internal_links=[],
                external_links=[],
                all_links=[],
                meta_description=None,
                h1=None,
                headings=[],
                main_text=None,
                anchor_texts=[],
            )

        # Extract title tag text
        title: Optional[str] = None
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
            if len(title) > 200:
                title = title[:197] + "..."

        # Extract meta description
        meta_description: Optional[str] = None
        meta_tag = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "description"})
        if not meta_tag:
            meta_tag = soup.find("meta", attrs={"property": lambda x: x and x.lower() == "og:description"})
        if meta_tag and meta_tag.get("content"):
            desc_val = meta_tag.get("content", "").strip()
            if desc_val:
                meta_description = desc_val[:500]

        # Extract H1 tag text
        h1: Optional[str] = None
        h1_tag = soup.find("h1")
        if h1_tag:
            h1_text = h1_tag.get_text(separator=" ", strip=True)
            if h1_text:
                h1 = h1_text[:255]

        # Extract H2 and H3 headings
        headings: List[str] = []
        for h in soup.find_all(["h2", "h3"]):
            h_text = h.get_text(separator=" ", strip=True)
            if h_text and len(h_text) > 2:
                headings.append(h_text[:200])
        headings = headings[:20]  # Cap at 20 headings

        # Extract visible main text (excluding scripts, styles, header, footer, nav)
        soup_copy = BeautifulSoup(html_content, "html.parser")
        for element in soup_copy(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
            element.decompose()
        main_text_raw = soup_copy.get_text(separator=" ", strip=True)
        main_text: Optional[str] = main_text_raw[:3000] if main_text_raw else None

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
        anchor_texts_list: List[Tuple[str, str]] = []

        # Find all <a> tags with href attributes
        for anchor in soup.find_all("a", href=True):
            raw_href = anchor.get("href", "").strip()
            anchor_text = anchor.get_text(separator=" ", strip=True)

            if not raw_href or raw_href.startswith("#"):
                continue

            # Resolve relative link to absolute URL
            resolved_url = resolve_url(effective_base_url, raw_href)

            if not resolved_url or not is_crawlable_scheme(resolved_url):
                continue

            normalized = normalize_url(resolved_url)

            # Categorize link
            if is_same_domain(normalized, target_domain):
                if is_html_url(normalized):
                    internal_links_set.add(normalized)
            else:
                external_links_set.add(normalized)

            all_links_list.append((normalized, raw_href))
            if anchor_text and len(anchor_text) > 1:
                anchor_texts_list.append((normalized, anchor_text[:150]))

        return ParsedPageData(
            title=title,
            internal_links=sorted(list(internal_links_set)),
            external_links=sorted(list(external_links_set)),
            all_links=all_links_list,
            meta_description=meta_description,
            h1=h1,
            headings=headings,
            main_text=main_text,
            anchor_texts=anchor_texts_list,
        )

