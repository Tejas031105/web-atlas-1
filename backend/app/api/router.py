"""Main API Router unifying all API sub-routers."""

from fastapi import APIRouter
from app.api.v1 import health, crawl, history, diagnostics

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(crawl.router)
api_router.include_router(history.router)
api_router.include_router(diagnostics.router)
