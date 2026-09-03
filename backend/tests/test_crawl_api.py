"""API Integration Unit Tests for Crawl Router."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.crawler.models import CrawlResult, PageResult
from app.crawler.exceptions import FetchError, InvalidURLError

client = TestClient(app)


# ------------------------------------------------------------------------------
# 1. Health Endpoints Sanity Check
# ------------------------------------------------------------------------------

def test_health_endpoints_still_working():
    """Verify health check endpoints remain functional after adding crawl router."""
    res1 = client.get("/health")
    assert res1.status_code == 200
    assert res1.json()["status"] == "healthy"

    res2 = client.get("/api/v1/health")
    assert res2.status_code == 200
    assert res2.json()["status"] == "healthy"


# ------------------------------------------------------------------------------
# 2. Input Validation Tests (422 Unprocessable Entity)
# ------------------------------------------------------------------------------

def test_crawl_api_missing_url():
    """Verify empty/missing URL returns 422 validation error."""
    response = client.post("/api/v1/crawl", json={"max_depth": 2})
    assert response.status_code == 422


def test_crawl_api_unsupported_scheme():
    """Verify non-HTTP schemes (ftp://, mailto:, javascript:) return 422 validation error."""
    response = client.post("/api/v1/crawl", json={"url": "ftp://files.example.com/data"})
    assert response.status_code == 422
    assert "scheme" in response.text.lower()


def test_crawl_api_invalid_max_depth():
    """Verify max_depth out of bounds (< 0 or > 10) returns 422 validation error."""
    # max_depth < 0
    res_neg = client.post("/api/v1/crawl", json={"url": "https://example.com", "max_depth": -1})
    assert res_neg.status_code == 422

    # max_depth > 10
    res_large = client.post("/api/v1/crawl", json={"url": "https://example.com", "max_depth": 15})
    assert res_large.status_code == 422


def test_crawl_api_invalid_max_pages():
    """Verify max_pages out of bounds (< 1 or > 200) returns 422 validation error."""
    # max_pages < 1
    res_zero = client.post("/api/v1/crawl", json={"url": "https://example.com", "max_pages": 0})
    assert res_zero.status_code == 422

    # max_pages > 200
    res_huge = client.post("/api/v1/crawl", json={"url": "https://example.com", "max_pages": 500})
    assert res_huge.status_code == 422


# ------------------------------------------------------------------------------
# 3. Successful Crawl Request (200 OK)
# ------------------------------------------------------------------------------

def test_crawl_api_success_mocked():
    """Verify valid crawl request invokes crawler and returns structured CrawlResponse JSON."""
    mock_crawl_result = CrawlResult(
        starting_url="https://example.com",
        normalized_starting_url="https://example.com/",
        domain="example.com",
        total_pages=2,
        successful_pages=2,
        failed_pages=0,
        total_internal_links=3,
        total_external_links=1,
        max_depth_reached=1,
        pages=[
            PageResult(
                url="https://example.com/",
                normalized_url="https://example.com/",
                parent_url=None,
                depth=0,
                title="Example Home",
                status_code=200,
                content_type="text/html",
                internal_links=["https://example.com/about"],
                external_links=["https://external.org"],
                crawl_success=True,
                response_time=0.12,
            ),
            PageResult(
                url="https://example.com/about",
                normalized_url="https://example.com/about",
                parent_url="https://example.com/",
                depth=1,
                title="About Us",
                status_code=200,
                content_type="text/html",
                internal_links=[],
                external_links=[],
                crawl_success=True,
                response_time=0.08,
            ),
        ],
        errors=[],
        duration_seconds=0.25,
    )

    with patch("app.api.v1.crawl.WebAtlasCrawler") as MockCrawlerCls:
        mock_instance = AsyncMock()
        mock_instance.crawl.return_value = mock_crawl_result
        MockCrawlerCls.return_value = mock_instance

        payload = {
            "url": "https://example.com",
            "max_depth": 2,
            "max_pages": 10,
        }

        response = client.post("/api/v1/crawl", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["starting_url"] == "https://example.com"
        assert data["domain"] == "example.com"
        assert data["total_pages"] == 2
        assert len(data["pages"]) == 2
        assert data["pages"][0]["title"] == "Example Home"
        assert data["pages"][1]["parent_url"] == "https://example.com/"


# ------------------------------------------------------------------------------
# 4. Error Handling Tests (400 Bad Request / Clean Detail)
# ------------------------------------------------------------------------------

def test_crawl_api_fetch_error_handling():
    """Verify network or fetch errors return clean HTTP 400 error without exposing stack traces."""
    with patch("app.api.v1.crawl.WebAtlasCrawler") as MockCrawlerCls:
        mock_instance = AsyncMock()
        mock_instance.crawl.side_effect = FetchError("DNS resolution failed for target host", url="https://unreachable.test")
        MockCrawlerCls.return_value = mock_instance

        payload = {"url": "https://unreachable.test"}
        response = client.post("/api/v1/crawl", json=payload)

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "Unable to reach target website" in data["detail"]
        assert "traceback" not in response.text.lower()
