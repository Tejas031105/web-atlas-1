"""API Integration Unit Tests for Crawl Router, Status Tracking, and Progress Calculation."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.services.crawl_persistence import update_crawl_progress, update_crawl_running_status

client = TestClient(app)


# ------------------------------------------------------------------------------
# 1. Health Endpoints Sanity Check
# ------------------------------------------------------------------------------

def test_health_endpoints_still_working():
    """Verify health check endpoints remain functional."""
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
    res_neg = client.post("/api/v1/crawl", json={"url": "https://example.com", "max_depth": -1})
    assert res_neg.status_code == 422

    res_large = client.post("/api/v1/crawl", json={"url": "https://example.com", "max_depth": 15})
    assert res_large.status_code == 422


def test_crawl_api_invalid_max_pages():
    """Verify max_pages out of bounds (< 1 or > 200) returns 422 validation error."""
    res_zero = client.post("/api/v1/crawl", json={"url": "https://example.com", "max_pages": 0})
    assert res_zero.status_code == 422

    res_huge = client.post("/api/v1/crawl", json={"url": "https://example.com", "max_pages": 500})
    assert res_huge.status_code == 422


# ------------------------------------------------------------------------------
# 3. Successful Asynchronous Crawl Request (200 OK - Immediate Return)
# ------------------------------------------------------------------------------

def test_crawl_api_queues_celery_task_and_returns_immediately():
    """Verify valid crawl request creates DB record, queues Celery task, and returns QUEUED status immediately."""
    mock_task = MagicMock()
    mock_task.id = "test-task-uuid-12345"

    with patch("app.api.v1.crawl.execute_crawl_task.delay", return_value=mock_task) as mock_delay:
        payload = {
            "url": "https://example.com",
            "max_depth": 2,
            "max_pages": 50,
        }

        response = client.post("/api/v1/crawl", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["starting_url"] == "https://example.com"
        assert data["domain"] == "example.com"
        assert data["status"] == "QUEUED"
        assert data["task_id"] == "test-task-uuid-12345"
        assert data["crawl_id"] is not None

        mock_delay.assert_called_once()
        _, kwargs = mock_delay.call_args
        assert kwargs["crawl_id"] == data["crawl_id"]
        assert kwargs["starting_url"] == "https://example.com"
        assert kwargs["max_depth"] == 2
        assert kwargs["max_pages"] == 50


# ------------------------------------------------------------------------------
# 4. Status & Progress Tracking Endpoint Tests (GET /api/v1/crawl/{crawl_id}/status)
# ------------------------------------------------------------------------------

def test_get_crawl_status_progress_metrics_and_percentage():
    """Verify status endpoint returns pages_discovered, pages_crawled, pages_failed, and calculated progress_percent."""
    mock_task = MagicMock()
    mock_task.id = "progress-status-task-id"

    with patch("app.api.v1.crawl.execute_crawl_task.delay", return_value=mock_task):
        init_res = client.post("/api/v1/crawl", json={"url": "https://progresscheck.com", "max_pages": 40})
        assert init_res.status_code == 200
        crawl_id = init_res.json()["crawl_id"]

    db = SessionLocal()
    try:
        update_crawl_running_status(db, crawl_id)
        update_crawl_progress(
            db,
            crawl_id=crawl_id,
            pages_discovered=30,
            pages_crawled=20,
            pages_failed=2,
            current_depth=1,
            max_depth_reached=1,
        )
    finally:
        db.close()

    status_res = client.get(f"/api/v1/crawl/{crawl_id}/status")
    assert status_res.status_code == 200

    data = status_res.json()
    assert data["crawl_id"] == crawl_id
    assert data["status"] == "RUNNING"
    assert data["pages_discovered"] == 30
    assert data["pages_crawled"] == 20
    assert data["pages_failed"] == 2
    assert data["successful_pages"] == 18
    assert data["current_depth"] == 1
    assert data["max_pages"] == 40
    # progress_percent = 20 / 40 * 100 = 50.0%
    assert data["progress_percent"] == 50.0
    assert data["started_at"] is not None


def test_get_crawl_status_not_found():
    """Verify 404 response for non-existent crawl status check."""
    response = client.get("/api/v1/crawl/999999/status")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
