"""Celery Application and Configuration Module."""

import sys
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "webatlas",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    imports=["app.tasks.crawl_tasks"],
    task_time_limit=3600,  # 1 hour hard timeout limit per task
    task_soft_time_limit=3300,  # 55 minute soft timeout warning limit per task
    worker_pool="solo" if sys.platform == "win32" else "prefork",
)


@celery_app.task(name="app.tasks.celery_app.add")
def add(x: int, y: int) -> int:
    """Connectivity test task returning sum of two numbers."""
    return x + y
