"""
Configuration Celery — Queue de tâches asynchrones
"""

import ssl
from celery import Celery
from celery.schedules import crontab
from config import settings

# ── Options SSL pour Upstash (rediss://) ─────────────────────────────────────
redis_ssl_options = {"ssl_cert_reqs": ssl.CERT_NONE} if settings.redis_url.startswith("rediss://") else {}

# ── App Celery ────────────────────────────────────────────────────────────────
celery_app = Celery(
    "immo_intelligence",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["tasks.tasks"],
)

if redis_ssl_options:
    celery_app.conf.broker_use_ssl = redis_ssl_options
    celery_app.conf.redis_backend_use_ssl = redis_ssl_options

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Paris",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,  # Requeue si le worker crash
    worker_prefetch_multiplier=1,
    result_expires=3600,
)

# ── Tâches périodiques (Beat) ─────────────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Sync DPE — quotidien à 6h du matin
    "sync-dpe-daily": {
        "task": "tasks.tasks.sync_dpe_pilot_zone",
        "schedule": crontab(hour=6, minute=0),
        "args": [],
    },

    # Sync DVF — hebdomadaire (DVF est mis à jour trimestriellement)
    "sync-dvf-weekly": {
        "task": "tasks.tasks.sync_dvf_pilot_zone",
        "schedule": crontab(hour=7, minute=0, day_of_week="monday"),
        "args": [],
    },

    # Mise à jour des scores — toutes les 4h
    "update-scores-frequent": {
        "task": "tasks.tasks.update_all_scores",
        "schedule": crontab(hour="*/4", minute=30),
        "args": [],
    },

    # Nettoyage des annonces inactives — quotidien à 2h
    "cleanup-inactive": {
        "task": "tasks.tasks.cleanup_inactive_listings",
        "schedule": crontab(hour=2, minute=0),
        "args": [],
    },
}
