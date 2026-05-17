"""
Modèles de données principaux.

Architecture :
- Bien          : entité canonique (après déduplication)
- AnnonceSource : annonce brute par portail (plusieurs → 1 bien)
- DPERecord     : diagnostics énergie ADEME
- DVFTransaction: ventes réelles (données gouv)
- PrixHistorique: suivi de prix dans le temps
"""

import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date,
    Text, ForeignKey, Enum as SAEnum, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from database import Base
import enum


# ── Enums ─────────────────────────────────────────────────────────────────
class TypeBien(str, enum.Enum):
    appartement = "appartement"
    maison = "maison"
    terrain = "terrain"
    commerce = "commerce"
    bureau = "bureau"
    parking = "parking"
    autre = "autre"


class ClasseDPE(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    F = "F"
    G = "G"
    NC = "NC"


class StatutBien(str, enum.Enum):
    en_vente = "en_vente"
    vendu = "vendu"
    retire = "retire"


# ── Bien canonique ──────────────────────────────────────────────────────────
class Bien(Base):
    """
    Entité unique représentant un bien immobilier réel,
    après fusion/déduplication de toutes ses annonces.
    """
    __tablename__ = "biens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Localisation
    adresse = Column(String(500))
    commune = Column(String(100), index=True)
    code_postal = Column(String(10), index=True)
    departement = Column(String(5), index=True)
    quartier = Column(String(100))
    # Point géographique PostGIS (lon, lat en WGS84)
    geom = Column(Geometry("POINT", srid=4326))
    latitude = Column(Float)
    longitude = Column(Float)

    # Caractéristiques
    type_bien = Column(SAEnum(TypeBien), index=True)
    surface = Column(Float)                    # m²
    surface_terrain = Column(Float)            # m² (maisons)
    nb_pieces = Column(Integer)
    nb_chambres = Column(Integer)
    nb_sdb = Column(Integer)
    etage = Column(Integer)
    nb_etages = Column(Integer)
    annee_construction = Column(Integer)
    ascenseur = Column(Boolean)
    parking = Column(Boolean)
    cave = Column(Boolean)
    balcon = Column(Boolean)
    terrasse = Column(Boolean)

    # Prix consolidés (agrégat de toutes les sources)
    prix_min = Column(Integer)                 # € FAI
    prix_max = Column(Integer)
    prix_median = Column(Integer)
    prix_m2 = Column(Float)

    # DPE
    classe_dpe = Column(SAEnum(ClasseDPE), index=True)
    dpe_consommation = Column(Float)           # kWh/m²/an
    dpe_emission = Column(Float)               # kgCO2/m²/an
    dpe_date = Column(Date)

    # Statut & timing
    statut = Column(SAEnum(StatutBien), default=StatutBien.en_vente, index=True)
    date_premiere_mise_en_vente = Column(DateTime)
    date_derniere_mise_a_jour = Column(DateTime)
    jours_sur_marche = Column(Integer, default=0)
    nb_baisses_prix = Column(Integer, default=0)

    # Scoring
    score_probabilite_vente = Column(Float, default=0.0)   # 0-1
    score_opportunite_mandat = Column(Float, default=0.0)  # 0-1

    # Agences mandataires détectées
    agences = Column(JSONB, default=list)       # ["Agence A", "Agence B"]

    # Relations
    annonces = relationship("AnnonceSource", back_populates="bien", cascade="all, delete-orphan")
    prix_historique = relationship("PrixHistorique", back_populates="bien", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_biens_commune_type", "commune", "type_bien"),
        Index("idx_biens_score", "score_probabilite_vente"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "adresse": self.adresse,
            "commune": self.commune,
            "code_postal": self.code_postal,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "type_bien": self.type_bien,
            "surface": self.surface,
            "nb_pieces": self.nb_pieces,
            "prix_median": self.prix_median,
            "prix_m2": self.prix_m2,
            "classe_dpe": self.classe_dpe,
            "statut": self.statut,
            "jours_sur_marche": self.jours_sur_marche,
            "nb_baisses_prix": self.nb_baisses_prix,
            "score_probabilite_vente": self.score_probabilite_vente,
            "score_opportunite_mandat": self.score_opportunite_mandat,
            "agences": self.agences or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ── Annonce source (brute) ──────────────────────────────────────────────────
class AnnonceSource(Base):
    """
    Annonce brute telle que scrapée depuis un portail.
    Plusieurs annonces peuvent être fusionnées vers le même Bien.
    """
    __tablename__ = "annonces_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bien_id = Column(UUID(as_uuid=True), ForeignKey("biens.id"), nullable=True, index=True)

    # Source
    portail = Column(String(50), nullable=False, index=True)  # 'seloger', 'leboncoin', 'pap', etc.
    url_source = Column(Text, unique=True)
    reference_externe = Column(String(200))                   # ref interne au portail

    # Prix affiché sur ce portail
    prix_affiche = Column(Integer)
    prix_hono_inclus = Column(Boolean, default=True)

    # Données brutes
    titre = Column(String(500))
    description = Column(Text)
    photos_urls = Column(JSONB, default=list)
    photos_hashes = Column(JSONB, default=list)               # hashes perceptuels

    # Caractéristiques brutes
    surface_brute = Column(Float)
    nb_pieces_brut = Column(Integer)
    type_bien_brut = Column(String(100))
    adresse_brute = Column(String(500))
    commune_brute = Column(String(100))
    code_postal_brut = Column(String(10))
    latitude_brute = Column(Float)
    longitude_brute = Column(Float)

    # Agence
    agence_nom = Column(String(200))
    agence_telephone = Column(String(50))

    # Timing
    date_scraping = Column(DateTime, default=datetime.utcnow, index=True)
    date_publication = Column(DateTime)
    date_derniere_maj = Column(DateTime)
    actif = Column(Boolean, default=True, index=True)

    # Déduplication
    hash_fingerprint = Column(String(64), index=True)         # signature unique
    dedup_confiance = Column(Float)                            # 0-1, confiance de la fusion

    bien = relationship("Bien", back_populates="annonces")

    __table_args__ = (
        UniqueConstraint("portail", "url_source", name="uq_portail_url"),
        Index("idx_annonces_hash", "hash_fingerprint"),
    )


# ── Historique des prix ──────────────────────────────────────────────────────
class PrixHistorique(Base):
    __tablename__ = "prix_historique"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bien_id = Column(UUID(as_uuid=True), ForeignKey("biens.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    prix = Column(Integer, nullable=False)
    source = Column(String(50))

    bien = relationship("Bien", back_populates="prix_historique")

    __table_args__ = (
        UniqueConstraint("bien_id", "date", "source", name="uq_prix_date_source"),
    )


# ── DPE ADEME ───────────────────────────────────────────────────────────────
class DPERecord(Base):
    """
    Diagnostic de performance énergétique.
    Source : API ADEME (données publiques).
    """
    __tablename__ = "dpe_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bien_id = Column(UUID(as_uuid=True), ForeignKey("biens.id"), nullable=True, index=True)

    # Identifiant ADEME
    numero_dpe = Column(String(50), unique=True, index=True)
    date_etablissement = Column(Date, index=True)
    date_fin_validite = Column(Date)

    # Localisation
    adresse = Column(String(500))
    code_postal = Column(String(10), index=True)
    commune = Column(String(100), index=True)
    geom = Column(Geometry("POINT", srid=4326))
    latitude = Column(Float)
    longitude = Column(Float)

    # Bien
    type_batiment = Column(String(100))
    surface_habitable = Column(Float)
    annee_construction = Column(Integer)
    nb_logements = Column(Integer, default=1)

    # Performance énergétique
    classe_conso_energie = Column(SAEnum(ClasseDPE), index=True)
    consommation_energie = Column(Float)     # kWh/m²/an
    classe_estimation_ges = Column(SAEnum(ClasseDPE))
    estimation_ges = Column(Float)           # kgCO2/m²/an

    # Chauffage
    type_chauffage = Column(String(200))
    energie_chauffage = Column(String(100))

    # Scoring propriétaire
    score_vente_probable = Column(Float, default=0.0)     # 0-1
    score_priorite_contact = Column(Integer, default=0)   # 1-5

    # Traitement
    traite = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("idx_dpe_geom", "geom", postgresql_using="gist"),
        Index("idx_dpe_date_commune", "date_etablissement", "commune"),
        Index("idx_dpe_classe", "classe_conso_energie"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "numero_dpe": self.numero_dpe,
            "date_etablissement": self.date_etablissement.isoformat() if self.date_etablissement else None,
            "adresse": self.adresse,
            "code_postal": self.code_postal,
            "commune": self.commune,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "type_batiment": self.type_batiment,
            "surface_habitable": self.surface_habitable,
            "classe_conso_energie": self.classe_conso_energie,
            "consommation_energie": self.consommation_energie,
            "classe_estimation_ges": self.classe_estimation_ges,
            "score_vente_probable": self.score_vente_probable,
            "score_priorite_contact": self.score_priorite_contact,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── DVF Transaction ──────────────────────────────────────────────────────────
class DVFTransaction(Base):
    """
    Vente immobilière réelle.
    Source : Demandes de Valeurs Foncières (data.gouv.fr).
    """
    __tablename__ = "dvf_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identifiant source
    id_mutation = Column(String(50), index=True)
    date_mutation = Column(Date, nullable=False, index=True)

    # Localisation
    adresse_numero = Column(String(20))
    adresse_nom_voie = Column(String(200))
    adresse_code_voie = Column(String(10))
    code_postal = Column(String(10), index=True)
    commune = Column(String(100), index=True)
    code_commune = Column(String(10), index=True)
    code_departement = Column(String(5), index=True)
    geom = Column(Geometry("POINT", srid=4326))
    latitude = Column(Float)
    longitude = Column(Float)

    # Transaction
    valeur_fonciere = Column(Float, nullable=False)    # € (prix réel de vente)
    nature_mutation = Column(String(100))

    # Bien
    type_local = Column(String(100))
    surface_reelle_bati = Column(Float)
    nombre_pieces_principales = Column(Integer)
    surface_terrain = Column(Float)

    prix_m2 = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_dvf_geom", "geom", postgresql_using="gist"),
        Index("idx_dvf_commune_date", "commune", "date_mutation"),
        Index("idx_dvf_mutation", "id_mutation"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "date_mutation": self.date_mutation.isoformat() if self.date_mutation else None,
            "commune": self.commune,
            "code_postal": self.code_postal,
            "adresse": f"{self.adresse_numero or ''} {self.adresse_nom_voie or ''}".strip(),
            "latitude": self.latitude,
            "longitude": self.longitude,
            "valeur_fonciere": self.valeur_fonciere,
            "type_local": self.type_local,
            "surface_reelle_bati": self.surface_reelle_bati,
            "nombre_pieces_principales": self.nombre_pieces_principales,
            "prix_m2": self.prix_m2,
        }
