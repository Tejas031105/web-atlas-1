"""SQLAlchemy Database ORM Models for Crawls and Discovered Pages."""

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


class CrawlModel(Base):
    """Database model for a persistent website crawl session."""

    __tablename__ = "crawls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    starting_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    normalized_starting_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    total_pages: Mapped[int] = mapped_column(Integer, default=0)
    successful_pages: Mapped[int] = mapped_column(Integer, default=0)
    failed_pages: Mapped[int] = mapped_column(Integer, default=0)
    total_internal_links: Mapped[int] = mapped_column(Integer, default=0)
    total_external_links: Mapped[int] = mapped_column(Integer, default=0)

    max_depth_requested: Mapped[int] = mapped_column(Integer, default=2)
    max_pages_requested: Mapped[int] = mapped_column(Integer, default=50)
    pages_discovered: Mapped[int] = mapped_column(Integer, default=0)
    current_depth: Mapped[int] = mapped_column(Integer, default=0)
    max_depth_reached: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    render_mode: Mapped[str] = mapped_column(String(50), default="auto")
    status: Mapped[str] = mapped_column(String(50), default="QUEUED")
    task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    errors_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Cascading one-to-many relationship with discovered pages
    pages: Mapped[List["PageModel"]] = relationship(
        "PageModel",
        back_populates="crawl",
        cascade="all, delete-orphan",
        order_by="PageModel.depth, PageModel.id",
    )


class PageModel(Base):
    """Database model for an individual discovered page belonging to a crawl session."""

    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crawl_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("crawls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    normalized_url: Mapped[str] = mapped_column(String(2048), nullable=False, index=True)
    parent_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    depth: Mapped[int] = mapped_column(Integer, default=0, index=True)

    title: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    status_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    crawl_success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response_time: Mapped[float] = mapped_column(Float, default=0.0)

    internal_links_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    external_links_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    crawl: Mapped["CrawlModel"] = relationship("CrawlModel", back_populates="pages")
