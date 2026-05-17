"""
Router /api/stats — Statistiques globales
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db
from models import Bien, DVFTransaction, DPERecord, StatutBien

router = APIRouter()


@router.get("/")
async def global_stats(db: AsyncSession = Depends(get_db)):
    """Vue d'ensemble de la base de données."""
    nb_biens = await db.scalar(select(func.count(Bien.id)))
    nb_en_vente = await db.scalar(
        select(func.count(Bien.id)).where(Bien.statut == StatutBien.en_vente)
    )
    nb_dvf = await db.scalar(select(func.count(DVFTransaction.id)))
    nb_dpe = await db.scalar(select(func.count(DPERecord.id)))

    return {
        "biens_total": nb_biens,
        "biens_en_vente": nb_en_vente,
        "transactions_dvf": nb_dvf,
        "dpe_records": nb_dpe,
    }
