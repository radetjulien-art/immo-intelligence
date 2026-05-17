"""
Scraper DVF (Demandes de Valeurs Foncières) — Données publiques gratuites
Source : https://files.data.gouv.fr/geo-dvf/latest/csv/

Aucun risque légal : données ouvertes, licence Etalab.
Format : CSV par département et par année.
"""

import asyncio
import aiohttp
import csv
import io
import gzip
from datetime import date, datetime
from loguru import logger
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import WKTElement

from models import DVFTransaction


DVF_BASE_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv"
# Alternative API : https://api.datafoncier.cerema.fr/


async def fetch_dvf_commune(commune: str, db: AsyncSession, annees: list = None):
    """
    Télécharge et importe les données DVF pour une commune.
    
    Args:
        commune: Nom de la commune (ex: "nantes")
        db: Session DB
        annees: Liste d'années (défaut: 3 dernières)
    """
    if annees is None:
        current_year = date.today().year
        # DVF a ~6 mois de retard
        annees = [current_year - 1, current_year - 2, current_year - 3]

    logger.info(f"📊 Import DVF pour {commune} — années {annees}")
    total_imported = 0

    async with aiohttp.ClientSession() as session:
        for annee in annees:
            try:
                # DVF est par département : on doit connaître le code dept
                # Pour le MVP, on télécharge le fichier national filtré via API
                count = await _fetch_dvf_api(session, commune, annee, db)
                total_imported += count
                logger.info(f"  → {annee}: {count} transactions importées")
            except Exception as e:
                logger.error(f"Erreur DVF {commune} {annee}: {e}")

    logger.info(f"✅ DVF {commune} terminé : {total_imported} transactions")
    return total_imported


async def _fetch_dvf_api(
    session: aiohttp.ClientSession,
    commune: str,
    annee: int,
    db: AsyncSession,
) -> int:
    """
    Utilise l'API DVF publique (Etalab) pour filtrer par commune.
    API doc : https://api.dvf.etalab.gouv.fr/
    """
    # API DVF alternative plus simple pour le MVP
    url = "https://api.dvf.etalab.gouv.fr/dvf/mutations"
    params = {
        "commune": commune,
        "nature_mutation": "Vente",
        "type_local": "Appartement,Maison",
        "date_debut": f"{annee}-01-01",
        "date_fin": f"{annee}-12-31",
        "page_size": 500,
        "page": 1,
    }

    imported = 0
    while True:
        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                if resp.status == 404:
                    break
                resp.raise_for_status()
                data = await resp.json()
        except Exception as e:
            logger.warning(f"API DVF error page {params['page']}: {e}")
            break

        mutations = data.get("results", [])
        if not mutations:
            break

        for m in mutations:
            try:
                txn = _parse_mutation(m)
                if txn:
                    db.add(txn)
                    imported += 1
            except Exception as e:
                logger.debug(f"Skip mutation: {e}")
                continue

        if imported % 100 == 0 and imported > 0:
            await db.commit()

        # Pagination
        if not data.get("next"):
            break
        params["page"] += 1
        await asyncio.sleep(0.5)

    await db.commit()
    return imported


async def fetch_dvf_csv_departement(dept_code: str, annee: int, db: AsyncSession) -> int:
    """
    Télécharge le CSV complet d'un département.
    Plus complet que l'API mais plus lourd (~50-200MB/dept).
    À utiliser pour la phase 2.
    """
    url = f"{DVF_BASE_URL}/{annee}/departements/{dept_code}.csv.gz"
    logger.info(f"Téléchargement DVF CSV : {url}")

    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            if resp.status == 404:
                logger.warning(f"DVF CSV non trouvé : {url}")
                return 0
            resp.raise_for_status()
            content = await resp.read()

    # Décompresser et parser
    with gzip.open(io.BytesIO(content), "rt", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        imported = 0
        batch = []

        for row in reader:
            txn = _parse_csv_row(row)
            if txn:
                batch.append(txn)
                imported += 1

                if len(batch) >= 500:
                    db.add_all(batch)
                    await db.commit()
                    batch = []
                    logger.debug(f"  {imported} rows importées...")

        if batch:
            db.add_all(batch)
            await db.commit()

    logger.info(f"  → CSV dept {dept_code}/{annee}: {imported} transactions")
    return imported


def _parse_mutation(m: dict) -> Optional[DVFTransaction]:
    """Parse une mutation depuis l'API DVF Etalab."""
    valeur = _parse_float(m.get("valeur_fonciere"))
    if not valeur or valeur <= 0:
        return None

    surface = _parse_float(m.get("surface_reelle_bati"))
    lat = _parse_float(m.get("latitude"))
    lon = _parse_float(m.get("longitude"))

    txn = DVFTransaction(
        id_mutation=m.get("id_mutation"),
        date_mutation=_parse_date(m.get("date_mutation")),
        adresse_numero=m.get("numero"),
        adresse_nom_voie=m.get("nom_voie"),
        adresse_code_voie=m.get("code_voie"),
        code_postal=m.get("code_postal"),
        commune=m.get("commune"),
        code_commune=m.get("code_commune"),
        code_departement=m.get("code_departement"),
        latitude=lat,
        longitude=lon,
        valeur_fonciere=valeur,
        nature_mutation=m.get("nature_mutation"),
        type_local=m.get("type_local"),
        surface_reelle_bati=surface,
        nombre_pieces_principales=_parse_int(m.get("nombre_pieces_principales")),
        surface_terrain=_parse_float(m.get("surface_terrain")),
    )

    # Calcul prix/m²
    if surface and surface > 0 and valeur:
        txn.prix_m2 = round(valeur / surface, 2)

    # Géométrie PostGIS
    if lat and lon:
        txn.geom = WKTElement(f"POINT({lon} {lat})", srid=4326)

    return txn


def _parse_csv_row(row: dict) -> Optional[DVFTransaction]:
    """Parse une ligne du CSV DVF departement."""
    try:
        valeur = _parse_float(row.get("valeur_fonciere", "").replace(",", "."))
        if not valeur or valeur <= 0:
            return None

        surface = _parse_float(row.get("surface_reelle_bati", "").replace(",", "."))
        lat = _parse_float(row.get("latitude", "").replace(",", "."))
        lon = _parse_float(row.get("longitude", "").replace(",", "."))

        txn = DVFTransaction(
            id_mutation=row.get("id_mutation"),
            date_mutation=_parse_date(row.get("date_mutation")),
            adresse_numero=row.get("numero"),
            adresse_nom_voie=row.get("voie"),
            code_postal=row.get("code_postal"),
            commune=row.get("nom_commune"),
            code_commune=row.get("code_commune"),
            code_departement=row.get("code_departement"),
            latitude=lat,
            longitude=lon,
            valeur_fonciere=valeur,
            nature_mutation=row.get("nature_mutation"),
            type_local=row.get("type_local"),
            surface_reelle_bati=surface,
            nombre_pieces_principales=_parse_int(row.get("nombre_pieces_principales")),
            surface_terrain=_parse_float(row.get("surface_terrain", "").replace(",", ".")),
        )

        if surface and surface > 0 and valeur:
            txn.prix_m2 = round(valeur / surface, 2)
        if lat and lon:
            txn.geom = WKTElement(f"POINT({lon} {lat})", srid=4326)

        return txn
    except Exception:
        return None


def _parse_date(value) -> Optional[date]:
    if not value:
        return None
    for fmt in ["%Y-%m-%d", "%d/%m/%Y"]:
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_float(value) -> Optional[float]:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(",", ".").replace(" ", ""))
    except (ValueError, TypeError):
        return None


def _parse_int(value) -> Optional[int]:
    f = _parse_float(value)
    return int(f) if f is not None else None
