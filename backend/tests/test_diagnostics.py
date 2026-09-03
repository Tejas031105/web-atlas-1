"""Unit tests for Website Health & Crawl Diagnostics analysis layer."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.session import Base, get_db
from app.models.crawl import CrawlModel, PageModel
from app.services.crawl_persistence import get_crawl_by_id
from app.analysis import CrawlAnalyzer, calculate_health_score


# Create in-memory SQLite test engine using StaticPool
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """Fixture providing clean database tables and TestClient per test."""
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def test_health_score_calculation_and_boundaries():
    """Test health score formula and clamp bounds."""
    # Perfect score case
    score, status, breakdown = calculate_health_score(
        failed_pages=0, missing_titles=0, duplicate_title_groups=0, potential_orphans=0, crawl_errors_count=0
    )
    assert score == 100
    assert status == "Excellent"
    assert len(breakdown) == 0

    # Deductions case
    score, status, breakdown = calculate_health_score(
        failed_pages=1, missing_titles=2, duplicate_title_groups=1, potential_orphans=1, crawl_errors_count=1
    )
    assert score == 78
    assert status == "Good"
    assert len(breakdown) == 5

    # Maximum clamp bounds test (max total deductions = 85 pts -> min base score = 15)
    score_zero, status_zero, _ = calculate_health_score(
        failed_pages=10, missing_titles=10, duplicate_title_groups=10, potential_orphans=10, crawl_errors_count=10
    )
    assert score_zero == 15
    assert status_zero == "Poor"


def test_analyzer_healthy_single_page(client):
    """Test diagnostics analysis for a 100% healthy single page website."""
    db = TestingSessionLocal()
    c = CrawlModel(
        starting_url="https://healthy.com",
        normalized_starting_url="https://healthy.com/",
        domain="healthy.com",
        total_pages=1,
        successful_pages=1,
        failed_pages=0,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    p = PageModel(
        crawl_id=c.id,
        url="https://healthy.com/",
        normalized_url="https://healthy.com/",
        depth=0,
        title="Healthy Home",
        status_code=200,
        crawl_success=True,
        internal_links_json='[]',
        external_links_json='["https://iana.org"]',
    )
    db.add(p)
    db.commit()

    crawl_record = get_crawl_by_id(db, c.id)
    assert crawl_record is not None

    report = CrawlAnalyzer.analyze_model(crawl_record)
    assert report.health_score == 100
    assert report.health_status == "Excellent"
    assert report.status_distribution.count_2xx == 1
    assert report.title_statistics.total_with_title == 1
    assert report.title_statistics.missing_title_count == 0
    assert report.link_statistics.total_external_links == 1
    assert report.link_statistics.unverified_external == 1
    db.close()


def test_analyzer_broken_links_and_orphans(client):
    """Test analyzer detection of 404 pages, missing titles, duplicates, and orphans."""
    db = TestingSessionLocal()
    c = CrawlModel(
        starting_url="https://site.com",
        normalized_starting_url="https://site.com/",
        domain="site.com",
        total_pages=3,
        successful_pages=2,
        failed_pages=1,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    # Page 1: Root (references page 2)
    p1 = PageModel(
        crawl_id=c.id,
        url="https://site.com/",
        normalized_url="https://site.com/",
        depth=0,
        title="Home Page",
        status_code=200,
        crawl_success=True,
        internal_links_json='["https://site.com/about"]',
    )
    # Page 2: About (healthy, duplicate title "Home Page")
    p2 = PageModel(
        crawl_id=c.id,
        url="https://site.com/about",
        normalized_url="https://site.com/about",
        depth=1,
        title="Home Page",  # Duplicate title
        status_code=200,
        crawl_success=True,
    )
    # Page 3: Broken & Orphan (404, missing title, not referenced by p1 or p2)
    p3 = PageModel(
        crawl_id=c.id,
        url="https://site.com/broken",
        normalized_url="https://site.com/broken",
        depth=1,
        title=None,  # Missing title
        status_code=404,
        crawl_success=True,
        error_message="HTTP 404 Not Found",
    )

    db.add_all([p1, p2, p3])
    db.commit()

    crawl_record = get_crawl_by_id(db, c.id)
    assert crawl_record is not None

    report = CrawlAnalyzer.analyze_model(crawl_record)
    assert report.status_distribution.count_2xx == 2
    assert report.status_distribution.count_4xx == 1
    assert report.title_statistics.missing_title_count == 1
    assert report.title_statistics.duplicate_title_count == 2  # p1 and p2
    assert report.potential_orphans_count == 1
    assert "https://site.com/broken" in report.potential_orphan_urls
    assert report.health_score < 100
    db.close()


def test_diagnostics_endpoint_success_and_404(client):
    """Test GET /api/v1/crawls/{id}/diagnostics endpoint."""
    db = TestingSessionLocal()
    c = CrawlModel(
        starting_url="https://api.test",
        normalized_starting_url="https://api.test/",
        domain="api.test",
        total_pages=1,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    p = PageModel(
        crawl_id=c.id,
        url="https://api.test/",
        normalized_url="https://api.test/",
        depth=0,
        title="API Test",
        status_code=200,
        crawl_success=True,
    )
    db.add(p)
    db.commit()
    crawl_id = c.id
    db.close()

    # Success case
    res = client.get(f"/api/v1/crawls/{crawl_id}/diagnostics")
    assert res.status_code == 200
    data = res.json()
    assert data["crawl_id"] == crawl_id
    assert data["domain"] == "api.test"
    assert data["health_score"] == 100
    assert "status_distribution" in data
    assert "link_statistics" in data

    # 404 Not Found case
    res_404 = client.get("/api/v1/crawls/99999/diagnostics")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()
