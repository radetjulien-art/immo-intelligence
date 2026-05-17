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

# Villes avec arrondissements : code INSEE principal → liste des codes INSEE réels
# Paris: 75056 → 75101-75120 ; Lyon: 69123 → 69381-69389 ; Marseille: 13055 → 13201-13216
ARRONDISSEMENTS = {
    "75056": [f"751{str(i).zfill(2)}" for i in range(1, 21)],
    "69123": [f"693{str(i).zfill(2)}" for i in range(81, 90)],
    "13055": [f"132{str(i).zfill(2)}" for i in range(1, 17)],
}


async def fetch_dvf_commune(
    commune: str,
    db: AsyncSession,
    code_commune: str = None,
    annees: list = None,
):
    """
    Télécharge et importe les données DVF pour une commune via l'API Etalab.

    Args:
        commune:      Nom de la commune (ex: "Paris")
        code_commune: Code INSEE 5 chiffres (ex: "75056") — recommandé
        db:           Session DB
        annees:       Liste d'années (défaut: 3 dernières)
    """
    if annees is None:
        current_year = date.today().year
        annees = [current_year - 1, current_year - 2, current_year - 3]

    logger.info(f"📊 Import DVF pour {commune} (code={code_commune}) — années {annees}")

    # Déterminer les codes communes à interroger
    codes_to_fetch: list[str] = []
    if code_commune:
        # Paris/Lyon/Marseille : remplacer le code principal par les codes arrondissements
        codes_to_fetch = ARRONDISSEMENTS.get(code_commune, [code_commune])
    # Si pas de code fourni, on passera le nom de commune

    total_imported = 0
    async with aiohttp.ClientSession() as session:
        for annee in annees:
            try:
                if codes_to_fetch:
                    # Fetch par code INSEE (plus fiable)
                    for code in codes_to_fetch:
                        count = await _fetch_dvf_by_code(session, code, annee, db)
                        total_imported += count
                        if count:
                            logger.info(f"  → {annee} code={code}: {count} transactions")
                else:
                    # Fallback : fetch par nom de commune
                    count = await _fetch_dvf_by_name(session, commune, annee, db)
                    total_imported += count
                    logger.info(f"  → {annee} nom={commune}: {count} transactions")
            except Exception as e:
                logger.error(f"Erreur DVF {commune} {annee}: {e}")

    logger.info(f"✅ DVF {commune} terminé : {total_imported} transactions")
    return total_imported


async def _fetch_dvf_by_code(
    session: aiohttp.ClientSession,
    code_commune: str,
    annee: int,
    db: AsyncSession,
) -> int:
    """Fetch DVF par code INSEE de commune."""
    url = "https://api.dvf.etalab.gouv.fr/dvf/mutations"
    params = {
        "code_commune": code_commune,
        "nature_mutation": "Vente",
        "date_debut": f"{annee}-01-01",
        "date_fin": f"{annee}-12-31",
        "page_size": 500,
        "page": 1,
    }
    return await _fetch_dvf_paginated(session, params, db)


async def _fetch_dvf_by_name(
    session: aiohttp.ClientSession,
    commune: str,
    annee: int,
    db: AsyncSession,
) -> int:
    """Fetch DVF par nom de commune (fallback si pas de code INSEE)."""
    url = "https://api.dvf.etalab.gouv.fr/dvf/mutations"
    params = {
        "commune": commune.upper(),  # DVF API expects uppercase
        "nature_mutation": "Vente",
        "date_debut": f"{annee}-01-01",
        "date_fin": f"{annee}-12-31",
        "page_size": 500,
        "page": 1,
    }
    return await _fetch_dvf_paginated(session, params, db)


async def _fetch_dvf_paginated(
    session: aiohttp.ClientSession,
    params: dict,
    db: AsyncSession,
) -> int:
    """Fetch DVF avec pagination, retourne le nombre de transactions importées."""
    url = "https://api.dvf.etalab.gouv.fr/dvf/mutations"
    imported = 0

    while True:
        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                if resp.status == 404:
                    break
                resp.raise_for_status()
                data = await resp.json()
        except Exception as e:
            logger.warning(f"API DVF error page {params.get('page')}: {e}")
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

        if imported % 200 == 0 and imported > 0:
            await db.commit()

        if not data.get("next"):
            break
        params["page"] = params.get("page", 1) + 1
        await asyncio.sleep(0.3)

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
