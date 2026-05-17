"""
Scraper DPE ADEME — Données publiques gratuites
API : https://data.ademe.fr/

Aucun risque légal : données ouvertes, licence Etalab.
"""

import asyncio
import aiohttp
from datetime import date, datetime, timedelta
from loguru import logger
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from tenacity import retry, stop_after_attempt, wait_exponential

from models import DPERecord, ClasseDPE
from services.geocoding import geocode_address
from services.scoring import compute_dpe_score


ADEME_API_BASE = "https://data.ademe.fr/data-fair/api/v1/datasets"
DPE_DATASET_ID = "dpe-v2-logements-existants"
DPE_TERTIAIRE_ID = "dpe-v2-logements-neufs"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _fetch_page(session: aiohttp.ClientSession, url: str, params: dict) -> dict:
    """Fetch une page de l'API ADEME avec retry."""
    async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        resp.raise_for_status()
        return await resp.json()


async def fetch_dpe_zone(
    lat: float,
    lon: float,
    rayon_km: float,
    db: AsyncSession,
    jours_recents: int = 180,
):
    """
    Récupère tous les DPE dans un rayon donné depuis l'API ADEME.
    Lance l'import et le scoring.
    """
    logger.info(f"🔍 Fetch DPE ADEME — ({lat}, {lon}) rayon={rayon_km}km")

    date_depuis = (date.today() - timedelta(days=jours_recents)).isoformat()
    url = f"{ADEME_API_BASE}/{DPE_DATASET_ID}/lines"

    params = {
        "geo_distance": f"{int(rayon_km * 1000)},{lon},{lat}",
        "gte_Date_reception_DPE": date_depuis,
        "size": 1000,
        "select": ",".join([
            "N°DPE",
            "Date_réception_DPE",
            "Date_fin_validité_DPE",
            "Adresse_(BAN)",
            "Code_postal_(BAN)",
            "Commune_(BAN)",
            "Coordonnée_cartographique_X_(BAN)",
            "Coordonnée_cartographique_Y_(BAN)",
            "Type_bâtiment",
            "Surface_habitable_logement",
            "Année_construction",
            "Etiquette_DPE",
            "Conso_5_usages_é_finale",
            "Etiquette_GES",
            "Emission_GES_5_usages",
            "Type_installation_chauffage",
            "Type_énergie_principale_chauffage",
        ]),
    }

    imported = 0
    updated = 0
    skipped = 0

    async with aiohttp.ClientSession() as session:
        try:
            data = await _fetch_page(session, url, params)
        except Exception as e:
            logger.error(f"Erreur API ADEME : {e}")
            return {"imported": 0, "error": str(e)}

        total = data.get("total", 0)
        results = data.get("results", [])
        logger.info(f"  → {total} DPE trouvés, traitement de {len(results)}")

        for item in results:
            try:
                numero_dpe = item.get("N°DPE")
                if not numero_dpe:
                    continue

                # Vérifier si déjà en base
                existing = await db.scalar(
                    select(DPERecord).where(DPERecord.numero_dpe == numero_dpe)
                )
                if existing:
                    skipped += 1
                    continue

                # Parser les coordonnées ADEME (Lambert93 ou WGS84 selon les champs)
                lon_dpe = item.get("Coordonnée_cartographique_X_(BAN)")
                lat_dpe = item.get("Coordonnée_cartographique_Y_(BAN)")

                # Si coordonnées manquantes → géocodage par adresse
                if not lon_dpe or not lat_dpe:
                    adresse = item.get("Adresse_(BAN)", "")
                    cp = item.get("Code_postal_(BAN)", "")
                    commune = item.get("Commune_(BAN)", "")
                    coords = await geocode_address(f"{adresse}, {cp} {commune}")
                    if coords:
                        lat_dpe, lon_dpe = coords
                    else:
                        lat_dpe, lon_dpe = None, None

                # Parser les dates
                date_reception = _parse_date(item.get("Date_réception_DPE"))
                date_fin = _parse_date(item.get("Date_fin_validité_DPE"))

                # Classe DPE
                classe_str = item.get("Etiquette_DPE", "NC")
                classe = _parse_classe(classe_str)
                classe_ges = _parse_classe(item.get("Etiquette_GES", "NC"))

                record = DPERecord(
                    numero_dpe=numero_dpe,
                    date_etablissement=date_reception,
                    date_fin_validite=date_fin,
                    adresse=item.get("Adresse_(BAN)"),
                    code_postal=item.get("Code_postal_(BAN)"),
                    commune=item.get("Commune_(BAN)"),
                    latitude=lat_dpe,
                    longitude=lon_dpe,
                    type_batiment=item.get("Type_bâtiment"),
                    surface_habitable=_parse_float(item.get("Surface_habitable_logement")),
                    annee_construction=_parse_int(item.get("Année_construction")),
                    classe_conso_energie=classe,
                    consommation_energie=_parse_float(item.get("Conso_5_usages_é_finale")),
                    classe_estimation_ges=classe_ges,
                    estimation_ges=_parse_float(item.get("Emission_GES_5_usages")),
                    type_chauffage=item.get("Type_installation_chauffage"),
                    energie_chauffage=item.get("Type_énergie_principale_chauffage"),
                )

                # Ajouter géométrie PostGIS
                if lat_dpe and lon_dpe:
                    from geoalchemy2 import WKTElement
                    record.geom = WKTElement(f"POINT({lon_dpe} {lat_dpe})", srid=4326)

                # Scoring
                scores = compute_dpe_score(record)
                record.score_vente_probable = scores["score_vente_probable"]
                record.score_priorite_contact = scores["score_priorite_contact"]

                db.add(record)
                imported += 1

                # Commit par lots de 100
                if imported % 100 == 0:
                    await db.commit()
                    logger.info(f"  → {imported} DPE importés...")

            except Exception as e:
                logger.warning(f"Erreur sur DPE {item.get('N°DPE')}: {e}")
                continue

        await db.commit()

    logger.info(f"✅ DPE sync terminé : {imported} importés, {skipped} existants")
    return {"imported": imported, "updated": updated, "skipped": skipped}


async def fetch_dpe_commune(commune: str, db: AsyncSession):
    """Fetch DPE par nom de commune."""
    url = f"{ADEME_API_BASE}/{DPE_DATASET_ID}/lines"
    params = {
        "q": commune,
        "q_fields": "Commune_(BAN)",
        "size": 2000,
    }
    # Réutilise la logique principale
    # (simplification pour le MVP)
    logger.info(f"Fetch DPE pour commune: {commune}")


def _parse_date(value) -> Optional[date]:
    if not value:
        return None
    for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"]:
        try:
            return datetime.strptime(str(value), fmt).date()
        except ValueError:
            continue
    return None


def _parse_float(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "."))
    except (ValueError, TypeError):
        return None


def _parse_int(value) -> Optional[int]:
    f = _parse_float(value)
    return int(f) if f is not None else None


def _parse_classe(value: str) -> ClasseDPE:
    if not value:
        return ClasseDPE.NC
    v = str(value).strip().upper()
    if v in ("A", "B", "C", "D", "E", "F", "G"):
        return ClasseDPE[v]
    return ClasseDPE.NC
