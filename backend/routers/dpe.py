"""
Router /api/dpe — Radar DPE (Prospection Vendeurs)
Source : API ADEME publique
"""

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional
from datetime import date, timedelta

from database import get_db
from models import DPERecord, ClasseDPE
from scrapers.dpe_fetcher import fetch_dpe_zone

router = APIRouter()


@router.get("/")
async def list_dpe(
    commune: Optional[str] = Query(None),
    code_postal: Optional[str] = Query(None),
    classes: Optional[str] = Query(None, description="E,F,G — DPE énergivores = priorité"),
    jours_recents: int = Query(90, description="DPE déposés dans les N derniers jours"),
    score_min: float = Query(0.5, description="Score de probabilité de vente minimum"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    rayon_km: float = Query(10.0),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste des nouveaux DPE = leads propriétaires potentiellement en prévente.
    
    Logique : un DPE récent (< 3 mois) = propriétaire qui prépare une vente.
    DPE E/F/G = bien énergivore = vente souvent motivée par les nouvelles lois (2025+).
    """
    date_limite = date.today() - timedelta(days=jours_recents)
    query = select(DPERecord).where(DPERecord.date_etablissement >= date_limite)

    if commune:
        query = query.where(DPERecord.commune.ilike(f"%{commune}%"))
    if code_postal:
        query = query.where(DPERecord.code_postal == code_postal)
    if classes:
        liste_classes = [c.strip().upper() for c in classes.split(",")]
        query = query.where(DPERecord.classe_conso_energie.in_(liste_classes))
    if score_min:
        query = query.where(DPERecord.score_vente_probable >= score_min)

    # Filtre géographique
    if lat and lon:
        rayon_metres = rayon_km * 1000
        query = query.where(
            func.ST_DWithin(
                func.ST_Transform(DPERecord.geom, 3857),
                func.ST_Transform(
                    func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                    3857
                ),
                rayon_metres
            )
        )

    query = query.order_by(
        DPERecord.score_priorite_contact.desc(),
        DPERecord.date_etablissement.desc()
    ).limit(limit)

    result = await db.execute(query)
    dpes = result.scalars().all()

    return {
        "count": len(dpes),
        "filtres": {
            "jours_recents": jours_recents,
            "classes": classes,
            "score_min": score_min,
        },
        "leads": [
            {
                **d.to_dict(),
                "priorite_label": _priorite_label(d),
                "action_recommandee": _action_recommandee(d),
            }
            for d in dpes
        ],
    }


@router.get("/stats")
async def stats_dpe(
    commune: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Répartition des classes DPE sur la zone.
    Permet de comprendre le potentiel de prospection.
    """
    query = select(
        DPERecord.classe_conso_energie,
        func.count().label("nb"),
    )
    if commune:
        query = query.where(DPERecord.commune.ilike(f"%{commune}%"))

    query = query.group_by(DPERecord.classe_conso_energie).order_by(DPERecord.classe_conso_energie)
    result = await db.execute(query)
    rows = result.all()

    total = sum(r.nb for r in rows)
    stats = []
    for r in rows:
        stats.append({
            "classe": r.classe_conso_energie,
            "nb": r.nb,
            "pct": round(100 * r.nb / total, 1) if total else 0,
            "prioritaire": r.classe_conso_energie in ("E", "F", "G"),
        })

    return {"commune": commune, "total": total, "repartition": stats}


@router.post("/sync")
async def sync_dpe(
    background_tasks: BackgroundTasks,
    lat: float = Query(...),
    lon: float = Query(...),
    rayon_km: float = Query(10.0),
    db: AsyncSession = Depends(get_db),
):
    """
    Lance une synchronisation des DPE ADEME en arrière-plan.
    """
    background_tasks.add_task(fetch_dpe_zone, lat, lon, rayon_km, db)
    return {
        "status": "started",
        "message": f"Synchronisation DPE lancée pour zone ({lat}, {lon}) rayon {rayon_km}km",
    }


def _priorite_label(dpe: DPERecord) -> str:
    score = dpe.score_priorite_contact or 0
    if score >= 5:
        return "🔴 Priorité maximale"
    if score >= 4:
        return "🟠 Priorité haute"
    if score >= 3:
        return "🟡 Priorité moyenne"
    return "🟢 À surveiller"


def _action_recommandee(dpe: DPERecord) -> str:
    classe = dpe.classe_conso_energie
    jours = (date.today() - dpe.date_etablissement).days if dpe.date_etablissement else 0

    if classe in ("F", "G") and jours <= 30:
        return "Contacter en urgence — DPE récent énergivore, loi Climat s'applique"
    if classe == "E" and jours <= 60:
        return "Contacter rapidement — bien bientôt concerné par l'interdiction de location"
    if jours <= 90:
        return "Prospecter — DPE récent, vente probable dans 3-6 mois"
    return "Surveiller — DPE ancien, suivi recommandé"
