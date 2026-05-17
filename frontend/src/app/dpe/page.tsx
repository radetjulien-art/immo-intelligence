"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient, DPELead } from "@/lib/api";
import { useState } from "react";
import { RefreshCw, Download, Filter, MapPin, ArrowUpRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const CITY = process.env.NEXT_PUBLIC_PILOT_CITY || "Nantes";
const LAT  = parseFloat(process.env.NEXT_PUBLIC_PILOT_LAT || "47.2184");
const LON  = parseFloat(process.env.NEXT_PUBLIC_PILOT_LON || "-1.5536");
const CLASSES = ["A", "B", "C", "D", "E", "F", "G"];

export default function DPEPage() {
  const [classes, setClasses] = useState(["E", "F", "G"]);
  const [jours,   setJours]   = useState(90);
  const [score,   setScore]   = useState(0.4);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dpe-leads", classes, jours, score],
    queryFn: () =>
      apiClient.getDPELeads({
        commune:      CITY,
        classes:      classes.join(","),
        jours_recents: jours,
        score_min:    score,
        limit:        200,
      }),
  });

  const sync = useMutation({
    mutationFn: () => apiClient.syncDPE(LAT, LON, 15),
    onSuccess: () => setTimeout(() => refetch(), 3000),
  });

  const toggle = (c: string) =>
    setClasses((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const exportCSV = () => {
    if (!data?.leads) return;
    const rows = data.leads.map((d: DPELead) =>
      [d.adresse||"", d.commune||"", d.code_postal||"", d.classe_conso_energie||"",
       d.surface_habitable||"", d.date_etablissement||"",
       Math.round((d.score_vente_probable||0)*100)+"%", d.priorite_label||""].join(";")
    );
    const csv = ["Adresse;Commune;CP;DPE;Surface;Date;Score;Priorité", ...rows].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob(["﻿"+csv], { type: "text/csv;charset=utf-8;" })),
      download: `leads-dpe-${CITY}-${new Date().toISOString().slice(0,10)}.csv`,
    });
    a.click();
  };

  const urgent = data?.leads?.filter((l: DPELead) => (l.score_priorite_contact||0) >= 4).length ?? 0;

  return (
    <div style={{ padding: "48px 56px" }}>

      {/* ── Header ─────────────────────────────────────── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40, flexWrap: "wrap", gap: 20 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Leads vendeurs</p>
          <h1 className="page-title">{CITY}</h1>
          <div className="gold-rule" />
          <p style={{ fontSize: 13, color: "#6B6057", marginTop: 8 }}>
            <strong style={{ color: "#18150F" }}>{data?.count ?? "—"} propriétaires</strong> identifiés ·{" "}
            <span style={{ color: "#C0392B", fontWeight: 600 }}>{urgent} urgents</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={exportCSV} className="btn btn-white">
            <Download size={13} />Export CSV
          </button>
          <button onClick={() => sync.mutate()} disabled={sync.isPending} className="btn btn-primary">
            <RefreshCw size={13} className={sync.isPending ? "animate-spin" : ""} />
            {sync.isPending ? "Sync..." : "Sync ADEME"}
          </button>
        </div>
      </header>

      {/* ── Filtres ─────────────────────────────────────── */}
      <div className="card" style={{ padding: "18px 24px", marginBottom: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24 }}>
          {/* Classe DPE */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9C8F83" }}>
              <Filter size={12} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Classe DPE</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {CLASSES.map((c) => (
                <button
                  key={c}
                  onClick={() => toggle(c)}
                  className={`dpe-badge dpe-${c}`}
                  style={{ opacity: classes.includes(c) ? 1 : 0.2, cursor: "pointer", border: "none", transition: "opacity 0.15s" }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "#E5DFD8" }} />

          {/* Période */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83" }}>Période</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[30, 60, 90, 180].map((j) => (
                <button
                  key={j}
                  onClick={() => setJours(j)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    transition: "all 0.15s",
                    border: "1px solid",
                    borderColor: jours === j ? "#1B2A4A" : "#E5DFD8",
                    background: jours === j ? "#1B2A4A" : "#FFFFFF",
                    color: jours === j ? "#FFFFFF" : "#6B6057",
                  }}
                >
                  {j}j
                </button>
              ))}
            </div>
          </div>

          {/* Score min */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83" }}>Score min</span>
            <input
              type="range" min="0" max="1" step="0.1" value={score}
              onChange={(e) => setScore(parseFloat(e.target.value))}
              style={{ width: 90, accentColor: "#B8965A" }}
            />
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 13, color: "#B8965A", minWidth: 36 }}>
              {Math.round(score * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Priority legend ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { color: "#C0392B", bg: "#fef2f2", title: "Priorité maximale", desc: "DPE F/G · Interdit à la location dès 2025" },
          { color: "#C8810A", bg: "#fffbeb", title: "Priorité haute",    desc: "DPE E · Loi Climat 2028" },
          { color: "#059669", bg: "#ecfdf5", title: "À surveiller",      desc: "DPE C/D · Probabilité modérée" },
        ].map((l, i) => (
          <div key={i} className="card-flat" style={{ padding: "14px 18px", borderLeft: `3px solid ${l.color}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#18150F", marginBottom: 3 }}>{l.title}</div>
            <div style={{ fontSize: 11.5, color: "#6B6057" }}>{l.desc}</div>
          </div>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 4 }} />
          ))}
        </div>
      ) : !data?.leads?.length ? (
        <div className="card" style={{ padding: "80px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>📭</div>
          <p style={{ fontWeight: 600, color: "#18150F", marginBottom: 4 }}>Aucun lead avec ces critères</p>
          <p style={{ fontSize: 13, color: "#6B6057" }}>Élargissez les filtres ou lancez une synchronisation ADEME.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>DPE</th><th>Adresse</th><th>Surface</th>
                <th>Diagnostic</th><th>Score vente</th><th>Priorité</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((lead: DPELead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeadRow({ lead }: { lead: DPELead }) {
  const s = lead.score_priorite_contact || 0;
  const [color, tagClass] =
    s >= 5 ? ["#C0392B", "tag-red"] : s >= 4 ? ["#C8810A", "tag-amber"] : ["#059669", "tag-green"];
  const pct = Math.round((lead.score_vente_probable || 0) * 100);

  return (
    <tr style={{ borderLeft: `3px solid ${color}` }}>
      <td><span className={`dpe-badge dpe-${lead.classe_conso_energie || "NC"}`}>{lead.classe_conso_energie || "?"}</span></td>
      <td>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#18150F" }}>{lead.adresse || "Adresse non communiquée"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 11.5, color: "#9C8F83" }}>
          <MapPin size={10} />{lead.commune} {lead.code_postal}
        </div>
      </td>
      <td>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 13, color: "#3D3429" }}>
          {lead.surface_habitable ? `${lead.surface_habitable} m²` : "—"}
        </span>
      </td>
      <td>
        <span style={{ fontSize: 12, color: "#6B6057" }}>
          {lead.date_etablissement ? format(parseISO(lead.date_etablissement), "dd MMM yyyy", { locale: fr }) : "—"}
        </span>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="progress" style={{ width: 72 }}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 12, color }}>{pct}%</span>
        </div>
      </td>
      <td><span className={`tag ${tagClass}`}>{lead.priorite_label || "—"}</span></td>
      <td style={{ textAlign: "right" }}>
        <button className="btn btn-ghost btn-sm"><ArrowUpRight size={13} /></button>
      </td>
    </tr>
  );
}
