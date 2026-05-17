"""
Router /api/biens — Radar Marché
Biens en vente, carte, part de marché, biens stagnants
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from typing import Optional
from datetime import datetime, timedelta

from database import get_db
from models import Bien, StatutBien, TypeBien

router = APIRouter()


@router.get("/")
async def list_biens(
    commune: Optional[str] = Query(None, description="Filtrer par commune"),
    type_bien: Optional[str] = Query(None, description="appartement | maison | terrain"),
    prix_min: Optional[int] = Query(None),
    prix_max: Optional[int] = Query(None),
    surface_min: Optional[float] = Query(None),
    surface_max: Optional[float] = Query(None),
    classe_dpe: Optional[str] = Query(None, description="A,B,C,D,E,F,G"),
    jours_marche_min: Optional[int] = Query(None, description="Biens depuis N jours min"),
    stagnants_seulement: bool = Query(False, description="Biens depuis >60j avec baisse de prix"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    rayon_km: float = Query(15.0, description="Rayon de recherche en km"),
    limit: int = Query(200, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste des biens en vente avec filtres.
    Si lat/lon fournis, filtre par rayon géographique.
    """
    query = select(Bien).where(Bien.statut == StatutBien.en_vente)

    # Filtres textuels
    if commune:
        query = query.where(Bien.commune.ilike(f"%{commune}%"))
    if type_bien:
        query = query.where(Bien.type_bien == type_bien)
    if prix_min:
        query = query.where(Bien.prix_median >= prix_min)
    if prix_max:
        query = query.where(Bien.prix_median <= prix_max)
    if surface_min:
        query = query.where(Bien.surface >= surface_min)
    if surface_max:
        query = query.where(Bien.surface <= surface_max)
    if classe_dpe:
        classes = [c.strip() for c in classe_dpe.split(",")]
        query = query.where(Bien.classe_dpe.in_(classes))
    if jours_marche_min:
        query = query.where(Bien.jours_sur_marche >= jours_marche_min)
    if stagnants_seulement:
        query = query.where(
            and_(Bien.jours_sur_marche >= 60, Bien.nb_baisses_prix >= 1)
        )

    # Filtre géographique PostGIS
    if lat and lon:
        rayon_metres = rayon_km * 1000
        query = query.where(
            func.ST_DWithin(
                func.ST_Transform(Bien.geom, 3857),
                func.ST_Transform(
                    func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                    3857
                ),
                rayon_metres
            )
        )

    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Paginer et ordonner
    query = query.order_by(Bien.score_opportunite_mandat.desc(), Bien.updated_at.desc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    biens = result.scalars().all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "biens": [b.to_dict() for b in biens],
    }


@router.get("/map")
async def biens_for_map(
    lat: float = Query(...),
    lon: float = Query(...),
    rayon_km: float = Query(15.0),
    db: AsyncSession = Depends(get_db),
):
    """
    Version allégée pour la carte (seulement les champs nécessaires).
    Retourne max 1000 points pour la performance.
    """
    rayon_metres = rayon_km * 1000
    query = select(
        Bien.id, Bien.latitude, Bien.longitude,
        Bien.prix_median, Bien.surface, Bien.type_bien,
        Bien.classe_dpe, Bien.jours_sur_marche,
        Bien.score_opportunite_mandat, Bien.agences
    ).where(
        and_(
            Bien.statut == StatutBien.en_vente,
            Bien.latitude.isnot(None),
            func.ST_DWithin(
                func.ST_Transform(Bien.geom, 3857),
                func.ST_Transform(
                    func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                    3857
                ),
                rayon_metres
            )
        )
    ).limit(1000)

    result = await db.execute(query)
    rows = result.all()

    return {
        "count": len(rows),
        "features": [
            {
                "id": str(r.id),
                "lat": r.latitude,
                "lon": r.longitude,
                "prix": r.prix_median,
                "surface": r.surface,
                "type": r.type_bien,
                "dpe": r.classe_dpe,
                "jours": r.jours_sur_marche,
                "score": round(r.score_opportunite_mandat or 0, 2),
                "agences": r.agences or [],
            }
            for r in rows
        ],
    }


@router.get("/stagnants")
async def biens_stagnants(
    commune: Optional[str] = Query(None),
    jours_min: int = Query(60, description="Nombre de jours minimum sur le marché"),
    db: AsyncSession = Depends(get_db),
):
    """
    Biens stagnants = opportunités de prise de mandat.
    Vendeur motivé, mandat qui vacille.
    """
    query = select(Bien).where(
        and_(
            Bien.statut == StatutBien.en_vente,
            Bien.jours_sur_marche >= jours_min,
        )
    )
    if commune:
        query = query.where(Bien.commune.ilike(f"%{commune}%"))

    query = query.order_by(Bien.score_opportunite_mandat.desc())
    result = await db.execute(query)
    biens = result.scalars().all()

    return {
        "count": len(biens),
        "biens": [
            {
                **b.to_dict(),
                "opportunite_label": _label_opportunite(b),
            }
            for b in biens
        ],
    }


@router.get("/part-marche")
async def part_marche(
    commune: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Part de marché par agence sur la zone.
    """
    where_clause = "WHERE b.statut = 'en_vente'"
    params = {}
    if commune:
        where_clause += " AND b.commune ILIKE :commune"
        params["commune"] = f"%{commune}%"

    sql = f"""
        SELECT
            agence,
            COUNT(*) as nb_mandats,
            ROUND(AVG(b.prix_median)) as prix_moyen,
            ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as part_pct
        FROM biens b,
             LATERAL jsonb_array_elements_text(b.agences) agence
        {where_clause}
        GROUP BY agence
        ORDER BY nb_mandats DESC
        LIMIT 20
    """
    result = await db.execute(text(sql), params)
    rows = result.fetchall()

    return {
        "commune": commune,
        "agences": [
            {
                "agence": r.agence,
                "nb_mandats": r.nb_mandats,
                "prix_moyen": r.prix_moyen,
                "part_pct": float(r.part_pct),
            }
            for r in rows
        ],
    }


@router.get("/baisses-prix")
async def baisses_prix(
    commune: Optional[str] = Query(None),
    jours: int = Query(30, description="Baisses dans les N derniers jours"),
    db: AsyncSession = Depends(get_db),
):
    """
    Tableau des biens dont le prix a récemment baissé.
    Signal : vendeur sous pression, estimation à recalibrer.
    """
    date_limite = datetime.utcnow() - timedelta(days=jours)
    query = select(Bien).where(
        and_(
            Bien.statut == StatutBien.en_vente,
            Bien.nb_baisses_prix > 0,
            Bien.updated_at >= date_limite,
        )
    )
    if commune:
        query = query.where(Bien.commune.ilike(f"%{commune}%"))

    query = query.order_by(Bien.nb_baisses_prix.desc())
    result = await db.execute(query)
    biens = result.scalars().all()

    return {"count": len(biens), "biens": [b.to_dict() for b in biens]}


@router.get("/{bien_id}")
async def get_bien(bien_id: str, db: AsyncSession = Depends(get_db)):
    bien = await db.get(Bien, bien_id)
    if not bien:
        raise HTTPException(status_code=404, detail="Bien non trouvé")
    return bien.to_dict()


def _label_opportunite(bien: Bien) -> str:
    if bien.jours_sur_marche >= 120 and bien.nb_baisses_prix >= 2:
        return "🔥 Vendeur très motivé"
    if bien.jours_sur_marche >= 90 and bien.nb_baisses_prix >= 1:
        return "⚡ Mandat fragilisé"
    if bien.jours_sur_marche >= 60:
        return "👁️ À surveiller"
    return "Récent"
