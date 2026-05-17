"""
Router /api/market — Briefing quotidien et données de marché
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from datetime import datetime, timedelta, date
from typing import Optional

from database import get_db
from models import Bien, DVFTransaction, DPERecord, StatutBien

router = APIRouter()


@router.get("/briefing")
async def briefing_quotidien(
    commune: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    rayon_km: float = Query(15.0),
    db: AsyncSession = Depends(get_db),
):
    """
    Briefing quotidien de l'agent — ce qui s'est passé en 24h.
    Feature de rétention #1 : raison de se connecter chaque matin.
    """
    hier = datetime.utcnow() - timedelta(days=1)
    semaine = datetime.utcnow() - timedelta(days=7)

    # Nouveaux biens hier
    q_nouveaux = select(func.count()).where(
        and_(Bien.statut == StatutBien.en_vente, Bien.created_at >= hier)
    )
    nb_nouveaux = await db.scalar(q_nouveaux)

    # Baisses de prix cette semaine
    q_baisses = select(func.count()).where(
        and_(
            Bien.statut == StatutBien.en_vente,
            Bien.nb_baisses_prix > 0,
            Bien.updated_at >= semaine,
        )
    )
    nb_baisses = await db.scalar(q_baisses)

    # Nouveaux DPE hier
    hier_date = date.today() - timedelta(days=1)
    q_dpe = select(func.count()).where(DPERecord.date_etablissement >= hier_date)
    nb_dpe = await db.scalar(q_dpe)

    # Biens stagnants (>60j)
    q_stagnants = select(func.count()).where(
        and_(Bien.statut == StatutBien.en_vente, Bien.jours_sur_marche >= 60)
    )
    nb_stagnants = await db.scalar(q_stagnants)

    # Total biens en vente
    q_total = select(func.count()).where(Bien.statut == StatutBien.en_vente)
    nb_total = await db.scalar(q_total)

    return {
        "date": datetime.utcnow().isoformat(),
        "commune": commune,
        "highlights": [
            {
                "icon": "🆕",
                "label": "Nouveaux biens",
                "valeur": nb_nouveaux,
                "detail": "en vente depuis hier",
                "action": "/biens?jours_marche_max=1",
                "urgent": nb_nouveaux > 5,
            },
            {
                "icon": "📉",
                "label": "Baisses de prix",
                "valeur": nb_baisses,
                "detail": "cette semaine",
                "action": "/biens/baisses-prix",
                "urgent": False,
            },
            {
                "icon": "⚡",
                "label": "Nouveaux leads DPE",
                "valeur": nb_dpe,
                "detail": "DPE déposés hier",
                "action": "/dpe?jours_recents=1",
                "urgent": nb_dpe > 0,
            },
            {
                "icon": "🎯",
                "label": "Opportunités mandat",
                "valeur": nb_stagnants,
                "detail": "biens depuis +60 jours",
                "action": "/biens/stagnants",
                "urgent": nb_stagnants > 10,
            },
        ],
        "marche": {
            "total_en_vente": nb_total,
        },
    }


@router.get("/tendances")
async def tendances(
    commune: str = Query(...),
    mois: int = Query(12),
    db: AsyncSession = Depends(get_db),
):
    """
    Évolution mensuelle des prix et des volumes de transactions.
    """
    sql = """
        SELECT
            DATE_TRUNC('month', date_mutation) as mois,
            COUNT(*) as nb_transactions,
            ROUND(AVG(valeur_fonciere)) as prix_moyen,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix_m2)) as prix_m2_median
        FROM dvf_transactions
        WHERE
            commune ILIKE :commune
            AND date_mutation >= :date_limite
            AND prix_m2 IS NOT NULL
        GROUP BY DATE_TRUNC('month', date_mutation)
        ORDER BY mois ASC
    """
    date_limite = date.today() - timedelta(days=mois * 30)
    result = await db.execute(text(sql), {"commune": f"%{commune}%", "date_limite": date_limite})
    rows = result.fetchall()

    return {
        "commune": commune,
        "periode_mois": mois,
        "data": [
            {
                "mois": str(r.mois)[:7],
                "nb_transactions": r.nb_transactions,
                "prix_moyen": r.prix_moyen,
                "prix_m2_median": r.prix_m2_median,
            }
            for r in rows
        ],
    }
