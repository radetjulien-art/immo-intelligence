import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface Bien {
  id: string;
  adresse?: string;
  commune?: string;
  code_postal?: string;
  latitude?: number;
  longitude?: number;
  type_bien?: string;
  surface?: number;
  nb_pieces?: number;
  prix_median?: number;
  prix_m2?: number;
  classe_dpe?: string;
  statut?: string;
  jours_sur_marche?: number;
  nb_baisses_prix?: number;
  score_probabilite_vente?: number;
  score_opportunite_mandat?: number;
  agences?: string[];
  updated_at?: string;
}

export interface DPELead {
  id: string;
  numero_dpe?: string;
  date_etablissement?: string;
  adresse?: string;
  commune?: string;
  code_postal?: string;
  latitude?: number;
  longitude?: number;
  surface_habitable?: number;
  classe_conso_energie?: string;
  score_vente_probable?: number;
  score_priorite_contact?: number;
  priorite_label?: string;
  action_recommandee?: string;
}

export interface DVFTransaction {
  id: string;
  date_mutation?: string;
  commune?: string;
  adresse?: string;
  latitude?: number;
  longitude?: number;
  valeur_fonciere?: number;
  type_local?: string;
  surface_reelle_bati?: number;
  nombre_pieces_principales?: number;
  prix_m2?: number;
}

export interface MarketBriefing {
  date: string;
  commune?: string;
  highlights: Array<{
    icon: string;
    label: string;
    valeur: number;
    detail: string;
    action: string;
    urgent: boolean;
  }>;
  marche: {
    total_en_vente: number;
  };
}

export interface PrixMedian {
  commune: string;
  type_local?: string;
  periode_mois: number;
  prix_m2: {
    median?: number;
    moyenne?: number;
    min?: number;
    max?: number;
    q1?: number;
    q3?: number;
  };
  nb_transactions: number;
}

// ── API calls ────────────────────────────────────────────────────────────────

export const apiClient = {
  // Marché
  async getBriefing(commune?: string): Promise<MarketBriefing> {
    const { data } = await api.get("/market/briefing", { params: { commune } });
    return data;
  },

  async getTendances(commune: string, mois = 12) {
    const { data } = await api.get("/market/tendances", { params: { commune, mois } });
    return data;
  },

  // Biens
  async getBiensMap(lat: number, lon: number, rayonKm = 15) {
    const { data } = await api.get("/biens/map", {
      params: { lat, lon, rayon_km: rayonKm },
    });
    return data;
  },

  async getBiensList(params: Record<string, unknown> = {}) {
    const { data } = await api.get("/biens/", { params });
    return data;
  },

  async getBiensStagnants(commune?: string) {
    const { data } = await api.get("/biens/stagnants", { params: { commune } });
    return data;
  },

  async getPartMarche(commune?: string) {
    const { data } = await api.get("/biens/part-marche", { params: { commune } });
    return data;
  },

  async getBaissesPrix(commune?: string) {
    const { data } = await api.get("/biens/baisses-prix", { params: { commune } });
    return data;
  },

  // DPE
  async getDPELeads(params: Record<string, unknown> = {}) {
    const { data } = await api.get("/dpe/", { params });
    return data;
  },

  async getDPEStats(commune?: string) {
    const { data } = await api.get("/dpe/stats", { params: { commune } });
    return data;
  },

  async syncDPE(lat: number, lon: number, rayonKm = 10) {
    const { data } = await api.post("/dpe/sync", null, {
      params: { lat, lon, rayon_km: rayonKm },
    });
    return data;
  },

  // DVF
  async getDVFComparables(lat: number, lon: number, surface: number) {
    const { data } = await api.get("/dvf/comparables", {
      params: { lat, lon, surface, rayon_km: 1, nb: 5 },
    });
    return data;
  },

  async getPrixMedian(commune: string, typeBien?: string) {
    const { data } = await api.get("/dvf/prix-median", {
      params: { commune, type_local: typeBien },
    });
    return data;
  },

  async syncDVF(commune: string) {
    const { data } = await api.post("/dvf/sync", null, { params: { commune } });
    return data;
  },

  // Stats
  async getGlobalStats() {
    const { data } = await api.get("/stats/");
    return data;
  },
};
