"""Tests for Celery application configuration, progress tracking, and Celery crawl tasks."""

import pytest
from unittest.mock import AsyncMock, patch

from app.core.config import settings
from app.tasks.celery_app import celery_app, add
from app.tasks.crawl_tasks import execute_crawl_task
from app.crawler.models import CrawlResult, PageResult
from app.database.session import SessionLocal
from app.services.crawl_persistence import (
    create_initial_crawl,
    get_crawl_by_id,
    update_crawl_progress,
)


def test_celery_app_configuration():
    """Verify that the Celery app is correctly initialized and configured."""
    assert celery_app.main == "webatlas"
    assert celery_app.conf.broker_url == settings.CELERY_BROKER_URL
    assert celery_app.conf.result_backend == settings.CELERY_RESULT_BACKEND
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.result_serializer == "json"


def test_celery_add_task_direct_execution():
    """Verify that the test Celery task 'add' can be imported and executed directly."""
    assert add.name == "app.tasks.celery_app.add"
    assert add(2, 3) == 5
    assert add(100, -25) == 75


def test_celery_add_task_eager_execution():
    """Verify Celery task execution with task_always_eager set to True (in-memory test mode)."""
    celery_app.conf.task_always_eager = True
    try:
        result = add.delay(4, 6)
        assert result.result == 10
        assert result.successful() is True
    finally:
        celery_app.conf.task_always_eager = False


def test_execute_crawl_task_import_and_registration():
    """Verify execute_crawl_task is properly imported and registered."""
    assert execute_crawl_task.name == "app.tasks.crawl_tasks.execute_crawl_task"
    assert "app.tasks.crawl_tasks.execute_crawl_task" in celery_app.tasks


def test_execute_crawl_task_successful_execution_and_timestamps():
    """Verify execute_crawl_task sets started_at/completed_at and updates status to COMPLETED."""
    db = SessionLocal()
    try:
        crawl_record = create_initial_crawl(
            db,
            starting_url="https://testsite.org",
            normalized_starting_url="https://testsite.org/",
            domain="testsite.org",
            max_depth=2,
            max_pages=50,
        )
        crawl_id = crawl_record.id
        assert crawl_record.status == "QUEUED"
        assert crawl_record.started_at is None
        assert crawl_record.completed_at is None
    finally:
        db.close()

    mock_result = CrawlResult(
        starting_url="https://testsite.org",
        normalized_starting_url="https://testsite.org/",
        domain="testsite.org",
        total_pages=1,
        successful_pages=1,
        failed_pages=0,
        total_internal_links=0,
        total_external_links=0,
        max_depth_reached=0,
        pages=[
            PageResult(
                url="https://testsite.org/",
                normalized_url="https://testsite.org/",
                parent_url=None,
                depth=0,
                title="Test Site",
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

    with patch("app.tasks.crawl_tasks.WebAtlasCrawler") as MockCrawlerCls:
        mock_instance = AsyncMock()
        mock_instance.crawl.return_value = mock_result
        MockCrawlerCls.return_value = mock_instance

        res = execute_crawl_task(
            crawl_id=crawl_id,
            starting_url="https://testsite.org",
            max_depth=2,
            max_pages=50,
        )

        assert res["status"] == "COMPLETED"
        assert res["total_pages"] == 1

    db = SessionLocal()
    try:
        updated = get_crawl_by_id(db, crawl_id)
        assert updated is not None
        assert updated.status == "COMPLETED"
        assert updated.started_at is not None
        assert updated.completed_at is not None
        assert updated.total_pages == 1
        assert len(updated.pages) == 1
    finally:
        db.close()


def test_update_crawl_progress_counters():
    """Verify live progress metric updating function."""
    db = SessionLocal()
    try:
        crawl_record = create_initial_crawl(
            db,
            starting_url="https://progresstest.org",
            normalized_starting_url="https://progresstest.org/",
            domain="progresstest.org",
            max_depth=3,
            max_pages=100,
        )
        crawl_id = crawl_record.id

        # Simulate live progress update
        update_crawl_progress(
            db,
            crawl_id=crawl_id,
            pages_discovered=25,
            pages_crawled=10,
            pages_failed=2,
            current_depth=2,
            max_depth_reached=2,
        )

        updated = get_crawl_by_id(db, crawl_id)
        assert updated.pages_discovered == 25
        assert updated.total_pages == 10
        assert updated.failed_pages == 2
        assert updated.successful_pages == 8
        assert updated.current_depth == 2
        assert updated.max_depth_reached == 2
    finally:
        db.close()


def test_execute_crawl_task_failure_handling():
    """Verify execute_crawl_task marks status as FAILED and sets completed_at when error occurs."""
    db = SessionLocal()
    try:
        crawl_record = create_initial_crawl(
            db,
            starting_url="https://failsite.org",
            normalized_starting_url="https://failsite.org/",
            domain="failsite.org",
            max_depth=1,
            max_pages=20,
        )
        crawl_id = crawl_record.id
    finally:
        db.close()

    with patch("app.tasks.crawl_tasks.WebAtlasCrawler") as MockCrawlerCls:
        mock_instance = AsyncMock()
        mock_instance.crawl.side_effect = RuntimeError("Connection timed out")
        MockCrawlerCls.return_value = mock_instance

        res = execute_crawl_task(
            crawl_id=crawl_id,
            starting_url="https://failsite.org",
            max_depth=1,
        )

        assert res["status"] == "FAILED"
        assert "Connection timed out" in res["error"]

    db = SessionLocal()
    try:
        updated = get_crawl_by_id(db, crawl_id)
        assert updated is not None
        assert updated.status == "FAILED"
        assert updated.completed_at is not None
        assert "Connection timed out" in updated.errors_json
    finally:
        db.close()
