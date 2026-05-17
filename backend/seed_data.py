"""
Script de seed — insère des données de démo pour Nantes
Lance avec : python seed_data.py
"""
import asyncio
import uuid
from datetime import date, datetime, timedelta
from database import AsyncSessionLocal, init_db
from models import DPERecord, DVFTransaction, ClasseDPE
from geoalchemy2 import WKTElement
import random

# Quartiers de Nantes avec coordonnées approx.
QUARTIERS = [
    ("Centre-ville", 47.2184, -1.5536),
    ("Île de Nantes", 47.2090, -1.5620),
    ("Erdre", 47.2350, -1.5400),
    ("Doulon", 47.2280, -1.5100),
    ("Saint-Félix", 47.2220, -1.5480),
    ("Chantenay", 47.2100, -1.5800),
    ("Bellevue", 47.2050, -1.5700),
    ("Bottière", 47.2150, -1.5200),
]

RUES = [
    "Rue de la Paix", "Boulevard des Martyrs", "Allée des Platanes",
    "Rue du Château", "Avenue de la République", "Rue Victor Hugo",
    "Place Graslin", "Cours des 50 Otages", "Rue Crébillon",
]


async def seed():
    print("🌱 Initialisation de la base...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # ── DPE Records ──────────────────────────────────────────────────
        print("📊 Insertion de 80 DPE...")
        classes = [ClasseDPE.A, ClasseDPE.B, ClasseDPE.C, ClasseDPE.D,
                   ClasseDPE.E, ClasseDPE.F, ClasseDPE.G]
        weights = [5, 10, 20, 25, 20, 12, 8]  # répartition réaliste

        for i in range(80):
            quartier, lat_base, lon_base = random.choice(QUARTIERS)
            lat = lat_base + random.uniform(-0.01, 0.01)
            lon = lon_base + random.uniform(-0.01, 0.01)
            classe = random.choices(classes, weights=weights)[0]
            surface = random.randint(25, 150)
            annee = random.randint(1950, 2020)

            # Consommation selon classe
            conso_map = {
                ClasseDPE.A: random.uniform(20, 50),
                ClasseDPE.B: random.uniform(51, 90),
                ClasseDPE.C: random.uniform(91, 150),
                ClasseDPE.D: random.uniform(151, 230),
                ClasseDPE.E: random.uniform(231, 330),
                ClasseDPE.F: random.uniform(331, 450),
                ClasseDPE.G: random.uniform(451, 600),
            }

            dpe = DPERecord(
                numero_dpe=f"DEMO{i+1:05d}",
                date_etablissement=date.today() - timedelta(days=random.randint(1, 180)),
                date_fin_validite=date.today() + timedelta(days=3650),
                adresse=f"{random.randint(1, 99)} {random.choice(RUES)}",
                code_postal="44000",
                commune="Nantes",
                latitude=lat,
                longitude=lon,
                geom=WKTElement(f"POINT({lon} {lat})", srid=4326),
                type_batiment=random.choice(["Appartement", "Maison"]),
                surface_habitable=float(surface),
                annee_construction=annee,
                classe_conso_energie=classe,
                consommation_energie=round(conso_map[classe], 1),
                classe_estimation_ges=classe,
                estimation_ges=round(conso_map[classe] * 0.06, 1),
                type_chauffage=random.choice(["Individuel", "Collectif"]),
                energie_chauffage=random.choice(["Gaz naturel", "Électricité", "Fioul"]),
                score_vente_probable=round(random.uniform(0.3, 0.95), 2),
                score_priorite_contact=random.randint(1, 5),
            )
            db.add(dpe)

        await db.commit()
        print("  ✅ 80 DPE insérés")

        # ── DVF Transactions ─────────────────────────────────────────────
        print("🏠 Insertion de 150 transactions DVF...")
        for i in range(150):
            quartier, lat_base, lon_base = random.choice(QUARTIERS)
            lat = lat_base + random.uniform(-0.01, 0.01)
            lon = lon_base + random.uniform(-0.01, 0.01)
            surface = random.randint(25, 200)
            type_local = random.choice(["Appartement", "Maison"])
            prix_m2_base = 3800 if type_local == "Appartement" else 3200
            prix_m2 = prix_m2_base + random.randint(-800, 1200)
            valeur = surface * prix_m2

            txn = DVFTransaction(
                id_mutation=f"DEMO-{i+1:05d}",
                date_mutation=date.today() - timedelta(days=random.randint(1, 730)),
                adresse_numero=str(random.randint(1, 99)),
                adresse_nom_voie=random.choice(RUES),
                code_postal="44000",
                commune="Nantes",
                code_commune="44109",
                code_departement="44",
                latitude=lat,
                longitude=lon,
                geom=WKTElement(f"POINT({lon} {lat})", srid=4326),
                valeur_fonciere=float(round(valeur, 0)),
                nature_mutation="Vente",
                type_local=type_local,
                surface_reelle_bati=float(surface),
                nombre_pieces_principales=random.randint(1, 6),
                prix_m2=float(prix_m2),
            )
            db.add(txn)

        await db.commit()
        print("  ✅ 150 transactions DVF insérées")

    print("\n🎉 Seed terminé ! Actualise http://localhost:3000")


if __name__ == "__main__":
    asyncio.run(seed())
