"""
Tâches Celery — Jobs asynchrones et planifiés
"""

import asyncio
from celery import shared_task
from loguru import logger
from datetime import datetime, timedelta
from sqlalchemy import select, and_, update

from tasks.celery_app import celery_app
from config import settings


def run_async(coro):
    """Helper pour exécuter du code async dans Celery (synchrone)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, name="tasks.tasks.sync_dpe_pilot_zone", max_retries=3)
def sync_dpe_pilot_zone(self):
    """
    Synchronise les DPE ADEME pour la zone pilote.
    Lance chaque matin à 6h.
    """
    logger.info(f"🔄 Sync DPE zone pilote : {settings.pilot_city}")
    try:
        from database import AsyncSessionLocal
        from scrapers.dpe_fetcher import fetch_dpe_zone

        async def _run():
            async with AsyncSessionLocal() as db:
                result = await fetch_dpe_zone(
                    lat=settings.pilot_lat,
                    lon=settings.pilot_lon,
                    rayon_km=settings.pilot_radius_km,
                    db=db,
                )
                return result

        result = run_async(_run())
        logger.info(f"✅ DPE sync terminé : {result}")
        return result

    except Exception as exc:
        logger.error(f"❌ Erreur sync DPE : {exc}")
        raise self.retry(exc=exc, countdown=300)  # Retry dans 5 min


@celery_app.task(bind=True, name="tasks.tasks.sync_dvf_pilot_zone", max_retries=3)
def sync_dvf_pilot_zone(self):
    """
    Importe les transactions DVF pour la ville pilote.
    Lance chaque lundi.
    """
    logger.info(f"🔄 Sync DVF ville pilote : {settings.pilot_city}")
    try:
        from database import AsyncSessionLocal
        from scrapers.dvf_fetcher import fetch_dvf_commune

        async def _run():
            async with AsyncSessionLocal() as db:
                count = await fetch_dvf_commune(settings.pilot_city, db)
                return {"imported": count}

        result = run_async(_run())
        logger.info(f"✅ DVF sync terminé : {result}")
        return result

    except Exception as exc:
        logger.error(f"❌ Erreur sync DVF : {exc}")
        raise self.retry(exc=exc, countdown=600)


@celery_app.task(name="tasks.tasks.update_all_scores")
def update_all_scores():
    """
    Recalcule les scores de tous les biens en vente.
    - jours_sur_marche
    - score_opportunite_mandat
    - nb_baisses_prix
    """
    logger.info("🔄 Mise à jour des scores...")
    try:
        from database import AsyncSessionLocal
        from models import Bien, AnnonceSource, PrixHistorique, StatutBien
        from services.scoring import compute_opportunite_mandat

        async def _run():
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Bien).where(Bien.statut == StatutBien.en_vente)
                )
                biens = result.scalars().all()
                updated = 0

                for bien in biens:
                    # Jours sur le marché
                    if bien.date_premiere_mise_en_vente:
                        jours = (datetime.utcnow() - bien.date_premiere_mise_en_vente).days
                        bien.jours_sur_marche = jours

                    # Score opportunité
                    bien.score_opportunite_mandat = compute_opportunite_mandat(bien)
                    updated += 1

                    if updated % 100 == 0:
                        await db.commit()

                await db.commit()
                return {"updated": updated}

        result = run_async(_run())
        logger.info(f"✅ Scores mis à jour : {result}")
        return result

    except Exception as e:
        logger.error(f"❌ Erreur update scores : {e}")


@celery_app.task(name="tasks.tasks.cleanup_inactive_listings")
def cleanup_inactive_listings():
    """
    Marque comme 'retirés' les biens dont l'annonce n'a pas été vue depuis 30 jours.
    Indicateur : l'annonce source est passée à actif=False.
    """
    logger.info("🧹 Nettoyage des annonces inactives...")
    try:
        from database import AsyncSessionLocal
        from models import AnnonceSource, Bien, StatutBien

        async def _run():
            seuil = datetime.utcnow() - timedelta(days=30)
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(AnnonceSource).where(
                        and_(
                            AnnonceSource.actif == True,
                            AnnonceSource.date_scraping < seuil,
                        )
                    )
                )
                annonces_inactives = result.scalars().all()

                deactivated = 0
                for annonce in annonces_inactives:
                    annonce.actif = False
                    deactivated += 1

                await db.commit()
                return {"deactivated": deactivated}

        result = run_async(_run())
        logger.info(f"✅ Nettoyage terminé : {result}")
        return result

    except Exception as e:
        logger.error(f"❌ Erreur cleanup : {e}")


@celery_app.task(name="tasks.tasks.initial_data_load")
def initial_data_load():
    """
    Chargement initial des données pour un nouveau déploiement.
    À lancer une seule fois manuellement : celery call tasks.tasks.initial_data_load
    """
    logger.info("🚀 Chargement initial des données...")

    # 1. DVF (3 dernières années)
    sync_dvf_pilot_zone.apply()

    # 2. DPE (6 derniers mois)
    sync_dpe_pilot_zone.apply()

    logger.info("✅ Chargement initial terminé")
    return {"status": "done"}
