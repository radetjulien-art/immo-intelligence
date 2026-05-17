"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, Bien } from "@/lib/api";
import { useCity } from "@/contexts/CityContext";
import { useState } from "react";
import { Target, TrendingDown, Trophy, MapPin, Clock } from "lucide-react";

const TABS = [
  { key: "stagnants",   label: "Opportunités mandat", icon: Target,       accentColor: "#C8810A" },
  { key: "baisses",     label: "Baisses de prix",     icon: TrendingDown, accentColor: "#C0392B" },
  { key: "concurrence", label: "Concurrence",         icon: Trophy,       accentColor: "#1B2A4A" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function MarketPage() {
  const { city } = useCity();
  const [view, setView] = useState<TabKey>("stagnants");

  const { data: stagnants }   = useQuery({ queryKey: ["stagnants",   city], queryFn: () => apiClient.getBiensStagnants(city), enabled: view === "stagnants"   });
  const { data: baisses }     = useQuery({ queryKey: ["baisses",     city], queryFn: () => apiClient.getBaissesPrix(city),    enabled: view === "baisses"     });
  const { data: concurrence } = useQuery({ queryKey: ["part-marche", city], queryFn: () => apiClient.getPartMarche(city),    enabled: view === "concurrence" });

  const currentTab = TABS.find((t) => t.key === view)!;

  return (
    <div style={{ padding: "48px 56px" }}>
      <header style={{ marginBottom: 40 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Analyse</p>
        <h1 className="page-title">Marché — {city}</h1>
        <div className="gold-rule" />
        <p style={{ fontSize: 13, color: "#6B6057", marginTop: 8 }}>Opportunités, signaux et part de marché</p>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 24, borderBottom: "1px solid #E5DFD8", paddingBottom: 0 }}>
        {TABS.map(({ key, label, icon: Icon, accentColor }) => {
          const active = view === key;
          return (
            <button key={key} onClick={() => setView(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", border: "none", background: "transparent", color: active ? "#18150F" : "#6B6057", borderBottom: active ? `2px solid ${accentColor}` : "2px solid transparent", transition: "all 0.15s", marginBottom: -1 }}>
              <Icon size={13} color={active ? accentColor : "#9C8F83"} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Banner */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", background: "#F8F6F2", border: "1px solid #E5DFD8", borderLeft: `3px solid ${currentTab.accentColor}`, borderRadius: 4, marginBottom: 28 }}>
        <currentTab.icon size={14} color={currentTab.accentColor} />
        <p style={{ fontSize: 12.5, color: "#3D3429", fontFamily: "Inter, sans-serif" }}>
          {view === "stagnants"   && "Biens en vente depuis +60 jours avec baisses de prix — vendeur motivé, mandat fragilisé."}
          {view === "baisses"     && "Biens dont le prix a baissé récemment — signal pour recalibrer vos estimations."}
          {view === "concurrence" && `Part de marché par agence sur ${city} — identifiez les concurrents dominants.`}
        </p>
      </div>

      {view === "stagnants" && (!stagnants?.biens?.length ? <EmptyState icon="🎯" text="Aucune opportunité détectée pour le moment" /> : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>DPE</th><th>Bien</th><th>Prix</th><th>Ancienneté</th><th>Baisses</th><th>Score opportunité</th></tr></thead>
            <tbody>
              {stagnants.biens.map((b: Bien) => {
                const s = b.score_opportunite_mandat || 0;
                const c = s >= 0.7 ? "#C0392B" : s >= 0.4 ? "#C8810A" : "#059669";
                return (
                  <tr key={b.id} style={{ borderLeft: `3px solid ${c}` }}>
                    <td><span className={`dpe-badge dpe-${b.classe_dpe || "NC"}`}>{b.classe_dpe || "?"}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#18150F" }}>{b.adresse || "Adresse NC"}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 11.5, color: "#9C8F83" }}><MapPin size={10} />{b.commune} · {b.type_bien} · {b.surface}m²</div>
                    </td>
                    <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 13, color: "#18150F" }}>{b.prix_median ? b.prix_median.toLocaleString("fr-FR") + " €" : "—"}</span></td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={12} color="#C8810A" /><span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#C8810A", fontSize: 13 }}>{b.jours_sur_marche}j</span></div></td>
                    <td><span className="tag tag-red">{b.nb_baisses_prix} baisse(s)</span></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="progress" style={{ width: 72 }}><div className="progress-fill" style={{ width: `${s * 100}%`, background: c }} /></div>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 12, color: c }}>{Math.round(s * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {view === "baisses" && (!baisses?.biens?.length ? <EmptyState icon="📉" text="Aucune baisse de prix récente détectée" /> : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>DPE</th><th>Bien</th><th>Prix actuel</th><th>Baisses</th><th>Jours marché</th></tr></thead>
            <tbody>
              {baisses.biens.map((b: Bien) => (
                <tr key={b.id}>
                  <td><span className={`dpe-badge dpe-${b.classe_dpe || "NC"}`}>{b.classe_dpe || "?"}</span></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#18150F" }}>{b.adresse || "Adresse NC"}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 11.5, color: "#9C8F83" }}><MapPin size={10} />{b.commune} · {b.type_bien} · {b.surface}m²</div>
                  </td>
                  <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 13, color: "#18150F" }}>{b.prix_median?.toLocaleString("fr-FR")} €</span></td>
                  <td><span className="tag tag-red">{b.nb_baisses_prix}× baisse</span></td>
                  <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#C8810A" }}>{b.jours_sur_marche}j</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {view === "concurrence" && (!concurrence?.agences?.length ? <EmptyState icon="🏆" text="Données concurrence à charger" /> : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>#</th><th>Agence</th><th>Part de marché</th><th>Mandats</th><th>Prix moyen</th></tr></thead>
            <tbody>
              {concurrence.agences.map((a: { agence: string; nb_mandats: number; part_pct: number; prix_moyen: number }, i: number) => {
                const medal = ["#C8810A", "#9C8F83", "#B8965A"][i] || "#C9BFB4";
                return (
                  <tr key={i}>
                    <td><span style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 600, fontSize: 16, color: medal }}>#{i + 1}</span></td>
                    <td><span style={{ fontWeight: 600, fontSize: 13, color: "#18150F" }}>{a.agence}</span></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 200 }}>
                        <div className="progress" style={{ flex: 1 }}><div className="progress-fill" style={{ width: `${Math.min(a.part_pct, 100)}%`, background: "#1B2A4A" }} /></div>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 12, color: "#1B2A4A", minWidth: 36 }}>{a.part_pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 13 }}>{a.nb_mandats}</span></td>
                    <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "#6B6057" }}>{a.prix_moyen ? a.prix_moyen.toLocaleString("fr-FR") + " €" : "—"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="card" style={{ padding: "80px 32px", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <p style={{ fontSize: 13.5, color: "#6B6057" }}>{text}</p>
    </div>
  );
}
