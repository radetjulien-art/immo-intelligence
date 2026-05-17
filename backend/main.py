"""
Immo Intelligence API — Point d'entrée principal
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
import sys

from config import settings
from database import init_db
from routers import biens, dpe, dvf, market, stats


# ── Logging ──────────────────────────────────────────────────────────────────
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - {message}",
    level=settings.log_level,
    colorize=True,
)


# ── Lifecycle ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Démarrage Immo Intelligence ({settings.environment})")
    logger.info(f"📍 Ville pilote : {settings.pilot_city}")
    await init_db()
    yield
    logger.info("🛑 Arrêt de l'application")


# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Immo Intelligence API",
    description="Plateforme SaaS de Data Intelligence Immobilière",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(biens.router,   prefix="/api/biens",   tags=["Biens"])
app.include_router(dpe.router,     prefix="/api/dpe",     tags=["DPE"])
app.include_router(dvf.router,     prefix="/api/dvf",     tags=["DVF"])
app.include_router(market.router,  prefix="/api/market",  tags=["Marché"])
app.include_router(stats.router,   prefix="/api/stats",   tags=["Stats"])


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "version": "0.1.0", "city": settings.pilot_city}


@app.get("/", tags=["System"])
async def root():
    return JSONResponse({
        "name": "Immo Intelligence API",
        "docs": "/docs",
        "health": "/health",
        "pilot_city": settings.pilot_city,
    })
