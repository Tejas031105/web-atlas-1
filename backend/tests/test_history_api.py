"""Unit tests for SQLite Database Persistence and History API."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.session import Base, get_db
from app.crawler.models import CrawlResult, PageResult
from app.models.crawl import CrawlModel, PageModel


# Create an in-memory SQLite database engine for testing using StaticPool
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


def test_db_persistence_and_crawl_id(client):
    """Verify executing crawl saves record to DB and returns crawl_id."""
    mock_result = CrawlResult(
        starting_url="https://dbtest.com",
        normalized_starting_url="https://dbtest.com/",
        domain="dbtest.com",
        total_pages=1,
        successful_pages=1,
        failed_pages=0,
        total_internal_links=0,
        total_external_links=0,
        max_depth_reached=0,
        pages=[
            PageResult(
                url="https://dbtest.com/",
                normalized_url="https://dbtest.com/",
                parent_url=None,
                depth=0,
                title="DB Test Page",
                status_code=200,
                content_type="text/html",
                internal_links=[],
                external_links=[],
                crawl_success=True,
                response_time=0.05,
            )
        ],
        errors=[],
        duration_seconds=0.1,
    )

    with patch("app.api.v1.crawl.WebAtlasCrawler") as MockCrawlerCls:
        mock_instance = AsyncMock()
        mock_instance.crawl.return_value = mock_result
        MockCrawlerCls.return_value = mock_instance

        res = client.post("/api/v1/crawl", json={"url": "https://dbtest.com"})
        assert res.status_code == 200
        data = res.json()
        assert "crawl_id" in data
        assert data["crawl_id"] is not None
        crawl_id = data["crawl_id"]

        # Verify DB query
        db = TestingSessionLocal()
        record = db.query(CrawlModel).filter(CrawlModel.id == crawl_id).first()
        assert record is not None
        assert record.domain == "dbtest.com"
        assert len(record.pages) == 1
        assert record.pages[0].title == "DB Test Page"
        db.close()


def test_get_crawl_history_newest_first(client):
    """Verify GET /api/v1/crawls returns list ordered newest first."""
    db = TestingSessionLocal()
    c1 = CrawlModel(
        starting_url="https://site1.com",
        normalized_starting_url="https://site1.com/",
        domain="site1.com",
        total_pages=1,
    )
    c2 = CrawlModel(
        starting_url="https://site2.com",
        normalized_starting_url="https://site2.com/",
        domain="site2.com",
        total_pages=2,
    )
    db.add(c1)
    db.add(c2)
    db.commit()
    db.close()

    res = client.get("/api/v1/crawls")
    assert res.status_code == 200
    history = res.json()
    assert len(history) == 2
    # Newest first: site2.com then site1.com
    assert history[0]["domain"] == "site2.com"
    assert history[1]["domain"] == "site1.com"


def test_get_crawl_by_id_success_and_404(client):
    """Verify GET /api/v1/crawls/{id} restores crawl and 404 handling."""
    db = TestingSessionLocal()
    c = CrawlModel(
        starting_url="https://restore.test",
        normalized_starting_url="https://restore.test/",
        domain="restore.test",
        total_pages=1,
        duration_seconds=0.5,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    p = PageModel(
        crawl_id=c.id,
        url="https://restore.test/",
        normalized_url="https://restore.test/",
        depth=0,
        title="Restore Test",
        status_code=200,
        crawl_success=True,
    )
    db.add(p)
    db.commit()
    crawl_id = c.id
    db.close()

    # Success case
    res = client.get(f"/api/v1/crawls/{crawl_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["crawl_id"] == crawl_id
    assert data["domain"] == "restore.test"
    assert len(data["pages"]) == 1
    assert data["pages"][0]["title"] == "Restore Test"

    # 404 Not Found case
    res_404 = client.get("/api/v1/crawls/99999")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()


def test_delete_crawl_by_id_and_cascading(client):
    """Verify DELETE /api/v1/crawls/{id} removes crawl and cascaded pages."""
    db = TestingSessionLocal()
    c = CrawlModel(
        starting_url="https://delete.test",
        normalized_starting_url="https://delete.test/",
        domain="delete.test",
        total_pages=1,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    p = PageModel(
        crawl_id=c.id,
        url="https://delete.test/",
        normalized_url="https://delete.test/",
        depth=0,
    )
    db.add(p)
    db.commit()
    crawl_id = c.id
    db.close()

    # Execute DELETE
    res = client.delete(f"/api/v1/crawls/{crawl_id}")
    assert res.status_code == 200
    assert res.json()["crawl_id"] == crawl_id

    # Verify DB no longer contains crawl or page
    db = TestingSessionLocal()
    assert db.query(CrawlModel).filter(CrawlModel.id == crawl_id).first() is None
    assert db.query(PageModel).filter(PageModel.crawl_id == crawl_id).first() is None
    db.close()

    # Delete 404 case
    res_404 = client.delete("/api/v1/crawls/99999")
    assert res_404.status_code == 404
