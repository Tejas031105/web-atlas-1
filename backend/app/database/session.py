"""SQLAlchemy Engine, Session Management, and Database Dependency."""

import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session

# Define path to SQLite database file inside project data/ directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "webatlas.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create SQLite SQLAlchemy engine with check_same_thread=False for FastAPI concurrency
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _auto_migrate_schema() -> None:
    """Ensure database tables and progress tracking columns exist automatically on import."""
    try:
        from sqlalchemy import text
        import app.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(crawls)")).fetchall()
            col_names = [r[1] for r in result]
            if result:
                if "task_id" not in col_names:
                    conn.execute(text("ALTER TABLE crawls ADD COLUMN task_id VARCHAR(255)"))
                if "max_pages_requested" not in col_names:
                    conn.execute(text("ALTER TABLE crawls ADD COLUMN max_pages_requested INTEGER DEFAULT 50"))
                if "pages_discovered" not in col_names:
                    conn.execute(text("ALTER TABLE crawls ADD COLUMN pages_discovered INTEGER DEFAULT 0"))
                if "current_depth" not in col_names:
                    conn.execute(text("ALTER TABLE crawls ADD COLUMN current_depth INTEGER DEFAULT 0"))
                if "started_at" not in col_names:
                    conn.execute(text("ALTER TABLE crawls ADD COLUMN started_at DATETIME"))
                if "completed_at" not in col_names:
                    conn.execute(text("ALTER TABLE crawls ADD COLUMN completed_at DATETIME"))
                if "render_mode" not in col_names:
                    conn.execute(text("ALTER TABLE crawls ADD COLUMN render_mode VARCHAR(50) DEFAULT 'auto'"))
                conn.commit()
    except Exception:
        pass


_auto_migrate_schema()


def init_db() -> None:
    """Initialize database tables idempotently."""
    _auto_migrate_schema()
