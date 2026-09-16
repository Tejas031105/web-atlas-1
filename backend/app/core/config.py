"""Application Configuration Management using Pydantic Settings."""

from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Global Application Settings."""
    
    PROJECT_NAME: str = "WebAtlas"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "Intelligent Website Crawler & Site Mapper API"
    API_V1_STR: str = "/api/v1"
    
    APP_ENV: str = "development"
    DEBUG: bool = True
    
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        default_origins = [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:5175",
        ]
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    origins = json.loads(v)
                except Exception:
                    origins = [i.strip() for i in v.strip("[]").split(",") if i.strip()]
            else:
                origins = [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            origins = list(v)
        else:
            origins = list(default_origins)

        for default in default_origins:
            if default not in origins:
                origins.append(default)
        return origins

    # Celery & Redis Configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # Playwright Browser Configuration
    PLAYWRIGHT_HEADLESS: bool = True
    PLAYWRIGHT_TIMEOUT: float = 30.0
    PLAYWRIGHT_WAIT_UNTIL: str = "domcontentloaded"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Instantiate singleton settings object
settings = Settings()
