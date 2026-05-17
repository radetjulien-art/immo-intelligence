"""
Service de déduplication — V1 (règles) + préparation V2 (ML)

Pipeline en 3 passes :
1. Déduplication exacte (même URL, même hash)
2. Déduplication forte (même adresse + surface similaire)
3. Déduplication fuzzy (similarité textuelle + distance géo)

La V2 (ML / XGBoost) viendra en phase 2 avec des données labellisées.
"""

import hashlib
import re
from typing import Optional, List, Tuple
from rapidfuzz import fuzz
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from models import AnnonceSource, Bien, StatutBien, TypeBien
from services.scoring import compute_opportunite_mandat
from services.geocoding import geocode_address
from geoalchemy2 import WKTElement


# ── Constantes ────────────────────────────────────────────────────────────────
SEUIL_DISTANCE_METRES = 50       # distance max pour considérer 2 biens identiques
SEUIL_ECART_SURFACE = 0.03       # 3% d'écart max sur la surface
SEUIL_SIMILARITE_TEXTE = 0.85    # Similarité description > 85%


def compute_fingerprint(annonce: dict) -> str:
    """
    Calcule un fingerprint de l'annonce pour la déduplication exacte.
    Basé sur : adresse normalisée + surface arrondie + type.
    """
    adresse = normalize_adresse(annonce.get("adresse", ""))
    surface = round(float(annonce.get("surface", 0) or 0) / 5) * 5  # arrondi à 5m²
    type_bien = (annonce.get("type_bien") or "").lower()
    commune = (annonce.get("commune") or "").lower().strip()

    fingerprint_str = f"{adresse}|{surface}|{type_bien}|{commune}"
    return hashlib.sha256(fingerprint_str.encode()).hexdigest()[:16]


def normalize_adresse(adresse: str) -> str:
    """Normalise une adresse pour la comparaison."""
    if not adresse:
        return ""
    adresse = adresse.lower().strip()
    # Remplacer les abréviations courantes
    replacements = {
        r"\brue\b": "r",
        r"\bavenue\b": "av",
        r"\bboulevard\b": "bd",
        r"\bplace\b": "pl",
        r"\bimpasse\b": "imp",
        r"\ballee\b": "all",
        r"\bst\b": "saint",
    }
    for pattern, replacement in replacements.items():
        adresse = re.sub(pattern, replacement, adresse)
    # Supprimer les doublons d'espaces et la ponctuation
    adresse = re.sub(r"[^\w\s]", " ", adresse)
    adresse = re.sub(r"\s+", " ", adresse).strip()
    return adresse


async def find_duplicate(
    annonce_data: dict,
    db: AsyncSession
) -> Optional[Bien]:
    """
    Cherche si un bien correspondant existe déjà en base.
    
    Passes :
    1. Fingerprint exact
    2. Même géolocalisation + surface similaire  
    3. Similarité texte (si description disponible)
    
    Returns: Bien existant ou None
    """
    # ── Passe 1 : fingerprint ─────────────────────────────────────────────────
    fingerprint = compute_fingerprint(annonce_data)

    existing_annonce = await db.scalar(
        select(AnnonceSource).where(AnnonceSource.hash_fingerprint == fingerprint)
    )
    if existing_annonce and existing_annonce.bien_id:
        bien = await db.get(Bien, existing_annonce.bien_id)
        if bien:
            logger.debug(f"Dédupliqué par fingerprint : {fingerprint}")
            return bien

    # ── Passe 2 : distance géo + surface ─────────────────────────────────────
    lat = annonce_data.get("latitude")
    lon = annonce_data.get("longitude")
    surface = annonce_data.get("surface")

    if lat and lon and surface:
        query = select(Bien).where(
            and_(
                Bien.statut == StatutBien.en_vente,
                Bien.latitude.isnot(None),
                # Distance < 50m
                func.ST_DWithin(
                    func.ST_Transform(Bien.geom, 3857),
                    func.ST_Transform(
                        func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                        3857
                    ),
                    SEUIL_DISTANCE_METRES
                )
            )
        )
        result = await db.execute(query)
        candidats = result.scalars().all()

        for candidat in candidats:
            if candidat.surface and abs(candidat.surface - surface) / max(surface, 1) <= SEUIL_ECART_SURFACE:
                logger.debug(f"Dédupliqué par géo+surface : {candidat.id}")
                return candidat

    # ── Passe 3 : similarité texte ────────────────────────────────────────────
    description = annonce_data.get("description", "")
    if description and len(description) > 100 and lat and lon:
        # Chercher dans un rayon de 200m
        query = select(Bien, AnnonceSource).join(
            AnnonceSource, AnnonceSource.bien_id == Bien.id
        ).where(
            func.ST_DWithin(
                func.ST_Transform(Bien.geom, 3857),
                func.ST_Transform(
                    func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                    3857
                ),
                200
            )
        ).limit(10)

        result = await db.execute(query)
        rows = result.all()

        for bien, annonce in rows:
            if annonce.description:
                similarite = fuzz.token_sort_ratio(
                    description[:500],
                    annonce.description[:500]
                ) / 100.0

                if similarite >= SEUIL_SIMILARITE_TEXTE:
                    logger.debug(f"Dédupliqué par texte ({similarite:.2f}) : {bien.id}")
                    return bien

    return None


async def create_or_update_bien(
    annonce_data: dict,
    db: AsyncSession,
    portail: str = "unknown",
) -> Tuple[Bien, bool]:
    """
    Crée ou met à jour un bien à partir d'une annonce scrapée.
    
    Returns:
        (Bien, is_new) — bien créé/mis à jour et indicateur de création
    """
    # Chercher un doublon
    existing_bien = await find_duplicate(annonce_data, db)

    if existing_bien:
        # ── Mise à jour du bien existant ──────────────────────────────────────
        _update_bien_from_annonce(existing_bien, annonce_data, portail)
        is_new = False
    else:
        # ── Création d'un nouveau bien ────────────────────────────────────────
        existing_bien = Bien(
            adresse=annonce_data.get("adresse"),
            commune=annonce_data.get("commune"),
            code_postal=annonce_data.get("code_postal"),
            type_bien=_normalize_type(annonce_data.get("type_bien")),
            surface=annonce_data.get("surface"),
            nb_pieces=annonce_data.get("nb_pieces"),
            nb_chambres=annonce_data.get("nb_chambres"),
            annee_construction=annonce_data.get("annee_construction"),
            statut=StatutBien.en_vente,
            agences=[annonce_data.get("agence_nom")] if annonce_data.get("agence_nom") else [],
        )

        # Prix
        prix = annonce_data.get("prix")
        if prix:
            existing_bien.prix_median = prix
            existing_bien.prix_min = prix
            existing_bien.prix_max = prix
            if annonce_data.get("surface"):
                existing_bien.prix_m2 = round(prix / annonce_data["surface"], 0)

        # Localisation
        lat = annonce_data.get("latitude")
        lon = annonce_data.get("longitude")

        # Géocodage si coordonnées manquantes
        if not lat or not lon:
            adresse_full = f"{annonce_data.get('adresse', '')}, {annonce_data.get('code_postal', '')} {annonce_data.get('commune', '')}"
            coords = await geocode_address(adresse_full)
            if coords:
                lat, lon = coords

        existing_bien.latitude = lat
        existing_bien.longitude = lon
        if lat and lon:
            existing_bien.geom = WKTElement(f"POINT({lon} {lat})", srid=4326)

        # Score
        existing_bien.score_opportunite_mandat = compute_opportunite_mandat(existing_bien)

        db.add(existing_bien)
        is_new = True

    # ── Enregistrer l'annonce source ──────────────────────────────────────────
    annonce_src = AnnonceSource(
        bien_id=existing_bien.id if not is_new else None,  # sera mis à jour après flush
        portail=portail,
        url_source=annonce_data.get("url"),
        prix_affiche=annonce_data.get("prix"),
        titre=annonce_data.get("titre"),
        description=annonce_data.get("description"),
        surface_brute=annonce_data.get("surface"),
        nb_pieces_brut=annonce_data.get("nb_pieces"),
        type_bien_brut=annonce_data.get("type_bien"),
        adresse_brute=annonce_data.get("adresse"),
        commune_brute=annonce_data.get("commune"),
        code_postal_brut=annonce_data.get("code_postal"),
        agence_nom=annonce_data.get("agence_nom"),
        hash_fingerprint=compute_fingerprint(annonce_data),
        dedup_confiance=1.0 if not existing_bien else 0.9,
    )

    db.add(annonce_src)

    # Flush pour obtenir les IDs
    await db.flush()

    if is_new:
        annonce_src.bien_id = existing_bien.id

    return existing_bien, is_new


def _update_bien_from_annonce(bien: Bien, data: dict, portail: str):
    """Met à jour un bien existant avec les données d'une nouvelle annonce."""
    # Mise à jour de la plage de prix
    prix = data.get("prix")
    if prix and prix > 0:
        if not bien.prix_min or prix < bien.prix_min:
            bien.prix_min = prix
        if not bien.prix_max or prix > bien.prix_max:
            bien.prix_max = prix
        # Recalculer le médian (simplifié : moyenne des extremes)
        bien.prix_median = (bien.prix_min + bien.prix_max) // 2

    # Ajouter l'agence si nouvelle
    agence = data.get("agence_nom")
    if agence and (not bien.agences or agence not in bien.agences):
        bien.agences = (bien.agences or []) + [agence]

    # Recalculer le score d'opportunité
    bien.score_opportunite_mandat = compute_opportunite_mandat(bien)


def _normalize_type(type_str: Optional[str]) -> Optional[TypeBien]:
    if not type_str:
        return TypeBien.autre
    t = type_str.lower()
    if "appart" in t:
        return TypeBien.appartement
    if "maison" in t or "villa" in t or "pavillon" in t:
        return TypeBien.maison
    if "terrain" in t:
        return TypeBien.terrain
    if "commerce" in t or "local" in t:
        return TypeBien.commerce
    if "bureau" in t or "bureau" in t:
        return TypeBien.bureau
    if "parking" in t or "garage" in t:
        return TypeBien.parking
    return TypeBien.autre
