"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient, DPELead } from "@/lib/api";
import { useState } from "react";
import { RefreshCw, Download, Filter, MapPin, ArrowUpRight, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import clsx from "clsx";

const CITY = process.env.NEXT_PUBLIC_PILOT_CITY || "Nantes";
const LAT  = parseFloat(process.env.NEXT_PUBLIC_PILOT_LAT || "47.2184");
const LON  = parseFloat(process.env.NEXT_PUBLIC_PILOT_LON || "-1.5536");
const CLASSES = ["A","B","C","D","E","F","G"];

export default function DPEPage() {
  const [classes, setClasses] = useState(["E","F","G"]);
  const [jours, setJours]     = useState(90);
  const [score, setScore]     = useState(0.4);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dpe-leads", classes, jours, score],
    queryFn: () => apiClient.getDPELeads({ commune: CITY, classes: classes.join(","), jours_recents: jours, score_min: score, limit: 200 }),
  });

  const sync = useMutation({
    mutationFn: () => apiClient.syncDPE(LAT, LON, 15),
    onSuccess: () => setTimeout(() => refetch(), 3000),
  });

  const toggle = (c: string) => setClasses(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);

  const exportCSV = () => {
    if (!data?.leads) return;
    const rows = data.leads.map((d: DPELead) => [d.adresse||"", d.commune||"", d.code_postal||"", d.classe_conso_energie||"", d.surface_habitable||"", d.date_etablissement||"", Math.round((d.score_vente_probable||0)*100)+"%", d.priorite_label||""].join(";"));
    const csv = ["Adresse;Commune;CP;DPE;Surface;Date;Score;Priorité", ...rows].join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"})), download: `leads-dpe-${CITY}-${new Date().toISOString().slice(0,10)}.csv` });
    a.click();
  };

  const urgent = data?.leads?.filter((l: DPELead) => (l.score_priorite_contact||0) >= 4).length ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--ivory)" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-400)" }}>Leads vendeurs</p>
            <h1 className="font-display" style={{ fontSize: "1.9rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-900)", lineHeight: 1.1 }}>
              Radar DPE — {CITY}
            </h1>
            <p className="mt-1.5" style={{ fontSize: "13px", color: "var(--text-400)" }}>
              <span style={{ color: "var(--text-700)", fontWeight: 600 }}>{data?.count ?? "—"} propriétaires</span> identifiés ·
              <span style={{ color: "var(--red)", fontWeight: 700 }}> {urgent} urgents</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="btn btn-secondary"><Download size={14} />Export CSV</button>
            <button onClick={() => sync.mutate()} disabled={sync.isPending} className="btn btn-primary">
              <RefreshCw size={14} className={sync.isPending ? "animate-spin" : ""} />
              {sync.isPending ? "Sync..." : "Sync ADEME"}
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">

        {/* ── Filtres ─────────────────────────────────────────────────── */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5" style={{ color: "var(--text-400)" }}>
                <Filter size={13} />
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Classe DPE</span>
              </div>
              <div className="flex gap-1.5">
                {CLASSES.map(c => (
                  <button key={c} onClick={() => toggle(c)} className={clsx("dpe-badge transition-all", `dpe-${c}`, !classes.includes(c) && "opacity-20")}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: 1, height: 20, background: "var(--stone-200)" }} />
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-400)" }}>Période</span>
              <div className="flex gap-1">
                {[30,60,90,180].map(j => (
                  <button key={j} onClick={() => setJours(j)}
                    className="px-2.5 py-1 rounded-lg transition-all"
                    style={{
                      fontSize: "12px", fontWeight: 600,
                      background: jours===j ? "var(--navy)" : "var(--stone-50)",
                      color: jours===j ? "white" : "var(--text-500)",
                    }}
                  >{j}j</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-400)" }}>Score min</span>
              <input type="range" min="0" max="1" step="0.1" value={score} onChange={e => setScore(parseFloat(e.target.value))} className="w-24 accent-blue-600" />
              <span className="font-mono font-bold" style={{ fontSize: "13px", color: "var(--blue)", minWidth: "32px" }}>{Math.round(score*100)}%</span>
            </div>
          </div>
        </div>

        {/* ── Légende ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { color: "var(--red)", bg: "var(--red-50)", title: "Priorité maximale", desc: "DPE F/G · Interdit à la location dès 2025" },
            { color: "var(--amber)", bg: "var(--amber-50)", title: "Priorité haute", desc: "DPE E · Loi Climat 2028" },
            { color: "var(--emerald)", bg: "var(--emerald-50)", title: "À surveiller", desc: "DPE C/D · Probabilité modérée" },
          ].map((l, i) => (
            <div key={i} className="card-flat p-3.5 flex items-center gap-3" style={{ borderLeft: `3px solid ${l.color}` }}>
              <AlertTriangle size={14} style={{ color: l.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-800)" }}>{l.title}</div>
                <div style={{ fontSize: "11px", color: "var(--text-400)", marginTop: "1px" }}>{l.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_,i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
          </div>
        ) : !data?.leads?.length ? (
          <div className="card p-16 text-center">
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📭</div>
            <p style={{ fontWeight: 600, color: "var(--text-700)" }}>Aucun lead avec ces critères</p>
            <p style={{ fontSize: "13px", color: "var(--text-400)", marginTop: "4px" }}>Élargissez les filtres ou lancez une synchronisation ADEME.</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>DPE</th>
                  <th>Adresse</th>
                  <th>Surface</th>
                  <th>Diagnostic</th>
                  <th>Score vente</th>
                  <th>Priorité</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((lead: DPELead) => <LeadRow key={lead.id} lead={lead} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadRow({ lead }: { lead: DPELead }) {
  const s = lead.score_priorite_contact || 0;
  const [color, tagClass] = s >= 5 ? ["var(--red)", "tag-red"] : s >= 4 ? ["var(--amber)", "tag-amber"] : ["var(--emerald)", "tag-green"];
  const pct = Math.round((lead.score_vente_probable||0)*100);

  return (
    <tr style={{ borderLeft: `3px solid ${color}` }}>
      <td><span className={`dpe-badge dpe-${lead.classe_conso_energie||"NC"}`}>{lead.classe_conso_energie||"?"}</span></td>
      <td>
        <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-900)" }}>{lead.adresse || "Adresse non communiquée"}</div>
        <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: "11px", color: "var(--text-400)" }}>
          <MapPin size={10} />{lead.commune} {lead.code_postal}
        </div>
      </td>
      <td><span className="font-mono font-semibold" style={{ fontSize: "13px", color: "var(--text-700)" }}>{lead.surface_habitable ? `${lead.surface_habitable} m²` : "—"}</span></td>
      <td>
        <div style={{ fontSize: "12px", color: "var(--text-500)" }}>
          {lead.date_etablissement ? format(parseISO(lead.date_etablissement), "dd MMM yyyy", { locale: fr }) : "—"}
        </div>
        {lead.consommation_energie && (
          <div className="font-mono" style={{ fontSize: "11px", color: "var(--text-400)", marginTop: "1px" }}>
            {Math.round(lead.consommation_energie)} kWh/m²/an
          </div>
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div className="progress" style={{ width: "64px" }}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="font-mono font-bold" style={{ fontSize: "12px", color }}>{pct}%</span>
        </div>
      </td>
      <td><span className={`tag ${tagClass}`}>{lead.priorite_label || "Normal"}</span></td>
      <td>
        {lead.latitude && lead.longitude && (
          <a href={`https://maps.google.com/?q=${lead.latitude},${lead.longitude}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 font-semibold transition-colors"
            style={{ fontSize: "12px", color: "var(--blue)" }}>
            Maps <ArrowUpRight size={11} />
          </a>
        )}
      </td>
    </tr>
  );
}
