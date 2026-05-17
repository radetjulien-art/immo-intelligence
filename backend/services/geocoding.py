"""
Service de géocodage — API Adresse (data.gouv.fr)
Gratuit, sans clé API, très fiable sur les adresses françaises.
"""

import aiohttp
from typing import Optional, Tuple
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_fixed
import asyncio


API_ADRESSE_URL = "https://api-adresse.data.gouv.fr/search"


@retry(stop=stop_after_attempt(3), wait=wait_fixed(1))
async def geocode_address(adresse: str) -> Optional[Tuple[float, float]]:
    """
    Géocode une adresse française.
    Retourne (latitude, longitude) ou None si non trouvé.
    """
    if not adresse or len(adresse.strip()) < 5:
        return None

    params = {"q": adresse, "limit": 1, "autocomplete": 0}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                API_ADRESSE_URL,
                params=params,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

        features = data.get("features", [])
        if not features:
            return None

        best = features[0]
        if best.get("properties", {}).get("score", 0) < 0.5:
            return None  # Confiance trop faible

        coords = best["geometry"]["coordinates"]
        lon, lat = coords[0], coords[1]
        return (lat, lon)

    except asyncio.TimeoutError:
        logger.debug(f"Timeout géocodage : {adresse}")
        return None
    except Exception as e:
        logger.debug(f"Erreur géocodage '{adresse}': {e}")
        return None


async def geocode_batch(adresses: list[str], delay: float = 0.1) -> list[Optional[Tuple[float, float]]]:
    """
    Géocode une liste d'adresses avec délai entre les requêtes.
    L'API Adresse supporte aussi un endpoint /csv pour les imports en masse.
    """
    results = []
    for adresse in adresses:
        result = await geocode_address(adresse)
        results.append(result)
        if delay:
            await asyncio.sleep(delay)
    return results


async def reverse_geocode(lat: float, lon: float) -> Optional[dict]:
    """
    Géocodage inverse : coordonnées → adresse + informations administratives.
    """
    url = "https://api-adresse.data.gouv.fr/reverse"
    params = {"lat": lat, "lon": lon}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                resp.raise_for_status()
                data = await resp.json()

        features = data.get("features", [])
        if not features:
            return None

        props = features[0].get("properties", {})
        return {
            "adresse": props.get("label"),
            "numero": props.get("housenumber"),
            "voie": props.get("street"),
            "code_postal": props.get("postcode"),
            "commune": props.get("city"),
            "code_commune": props.get("citycode"),
            "departement": props.get("context", "").split(",")[0].strip(),
        }
    except Exception as e:
        logger.debug(f"Erreur reverse geocode ({lat},{lon}): {e}")
        return None
