"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, Bien } from "@/lib/api";
import { useState } from "react";
import clsx from "clsx";
import { Target, TrendingDown, Trophy, MapPin, Clock, BarChart2, ArrowUpRight } from "lucide-react";

const CITY = process.env.NEXT_PUBLIC_PILOT_CITY || "Nantes";

const TABS = [
  { key: "stagnants",   label: "Opportunités mandat", icon: Target,       color: "var(--amber)",   bg: "var(--amber-50)" },
  { key: "baisses",     label: "Baisses de prix",     icon: TrendingDown, color: "var(--red)",     bg: "var(--red-50)" },
  { key: "concurrence", label: "Concurrence",         icon: Trophy,       color: "#7C3AED",        bg: "#F5F3FF" },
];

export default function MarketPage() {
  const [view, setView] = useState<"stagnants"|"baisses"|"concurrence">("stagnants");

  const { data: stagnants } = useQuery({ queryKey: ["stagnants", CITY], queryFn: () => apiClient.getBiensStagnants(CITY), enabled: view==="stagnants" });
  const { data: baisses }   = useQuery({ queryKey: ["baisses",   CITY], queryFn: () => apiClient.getBaissesPrix(CITY),    enabled: view==="baisses" });
  const { data: concurrence }= useQuery({ queryKey: ["part-marche",CITY], queryFn: () => apiClient.getPartMarche(CITY),   enabled: view==="concurrence" });

  const tab = TABS.find(t => t.key === view)!;

  return (
    <div className="min-h-screen" style={{ background: "var(--ivory)" }}>

      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-400)" }}>Analyse</p>
            <h1 className="font-display" style={{ fontSize: "1.9rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-900)", lineHeight: 1.1 }}>
              Marché immobilier — {CITY}
            </h1>
            <p className="mt-1.5" style={{ fontSize: "13px", color: "var(--text-400)" }}>
              Opportunités, signaux et part de marché
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(({ key, label, icon: Icon, color, bg }) => (
            <button
              key={key}
              onClick={() => setView(key as typeof view)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                background: view === key ? "var(--navy)" : "var(--white)",
                color: view === key ? "white" : "var(--text-500)",
                border: `1px solid ${view === key ? "var(--navy)" : "var(--stone-200)"}`,
                boxShadow: view === key ? "0 2px 8px rgba(27,42,74,0.2)" : "var(--shadow-xs)",
              }}
            >
              <Icon size={14} style={{ color: view === key ? "white" : color }} />
              {label}
            </button>
          ))}
        </div>

        {/* Info banner */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "white", border: `1px solid var(--stone-100)` }}>
          <tab.icon size={14} style={{ color: tab.color, flexShrink: 0 }} />
          <p style={{ fontSize: "12px", color: "var(--text-500)", fontWeight: 500 }}>
            {view === "stagnants" && "Biens en vente depuis +60 jours avec baisses de prix — vendeur motivé, mandat fragilisé."}
            {view === "baisses"   && "Biens dont le prix a baissé récemment — signal pour recalibrer vos estimations."}
            {view === "concurrence" && `Part de marché par agence sur ${CITY} — identifiez les concurrents dominants.`}
          </p>
        </div>

        {/* ── Stagnants ─────────────────────────────────────────────── */}
        {view === "stagnants" && (
          !stagnants?.biens?.length
            ? <EmptyState icon="🎯" text="Aucune opportunité détectée pour le moment" />
            : <div className="card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>DPE</th><th>Bien</th><th>Prix</th>
                      <th>Ancienneté</th><th>Baisses</th><th>Score opportunité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stagnants.biens.map((b: Bien & { opportunite_label?: string }) => {
                      const s = b.score_opportunite_mandat || 0;
                      const c = s >= 0.7 ? "var(--red)" : s >= 0.4 ? "var(--amber)" : "var(--emerald)";
                      return (
                        <tr key={b.id} style={{ borderLeft: `3px solid ${c}` }}>
                          <td><span className={`dpe-badge dpe-${b.classe_dpe||"NC"}`}>{b.classe_dpe||"?"}</span></td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: "13px" }}>{b.adresse||"Adresse NC"}</div>
                            <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: "11px", color: "var(--text-400)" }}>
                              <MapPin size={10} />{b.commune} · {b.type_bien} · {b.surface}m²
                            </div>
                          </td>
                          <td><span className="font-mono font-bold" style={{ fontSize: "13px" }}>{b.prix_median ? b.prix_median.toLocaleString("fr-FR")+" €" : "—"}</span></td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} style={{ color: "var(--amber)" }} />
                              <span className="font-mono font-bold" style={{ color: "var(--amber)" }}>{b.jours_sur_marche}j</span>
                            </div>
                          </td>
                          <td><span className="tag tag-red">{b.nb_baisses_prix} baisse(s)</span></td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="progress" style={{ width: "80px" }}>
                                <div className="progress-fill" style={{ width: `${s*100}%`, background: c }} />
                              </div>
                              <span className="font-mono font-bold" style={{ fontSize: "12px", color: c }}>{Math.round(s*100)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        )}

        {/* ── Baisses ───────────────────────────────────────────────── */}
        {view === "baisses" && (
          !baisses?.biens?.length
            ? <EmptyState icon="📉" text="Aucune baisse de prix récente détectée" />
            : <div className="card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr><th>DPE</th><th>Bien</th><th>Prix actuel</th><th>Baisses</th><th>Jours marché</th></tr>
                  </thead>
                  <tbody>
                    {baisses.biens.map((b: Bien) => (
                      <tr key={b.id}>
                        <td><span className={`dpe-badge dpe-${b.classe_dpe||"NC"}`}>{b.classe_dpe||"?"}</span></td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: "13px" }}>{b.adresse||"Adresse NC"}</div>
                          <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: "11px", color: "var(--text-400)" }}>
                            <MapPin size={10} />{b.commune} · {b.type_bien} · {b.surface}m²
                          </div>
                        </td>
                        <td><span className="font-mono font-bold" style={{ fontSize: "13px" }}>{b.prix_median?.toLocaleString("fr-FR")} €</span></td>
                        <td><span className="tag tag-red">{b.nb_baisses_prix}× baisse</span></td>
                        <td><span className="font-mono font-semibold" style={{ color: "var(--amber)" }}>{b.jours_sur_marche}j</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}

        {/* ── Concurrence ───────────────────────────────────────────── */}
        {view === "concurrence" && (
          !concurrence?.agences?.length
            ? <EmptyState icon="🏆" text="Données concurrence à charger" />
            : <div className="card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Agence</th><th>Part de marché</th><th>Mandats</th><th>Prix moyen</th></tr>
                  </thead>
                  <tbody>
                    {concurrence.agences.map((a: { agence: string; nb_mandats: number; part_pct: number; prix_moyen: number }, i: number) => (
                      <tr key={i}>
                        <td>
                          <span className="font-mono font-bold" style={{ fontSize: "14px", color: i===0 ? "var(--amber)" : i===1 ? "#94A3B8" : "#CD7F32" }}>
                            #{i+1}
                          </span>
                        </td>
                        <td><span style={{ fontWeight: 600, fontSize: "13px" }}>{a.agence}</span></td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="progress" style={{ width: "100px" }}>
                              <div className="progress-fill" style={{ width: `${a.part_pct}%`, background: "linear-gradient(90deg, var(--blue), #7C3AED)" }} />
                            </div>
                            <span className="font-mono font-bold" style={{ fontSize: "13px", color: "var(--blue)" }}>{a.part_pct}%</span>
                          </div>
                        </td>
                        <td><span className="font-mono font-semibold" style={{ fontSize: "13px" }}>{a.nb_mandats}</span></td>
                        <td><span className="font-mono" style={{ fontSize: "13px", color: "var(--text-500)" }}>{a.prix_moyen ? a.prix_moyen.toLocaleString("fr-FR")+" €" : "—"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="card p-16 text-center">
      <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>{icon}</div>
      <p style={{ fontWeight: 600, color: "var(--text-700)", fontSize: "15px" }}>{text}</p>
    </div>
  );
}
