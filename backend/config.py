from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "Immo Intelligence API"
    environment: str = "development"
    log_level: str = "INFO"
    secret_key: str = "dev_secret_key_change_in_production"

    # Base de données
    database_url: str = "postgresql+asyncpg://immo:immo_secret@localhost:5432/immo_intelligence"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Mapbox
    mapbox_token: Optional[str] = None

    # Proxies scraping
    proxy_url: Optional[str] = None

    # Ville pilote
    pilot_city: str = "nantes"
    pilot_lat: float = 47.2184
    pilot_lon: float = -1.5536
    pilot_radius_km: float = 15.0

    # SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_from: str = "noreply@immo-intelligence.fr"

    # Rate limiting scraping
    scraper_delay_seconds: float = 2.0
    scraper_jitter_max: float = 1.5

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
