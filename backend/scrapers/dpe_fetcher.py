"""
Scraper DPE ADEME — Données publiques gratuites
API : https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines

Aucun risque légal : données ouvertes, licence Etalab.
"""

import asyncio
import aiohttp
from datetime import date, datetime, timedelta
from loguru import logger
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import DPERecord, ClasseDPE
from services.scoring import compute_dpe_score


ADEME_API_BASE = "https://data.ademe.fr/data-fair/api/v1/datasets"
DPE_DATASET_ID = "dpe-v2-logements-existants"

# Champs à récupérer depuis l'API ADEME
ADEME_FIELDS = ",".join([
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
])

# Maximum de DPE à importer par sync (éviter les timeouts)
MAX_DPE_PER_SYNC = 3000


async def fetch_dpe_zone(
    lat: float,
    lon: float,
    rayon_km: float,
    db: AsyncSession,
    jours_recents: int = 365,
) -> dict:
    """
    Récupère les DPE dans un rayon donné depuis l'API ADEME.
    Gère la pagination, le scoring et l'import en base.
    """
    logger.info(f"🔍 Fetch DPE ADEME — ({lat:.4f}, {lon:.4f}) rayon={rayon_km}km")

    date_depuis = (date.today() - timedelta(days=jours_recents)).isoformat()
    url = f"{ADEME_API_BASE}/{DPE_DATASET_ID}/lines"

    base_params = {
        # Format data-fair : distance_metres,longitude,latitude
        "geo_distance": f"{int(rayon_km * 1000)},{lon},{lat}",
        # Champ correct avec accent — sinon le filtre est ignoré
        "gte_Date_réception_DPE": date_depuis,
        "size": 1000,
        "select": ADEME_FIELDS,
    }

    imported = 0
    skipped = 0
    errors = 0

    async with aiohttp.ClientSession() as session:
        from_offset = 0

        while from_offset < MAX_DPE_PER_SYNC:
            params = {**base_params, "from": from_offset}

            try:
                async with session.get(
                    url, params=params,
                    timeout=aiohttp.ClientTimeout(total=45)
                ) as resp:
                    resp.raise_for_status()
                    data = await resp.json()
            except Exception as e:
                logger.error(f"Erreur API ADEME (offset={from_offset}): {e}")
                if from_offset == 0:
                    return {"imported": 0, "skipped": skipped, "error": str(e)}
                break  # On a déjà importé des données, on arrête ici

            results = data.get("results", [])
            total_api = data.get("total", 0)

            if not results:
                break  # Plus de résultats

            if from_offset == 0:
                logger.info(f"  → {total_api} DPE trouvés dans la zone")

            # Traiter les enregistrements de cette page
            for item in results:
                try:
                    result = await _process_dpe_record(item, db)
                    if result == "imported":
                        imported += 1
                    elif result == "skipped":
                        skipped += 1
                except Exception as e:
                    errors += 1
                    logger.debug(f"Erreur DPE {item.get('N°DPE', '?')}: {e}")

            # Commit par lot
            try:
                await db.commit()
            except Exception as e:
                logger.error(f"Erreur commit lot offset={from_offset}: {e}")
                await db.rollback()

            logger.info(f"  → Importés: {imported}, existants: {skipped}, page: {from_offset+len(results)}/{min(total_api, MAX_DPE_PER_SYNC)}")

            from_offset += len(results)

            # Arrêter si on a tout récupéré
            if from_offset >= total_api or len(results) < 1000:
                break

            await asyncio.sleep(0.3)  # Politesse envers l'API

    logger.info(f"✅ DPE sync terminé : {imported} importés, {skipped} existants, {errors} erreurs")
    return {"imported": imported, "skipped": skipped}


async def _process_dpe_record(item: dict, db: AsyncSession) -> str:
    """
    Traite un enregistrement DPE : dédoublonnage, scoring, insertion.
    Retourne 'imported', 'skipped', ou lève une exception.
    """
    numero_dpe = item.get("N°DPE")
    if not numero_dpe:
        return "skipped"

    # Dédoublonnage par numéro DPE
    existing = await db.scalar(
        select(DPERecord).where(DPERecord.numero_dpe == numero_dpe)
    )
    if existing:
        return "skipped"

    # Coordonnées BAN (WGS84 — X = longitude, Y = latitude)
    lon_dpe = _parse_float(item.get("Coordonnée_cartographique_X_(BAN)"))
    lat_dpe = _parse_float(item.get("Coordonnée_cartographique_Y_(BAN)"))

    # Si coordonnées aberrantes (Lambert93 > 1000 = probablement pas WGS84)
    if lon_dpe and abs(lon_dpe) > 180:
        lon_dpe = None
    if lat_dpe and (lat_dpe > 90 or lat_dpe < -90):
        lat_dpe = None

    # Classe DPE
    classe = _parse_classe(item.get("Etiquette_DPE", "NC"))
    classe_ges = _parse_classe(item.get("Etiquette_GES", "NC"))

    record = DPERecord(
        numero_dpe=numero_dpe,
        date_etablissement=_parse_date(item.get("Date_réception_DPE")),
        date_fin_validite=_parse_date(item.get("Date_fin_validité_DPE")),
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

    # Géométrie PostGIS (optionnelle — ne pas bloquer si PostGIS indisponible)
    if lat_dpe and lon_dpe:
        try:
            from geoalchemy2 import WKTElement
            record.geom = WKTElement(f"POINT({lon_dpe} {lat_dpe})", srid=4326)
        except Exception:
            pass  # PostGIS non disponible — import sans géométrie

    # Scoring
    try:
        scores = compute_dpe_score(record)
        record.score_vente_probable = scores["score_vente_probable"]
        record.score_priorite_contact = scores["score_priorite_contact"]
    except Exception:
        record.score_vente_probable = 0.0
        record.score_priorite_contact = 1

    db.add(record)
    return "imported"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _parse_date(value) -> Optional[date]:
    if not value:
        return None
    for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"]:
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_float(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", ".").replace(" ", ""))
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
