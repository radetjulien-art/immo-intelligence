"""
Cadastre — Parcelles cadastrales françaises
Source : API Carto IGN (https://apicarto.ign.fr)
Données publiques, licence ouverte, aucune clé requise.
"""

import aiohttp
from fastapi import APIRouter, HTTPException, Query
from loguru import logger

router = APIRouter()

IGN_CADASTRE_URL = "https://apicarto.ign.fr/api/cadastre/parcelle"


@router.get("/parcelles")
async def get_parcelles(
    lat:  float = Query(..., description="Latitude WGS84"),
    lon:  float = Query(..., description="Longitude WGS84"),
    dist: int   = Query(1000, ge=100, le=5000, description="Rayon en mètres"),
):
    """
    Récupère les parcelles cadastrales autour d'un point via l'API IGN.
    Retourne un GeoJSON FeatureCollection.
    """
    logger.info(f"📍 Cadastre fetch — ({lat}, {lon}) dist={dist}m")

    params = {
        "lon":    lon,
        "lat":    lat,
        "dist":   dist,
        "_limit": 500,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                IGN_CADASTRE_URL,
                params=params,
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    logger.warning(f"IGN API non-200: {resp.status} — {text[:200]}")
                    raise HTTPException(status_code=502, detail=f"IGN API error {resp.status}")
                data = await resp.json()

        nb = len(data.get("features", []))
        logger.info(f"✅ Cadastre : {nb} parcelles retournées")
        return data

    except aiohttp.ClientError as e:
        logger.error(f"❌ Erreur connexion IGN : {e}")
        raise HTTPException(status_code=502, detail=f"Impossible de joindre l'API IGN : {e}")


@router.get("/stats")
async def get_stats_cadastre(
    lat:  float = Query(...),
    lon:  float = Query(...),
    dist: int   = Query(1000, ge=100, le=5000),
):
    """
    Statistiques agrégées des parcelles cadastrales pour une zone.
    """
    params = {"lon": lon, "lat": lat, "dist": dist, "_limit": 500}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                IGN_CADASTRE_URL,
                params=params,
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

        features = data.get("features", [])
        surfaces = [f["properties"].get("contenance", 0) for f in features if f.get("properties")]
        sections = list({f["properties"].get("section", "") for f in features if f.get("properties")})

        return {
            "nb_parcelles":    len(features),
            "surface_totale":  sum(surfaces),
            "surface_moyenne": round(sum(surfaces) / len(surfaces)) if surfaces else 0,
            "surface_max":     max(surfaces) if surfaces else 0,
            "nb_sections":     len(sections),
            "sections":        sorted(sections),
        }

    except aiohttp.ClientError as e:
        raise HTTPException(status_code=502, detail=str(e))
