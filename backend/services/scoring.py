"""
Service de scoring — Probabilité de vente et priorité de contact.

Logique métier :
1. Un DPE récent = propriétaire qui prépare quelque chose (vente probable)
2. DPE F/G = bien interdit à la location en 2028 (pression forte)
3. DPE E = bientôt concerné (2034)
4. Combinaison DPE récent + classe basse = priorité maximale
"""

from datetime import date, timedelta
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from models import DPERecord


# ── Pondérations ──────────────────────────────────────────────────────────────
POIDS_CLASSE = {
    "G": 1.0,
    "F": 0.9,
    "E": 0.7,
    "D": 0.4,
    "C": 0.2,
    "B": 0.1,
    "A": 0.05,
    "NC": 0.3,
}

POIDS_RECENCE = {
    30: 1.0,    # DPE < 30 jours
    60: 0.85,   # DPE < 60 jours
    90: 0.70,   # DPE < 3 mois
    180: 0.50,  # DPE < 6 mois
    365: 0.30,  # DPE < 1 an
    730: 0.10,  # DPE < 2 ans
}

# Loi Climat : calendrier d'interdiction de location
LOI_CLIMAT = {
    "G": 2025,   # déjà interdit (nouveaux contrats)
    "F": 2028,
    "E": 2034,
    "D": 2034,   # pas d'interdiction prévue
}


def compute_dpe_score(dpe) -> dict:
    """
    Calcule le score de probabilité de vente et la priorité de contact.
    
    Returns:
        {
            "score_vente_probable": float 0-1,
            "score_priorite_contact": int 1-5,
            "facteurs": list[str]
        }
    """
    facteurs = []
    score = 0.0

    # ── 1. Score classe énergétique ───────────────────────────────────────────
    classe_str = str(dpe.classe_conso_energie or "NC").upper().replace("CLASSEDPE.", "")
    poids_classe = POIDS_CLASSE.get(classe_str, 0.3)
    score += poids_classe * 0.4  # 40% du score

    if classe_str in ("F", "G"):
        facteurs.append(f"DPE {classe_str} : interdit à la location dès {LOI_CLIMAT.get(classe_str, '2028')}")
    elif classe_str == "E":
        facteurs.append("DPE E : propriétaire peut anticiper la loi Climat 2034")

    # ── 2. Score récence ──────────────────────────────────────────────────────
    jours_ecart = None
    if dpe.date_etablissement:
        jours_ecart = (date.today() - dpe.date_etablissement).days

        poids_recence = 0.05
        for seuil, poids in sorted(POIDS_RECENCE.items()):
            if jours_ecart <= seuil:
                poids_recence = poids
                break

        score += poids_recence * 0.4  # 40% du score

        if jours_ecart <= 30:
            facteurs.append(f"DPE très récent ({jours_ecart}j) → vente imminente")
        elif jours_ecart <= 90:
            facteurs.append(f"DPE récent ({jours_ecart}j) → préparation de vente probable")

    # ── 3. Bonus type de bien ─────────────────────────────────────────────────
    type_bat = str(dpe.type_batiment or "").lower()
    if "appartement" in type_bat:
        score += 0.1  # Plus fréquemment mis en vente
        facteurs.append("Appartement : rotation plus élevée")
    elif "maison" in type_bat:
        score += 0.08

    # ── 4. Bonus surface ──────────────────────────────────────────────────────
    surface = dpe.surface_habitable
    if surface and surface >= 60:
        score += 0.05  # Biens plus grands = vente plus probable
        facteurs.append(f"Surface {surface}m² : ticket élevé")

    # ── 5. Malus DPE invalide/expiré ─────────────────────────────────────────
    if dpe.date_fin_validite and dpe.date_fin_validite < date.today():
        score *= 0.5  # DPE expiré = moins pertinent
        facteurs.append("DPE expiré : fiabilité réduite")

    # ── Normalisation ─────────────────────────────────────────────────────────
    score = min(1.0, max(0.0, score))

    # ── Priorité 1-5 ─────────────────────────────────────────────────────────
    if score >= 0.85:
        priorite = 5
    elif score >= 0.70:
        priorite = 4
    elif score >= 0.55:
        priorite = 3
    elif score >= 0.35:
        priorite = 2
    else:
        priorite = 1

    return {
        "score_vente_probable": round(score, 3),
        "score_priorite_contact": priorite,
        "facteurs": facteurs,
    }


def compute_opportunite_mandat(bien) -> float:
    """
    Score d'opportunité de prise de mandat sur un bien en vente.
    
    Logique : bien stagnant + baisses de prix = vendeur motivé.
    """
    score = 0.0

    # Jours sur le marché
    jours = bien.jours_sur_marche or 0
    if jours >= 120:
        score += 0.4
    elif jours >= 90:
        score += 0.3
    elif jours >= 60:
        score += 0.2
    elif jours >= 30:
        score += 0.1

    # Baisses de prix
    baisses = bien.nb_baisses_prix or 0
    if baisses >= 3:
        score += 0.4
    elif baisses >= 2:
        score += 0.3
    elif baisses >= 1:
        score += 0.2

    # DPE énergivore = pression supplémentaire
    classe = str(bien.classe_dpe or "NC")
    if "F" in classe or "G" in classe:
        score += 0.2
    elif "E" in classe:
        score += 0.1

    return min(1.0, round(score, 3))
