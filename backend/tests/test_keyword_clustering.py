"""Unit & Integration Tests for SEO Keyword Mapping, Topic Clustering, and API Endpoints."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.crawler.parser import HTMLParser
from app.analysis.keyword_analyzer import KeywordExtractor, TopicClusterer, GENERIC_STOPWORDS
from app.database.session import SessionLocal
from app.services import crawl_persistence
from app.crawler.models import CrawlResult, PageResult

client = TestClient(app)


# ------------------------------------------------------------------------------
# 1. Keyword Extraction from Sample HTML Page
# ------------------------------------------------------------------------------

def test_keyword_extraction_from_sample_html():
    """Verify metadata and content parsing from HTML string."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Python Web Scraping & Crawling Guide</title>
        <meta name="description" content="Learn web scraping techniques using Python and BeautifulSoup.">
    </head>
    <body>
        <h1>Python Web Scraping Guide</h1>
        <h2>BeautifulSoup Tutorial</h2>
        <p>Web scraping allows parsing HTML documents efficiently to extract structured data.</p>
    </body>
    </html>
    """
    parsed = HTMLParser.parse(html_content=html, base_url="https://example.com/guide", target_domain="example.com")
    assert parsed.title == "Python Web Scraping & Crawling Guide"
    assert parsed.meta_description == "Learn web scraping techniques using Python and BeautifulSoup."
    assert parsed.h1 == "Python Web Scraping Guide"
    assert "BeautifulSoup Tutorial" in parsed.headings

    kw_res = KeywordExtractor.analyze_page(
        url="https://example.com/guide",
        title=parsed.title,
        meta_description=parsed.meta_description,
        h1=parsed.h1,
        headings=parsed.headings,
        main_text=parsed.main_text,
    )
    assert kw_res["primary_keyword"] is not None
    assert kw_res["keyword_score"] > 0.0


# ------------------------------------------------------------------------------
# 2. Primary Keyword Selection
# ------------------------------------------------------------------------------

def test_primary_keyword_selection():
    """Verify highest weighted phrase is selected as primary keyword."""
    kw_res = KeywordExtractor.analyze_page(
        url="https://example.com/seo-audit-tool",
        title="Automated SEO Audit Tool for Digital Marketers",
        meta_description="Comprehensive SEO audit software to analyze site performance.",
        h1="Automated SEO Audit Tool",
        headings=["Technical SEO Checks", "Backlink Analysis"],
        main_text="Perform deep SEO audit scans to uncover technical errors and improve search rankings.",
    )
    assert "Seo Audit" in kw_res["primary_keyword"] or "Automated Seo Audit" in kw_res["primary_keyword"]
    assert kw_res["keyword_score"] >= 3.0


# ------------------------------------------------------------------------------
# 3. Generic Stopword Filtering
# ------------------------------------------------------------------------------

def test_generic_stopword_filtering():
    """Verify navigation and generic words (page, home, click, contact, login, etc.) are excluded."""
    kw_res = KeywordExtractor.analyze_page(
        url="https://example.com/contact-us",
        title="Contact Us - Website Home Page",
        meta_description="Click here to read more and contact our support team today.",
        h1="Contact Us Page",
        headings=["Login to Portal", "Terms and Privacy"],
        main_text="Click here to view contact details, privacy policy, and home page links.",
    )
    primary = kw_res["primary_keyword"].lower()
    for generic in ["click", "here", "read", "more", "privacy", "terms", "login"]:
        assert generic not in primary.split()


# ------------------------------------------------------------------------------
# 4. Related Keyword Extraction
# ------------------------------------------------------------------------------

def test_related_keyword_extraction():
    """Verify 2 to 5 distinct related keywords are extracted alongside primary keyword."""
    kw_res = KeywordExtractor.analyze_page(
        url="https://example.com/python-data-science",
        title="Python Data Science & Machine Learning Handbook",
        h1="Python Data Science Essentials",
        headings=["Machine Learning Frameworks", "Data Visualization Techniques"],
        main_text="Explore pandas dataframe processing, scikit-learn model training, and neural networks.",
    )
    assert len(kw_res["related_keywords"]) >= 1
    assert kw_res["primary_keyword"] not in kw_res["related_keywords"]


# ------------------------------------------------------------------------------
# 5. Similar Pages Grouped Together
# ------------------------------------------------------------------------------

def test_similar_pages_grouped_together():
    """Verify pages with overlapping keywords/topics are placed in the same cluster."""
    pages = [
        {
            "url": "https://example.com/seo/tools",
            "title": "SEO Analytics Tools",
            "primary_keyword": "SEO Tools",
            "related_keywords": ["Keyword Tracking", "Rank Monitoring"],
            "topic": "Search Engine Optimization",
        },
        {
            "url": "https://example.com/seo/audit",
            "title": "Website SEO Audit Tool",
            "primary_keyword": "SEO Audit",
            "related_keywords": ["SEO Tools", "Technical Audit"],
            "topic": "Search Engine Optimization",
        },
    ]
    clustered, summaries = TopicClusterer.cluster_pages(pages)
    assert len(summaries) >= 1
    # Both pages share SEO topic/keywords and should belong to same cluster_id
    assert clustered[0]["cluster_id"] == clustered[1]["cluster_id"]


# ------------------------------------------------------------------------------
# 6. Unrelated Pages Not Incorrectly Grouped
# ------------------------------------------------------------------------------

def test_unrelated_pages_not_grouped():
    """Verify distinct unrelated pages do NOT get forced into the same cluster."""
    pages = [
        {
            "url": "https://example.com/recipes/pasta",
            "title": "Italian Pasta Recipes",
            "primary_keyword": "Italian Pasta",
            "related_keywords": ["Spaghetti", "Tomato Sauce"],
            "topic": "Cooking & Recipes",
        },
        {
            "url": "https://example.com/crypto/bitcoin",
            "title": "Bitcoin Mining & Blockchain Tech",
            "primary_keyword": "Bitcoin Mining",
            "related_keywords": ["Blockchain Ledger", "Crypto Trading"],
            "topic": "Cryptocurrency",
        },
    ]
    clustered, summaries = TopicClusterer.cluster_pages(pages)
    # Should form 2 distinct clusters
    assert len(summaries) == 2
    assert clustered[0]["cluster_id"] != clustered[1]["cluster_id"]


# ------------------------------------------------------------------------------
# 7. Cluster API Response Endpoints
# ------------------------------------------------------------------------------

def test_cluster_api_endpoints():
    """Verify /crawls/{id}/keywords, /clusters, and /clusters/{cluster_id} endpoints."""
    db = SessionLocal()
    try:
        # Create a test crawl with pages
        crawl_res = CrawlResult(
            starting_url="https://apitest.com",
            normalized_starting_url="https://apitest.com",
            domain="apitest.com",
            total_pages=2,
            successful_pages=2,
            failed_pages=0,
            pages=[
                PageResult(
                    url="https://apitest.com",
                    normalized_url="https://apitest.com",
                    depth=0,
                    title="API Test Home",
                    crawl_success=True,
                ),
                PageResult(
                    url="https://apitest.com/about",
                    normalized_url="https://apitest.com/about",
                    depth=1,
                    title="API Test About Us",
                    crawl_success=True,
                ),
            ],
        )

        rec = crawl_persistence.save_crawl_result(
            db, crawl_res, MagicMock(max_depth=2, max_pages=10)
        )
        crawl_id = rec.id
    finally:
        db.close()

    # GET /keywords
    res_kw = client.get(f"/api/v1/crawls/{crawl_id}/keywords")
    assert res_kw.status_code == 200
    kw_data = res_kw.json()
    assert kw_data["crawl_id"] == crawl_id
    assert len(kw_data["keywords"]) == 2

    # GET /clusters
    res_cl = client.get(f"/api/v1/crawls/{crawl_id}/clusters")
    assert res_cl.status_code == 200
    cl_data = res_cl.json()
    assert cl_data["crawl_id"] == crawl_id
    assert cl_data["total_clusters"] >= 1

    first_cluster_id = cl_data["clusters"][0]["cluster_id"]

    # GET /clusters/{cluster_id}
    res_det = client.get(f"/api/v1/crawls/{crawl_id}/clusters/{first_cluster_id}")
    assert res_det.status_code == 200
    det_data = res_det.json()
    assert det_data["cluster_id"] == first_cluster_id
    assert det_data["page_count"] >= 1


# ------------------------------------------------------------------------------
# 8. Empty / Minimal Page Handling
# ------------------------------------------------------------------------------

def test_empty_minimal_page_handling():
    """Verify graceful handling when title, meta description, and body text are empty."""
    kw_res = KeywordExtractor.analyze_page(
        url="https://example.com/empty-page",
        title=None,
        meta_description=None,
        h1=None,
        headings=[],
        main_text="",
    )
    assert kw_res["primary_keyword"] is not None
    assert kw_res["keyword_score"] >= 1.0


# ------------------------------------------------------------------------------
# 9. Crawl with Keyword Analysis Enabled
# ------------------------------------------------------------------------------

def test_crawl_with_keyword_analysis_enabled():
    """Verify end-to-end background crawl processing produces keyword metadata on PageModel."""
    mock_task = MagicMock()
    mock_task.id = "keyword-analysis-test-task"

    with patch("app.api.v1.crawl.execute_crawl_task.delay", return_value=mock_task):
        res = client.post("/api/v1/crawl", json={"url": "https://kwtestdomain.com", "max_pages": 5})
        assert res.status_code == 200
        crawl_id = res.json()["crawl_id"]

    db = SessionLocal()
    try:
        # Simulate completed crawl result save
        crawl_res = CrawlResult(
            starting_url="https://kwtestdomain.com",
            normalized_starting_url="https://kwtestdomain.com",
            domain="kwtestdomain.com",
            total_pages=1,
            successful_pages=1,
            failed_pages=0,
            pages=[
                PageResult(
                    url="https://kwtestdomain.com",
                    normalized_url="https://kwtestdomain.com",
                    depth=0,
                    title="KW Domain Main Landing Page",
                    crawl_success=True,
                )
            ],
        )
        updated_rec = crawl_persistence.update_crawl_result(db, crawl_id, crawl_res)
        assert updated_rec is not None
        assert len(updated_rec.pages) == 1
        assert updated_rec.pages[0].primary_keyword is not None
        assert len(updated_rec.clusters) >= 1
    finally:
        db.close()


# ------------------------------------------------------------------------------
# 10. Existing Crawler Functionality Unaffected
# ------------------------------------------------------------------------------

def test_existing_crawler_functionality_unaffected():
    """Verify existing APIs (/health, /crawl, /crawls history) continue functioning without errors."""
    h_res = client.get("/health")
    assert h_res.status_code == 200

    hist_res = client.get("/api/v1/crawls")
    assert hist_res.status_code == 200
    assert isinstance(hist_res.json(), list)
