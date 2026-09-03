"""URL Normalization, Domain Validation, and Link Resolution Utilities."""

import os
from urllib.parse import urlparse, urlunparse, urljoin, parse_qsl, urlencode

# Static non-HTML media/asset extensions to filter out from crawling
NON_HTML_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp", ".tiff",
    ".css", ".js", ".mjs", ".jsx", ".tsx", ".json", ".xml", ".rss", ".atom",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".tar",
    ".gz", ".rar", ".7z", ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv",
    ".wav", ".ogg", ".webm", ".woff", ".woff2", ".ttf", ".eot", ".otf"
}


def normalize_url(url: str) -> str:
    """Normalize URL consistently to prevent duplicate crawling.

    Operations:
    - Strips fragment identifiers (#section).
    - Lowercases scheme and netloc.
    - Strips default port numbers (:80 for HTTP, :443 for HTTPS).
    - Normalizes empty path to '/' and strips trailing slashes from subpaths.
    - Sorts query parameters predictably.
    """
    if not url:
        return ""

    # Trim whitespace
    url = url.strip()

    try:
        parsed = urlparse(url)
    except Exception:
        return url

    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Remove default port specifications
    if ":" in netloc:
        host, port = netloc.split(":", 1)
        if (scheme == "http" and port == "80") or (scheme == "https" and port == "443"):
            netloc = host

    path = parsed.path

    # Normalize trailing slash:
    # Root path '/' is preserved as '/'.
    # Subpath like '/about/' -> '/about' for duplicate prevention.
    if path == "" or path == "/":
        path = "/"
    elif path.endswith("/"):
        path = path.rstrip("/")

    # Sort query parameters deterministically if present
    query = ""
    if parsed.query:
        query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
        sorted_pairs = sorted(query_pairs)
        query = urlencode(sorted_pairs)

    # Reconstruct normalized URL (fragment is deliberately excluded)
    normalized = urlunparse((scheme, netloc, path, parsed.params, query, ""))
    return normalized


def resolve_url(base_url: str, link: str) -> str:
    """Resolve a relative link against a base page URL into an absolute URL."""
    if not link:
        return ""

    link = link.strip()
    # Handle protocol-relative URLs (e.g. //example.com/page)
    if link.startswith("//"):
        base_parsed = urlparse(base_url)
        scheme = base_parsed.scheme if base_parsed.scheme else "https"
        link = f"{scheme}:{link}"

    joined = urljoin(base_url, link)
    return normalize_url(joined)


def extract_domain(url: str) -> str:
    """Extract clean domain from URL, stripping www. prefix for consistent comparison."""
    if not url:
        return ""

    try:
        parsed = urlparse(url)
        netloc = parsed.netloc.lower()
        if ":" in netloc:
            netloc = netloc.split(":", 1)[0]
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc
    except Exception:
        return ""


def is_same_domain(url: str, target_domain: str) -> bool:
    """Check if the URL belongs to the target domain (or subdomain)."""
    url_domain = extract_domain(url)
    target_clean = extract_domain(target_domain) if "://" in target_domain else target_domain.lower()

    if target_clean.startswith("www."):
        target_clean = target_clean[4:]

    if not url_domain or not target_clean:
        return False

    return url_domain == target_clean or url_domain.endswith(f".{target_clean}")


def is_crawlable_scheme(url: str) -> bool:
    """Return True if URL uses an HTTP or HTTPS scheme."""
    if not url:
        return False

    url_lower = url.strip().lower()
    if url_lower.startswith(("javascript:", "mailto:", "tel:", "data:", "ftp:", "file:", "chrome:", "about:")):
        return False

    try:
        parsed = urlparse(url)
        return parsed.scheme.lower() in ("http", "https")
    except Exception:
        return False


def is_html_url(url: str) -> bool:
    """Check if the URL path points to an HTML page rather than a static asset or document."""
    if not is_crawlable_scheme(url):
        return False

    try:
        parsed = urlparse(url)
        path = parsed.path.lower()
        if not path or path == "/":
            return True

        _, ext = os.path.splitext(path)
        if ext in NON_HTML_EXTENSIONS:
            return False

        return True
    except Exception:
        return True
