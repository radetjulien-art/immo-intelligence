"""
Router /api/dvf — Prix Réels de Vente
Source : Demandes de Valeurs Foncières (data.gouv.fr)
"""

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from typing import Optional
from datetime import date, timedelta

from database import get_db
from models import DVFTransaction
from scrapers.dvf_fetcher import fetch_dvf_commune

router = APIRouter()


@router.get("/")
async def list_transactions(
    commune: Optional[str] = Query(None),
    code_postal: Optional[str] = Query(None),
    type_local: Optional[str] = Query(None, description="Appartement | Maison"),
    prix_min: Optional[float] = Query(None),
    prix_max: Optional[float] = Query(None),
    surface_min: Optional[float] = Query(None),
    mois: int = Query(24, description="Transactions des N derniers mois"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    rayon_km: float = Query(5.0),
    limit: int = Query(200, le=500),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste des ventes réelles DVF avec filtres.
    Données publiques — prix de vente officiels.
    """
    date_limite = date.today() - timedelta(days=mois * 30)
    query = select(DVFTransaction).where(DVFTransaction.date_mutation >= date_limite)

    if commune:
        query = query.where(DVFTransaction.commune.ilike(f"%{commune}%"))
    if code_postal:
        query = query.where(DVFTransaction.code_postal == code_postal)
    if type_local:
        query = query.where(DVFTransaction.type_local.ilike(f"%{type_local}%"))
    if prix_min:
        query = query.where(DVFTransaction.valeur_fonciere >= prix_min)
    if prix_max:
        query = query.where(DVFTransaction.valeur_fonciere <= prix_max)
    if surface_min:
        query = query.where(DVFTransaction.surface_reelle_bati >= surface_min)

    if lat and lon:
        rayon_metres = rayon_km * 1000
        query = query.where(
            func.ST_DWithin(
                func.ST_Transform(DVFTransaction.geom, 3857),
                func.ST_Transform(
                    func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                    3857
                ),
                rayon_metres
            )
        )

    total_q = select(func.count()).select_from(query.subquery())
    total = await db.scalar(total_q)

    query = query.order_by(DVFTransaction.date_mutation.desc()).limit(limit)
    result = await db.execute(query)
    transactions = result.scalars().all()

    return {
        "total": total,
        "transactions": [t.to_dict() for t in transactions],
    }


@router.get("/prix-median")
async def prix_median(
    commune: str = Query(...),
    type_local: Optional[str] = Query(None),
    mois: int = Query(12),
    db: AsyncSession = Depends(get_db),
):
    """
    Prix médian au m² par commune/type de bien.
    Outil clé pour les rapports d'estimation.
    """
    date_limite = date.today() - timedelta(days=mois * 30)

    conditions = [
        DVFTransaction.commune.ilike(f"%{commune}%"),
        DVFTransaction.date_mutation >= date_limite,
        DVFTransaction.prix_m2.isnot(None),
        DVFTransaction.prix_m2 > 0,
        DVFTransaction.surface_reelle_bati >= 10,
    ]
    if type_local:
        conditions.append(DVFTransaction.type_local.ilike(f"%{type_local}%"))

    query = select(
        func.percentile_cont(0.5).within_group(DVFTransaction.prix_m2).label("median"),
        func.avg(DVFTransaction.prix_m2).label("moyenne"),
        func.min(DVFTransaction.prix_m2).label("min"),
        func.max(DVFTransaction.prix_m2).label("max"),
        func.count().label("nb_transactions"),
        func.percentile_cont(0.25).within_group(DVFTransaction.prix_m2).label("q1"),
        func.percentile_cont(0.75).within_group(DVFTransaction.prix_m2).label("q3"),
    ).where(and_(*conditions))

    result = await db.execute(query)
    row = result.first()

    return {
        "commune": commune,
        "type_local": type_local,
        "periode_mois": mois,
        "prix_m2": {
            "median": round(row.median) if row.median else None,
            "moyenne": round(row.moyenne) if row.moyenne else None,
            "min": round(row.min) if row.min else None,
            "max": round(row.max) if row.max else None,
            "q1": round(row.q1) if row.q1 else None,
            "q3": round(row.q3) if row.q3 else None,
        },
        "nb_transactions": row.nb_transactions,
    }


@router.get("/comparables")
async def comparables(
    lat: float = Query(...),
    lon: float = Query(...),
    surface: float = Query(..., description="Surface du bien à estimer (m²)"),
    type_local: Optional[str] = Query(None),
    rayon_km: float = Query(0.5),
    nb: int = Query(5, description="Nombre de comparables à retourner"),
    mois: int = Query(24),
    db: AsyncSession = Depends(get_db),
):
    """
    Les N ventes les plus proches géographiquement et typologiquement.
    Cœur du module d'estimation automatique.
    """
    date_limite = date.today() - timedelta(days=mois * 30)
    rayon_metres = rayon_km * 1000

    sql = """
        SELECT
            t.*,
            ST_Distance(
                ST_Transform(t.geom, 3857),
                ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 3857)
            ) as distance_m,
            ABS(t.surface_reelle_bati - :surface) / NULLIF(:surface, 0) as ecart_surface
        FROM dvf_transactions t
        WHERE
            t.date_mutation >= :date_limite
            AND t.prix_m2 IS NOT NULL
            AND t.prix_m2 > 0
            AND t.surface_reelle_bati >= 10
            AND ST_DWithin(
                ST_Transform(t.geom, 3857),
                ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 3857),
                :rayon
            )
            {type_filter}
        ORDER BY
            ST_Distance(
                ST_Transform(t.geom, 3857),
                ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 3857)
            ) ASC,
            ecart_surface ASC
        LIMIT :nb
    """.format(
        type_filter="AND t.type_local ILIKE :type_local" if type_local else ""
    )

    params = {
        "lat": lat, "lon": lon,
        "surface": surface,
        "date_limite": date_limite,
        "rayon": rayon_metres,
        "nb": nb,
    }
    if type_local:
        params["type_local"] = f"%{type_local}%"

    result = await db.execute(text(sql), params)
    rows = result.fetchall()

    comparables_list = []
    for r in rows:
        row_dict = dict(r._mapping)
        comparables_list.append({
            "id": str(row_dict.get("id")),
            "date_mutation": str(row_dict.get("date_mutation")),
            "adresse": f"{row_dict.get('adresse_numero', '')} {row_dict.get('adresse_nom_voie', '')}".strip(),
            "commune": row_dict.get("commune"),
            "latitude": row_dict.get("latitude"),
            "longitude": row_dict.get("longitude"),
            "valeur_fonciere": row_dict.get("valeur_fonciere"),
            "surface": row_dict.get("surface_reelle_bati"),
            "prix_m2": round(row_dict.get("prix_m2")) if row_dict.get("prix_m2") else None,
            "type_local": row_dict.get("type_local"),
            "distance_m": round(row_dict.get("distance_m")) if row_dict.get("distance_m") else None,
        })

    # Calcul de l'estimation
    if comparables_list:
        prix_m2_values = [c["prix_m2"] for c in comparables_list if c["prix_m2"]]
        prix_m2_values.sort()
        median_idx = len(prix_m2_values) // 2
        prix_m2_median = prix_m2_values[median_idx] if prix_m2_values else None
        estimation = round(prix_m2_median * surface) if prix_m2_median else None
    else:
        prix_m2_median = None
        estimation = None

    return {
        "point": {"lat": lat, "lon": lon},
        "surface": surface,
        "rayon_km": rayon_km,
        "nb_comparables": len(comparables_list),
        "estimation": {
            "prix_m2_median": prix_m2_median,
            "estimation_basse": round(estimation * 0.95) if estimation else None,
            "estimation_haute": round(estimation * 1.05) if estimation else None,
            "estimation_centrale": estimation,
        },
        "comparables": comparables_list,
    }


@router.post("/sync")
async def sync_dvf(
    commune: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Importe les données DVF pour une commune.
    Attend la fin de l'opération et retourne le nombre de transactions importées.
    """
    count = await fetch_dvf_commune(commune, db)
    return {
        "status": "done",
        "imported": count,
        "message":  f"{count} transactions DVF importées pour {commune}",
    }
