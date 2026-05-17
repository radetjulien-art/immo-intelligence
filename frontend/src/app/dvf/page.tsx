"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, TrendingUp, Home, Building, ArrowUp, ArrowDown } from "lucide-react";

const CITY = process.env.NEXT_PUBLIC_PILOT_CITY || "Nantes";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 16px", boxShadow: "var(--shadow-md)", fontSize: "12px" }}>
      <p style={{ fontWeight: 700, color: "var(--gray-400)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "10px" }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: "1rem", fontWeight: 600, color: "var(--gray-900)" }}>
          {typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "var(--gray-400)", marginLeft: "4px" }}>
            {p.name === "prix_m2" ? "€/m²" : "ventes"}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function DVFPage() {
  const [type, setType] = useState<string | undefined>(undefined);

  const { data: prix } = useQuery({ queryKey: ["prix-median", CITY, type], queryFn: () => apiClient.getPrixMedian(CITY, type) });
  const { data: tendances } = useQuery({ queryKey: ["tendances", CITY], queryFn: () => apiClient.getTendances(CITY, 24) });
  const sync = useMutation({ mutationFn: () => apiClient.syncDVF(CITY) });

  const chart = tendances?.data?.map((d: { mois: string; nb_transactions: number; prix_m2_median: number }) => ({
    mois: d.mois.slice(5), nb: d.nb_transactions, prix_m2: d.prix_m2_median,
  })) || [];

  const median = prix?.prix_m2?.median;
  const q1 = prix?.prix_m2?.q1;
  const q3 = prix?.prix_m2?.q3;
  const nbTx = prix?.nb_transactions;

  return (
    <div className="min-h-screen" style={{ background: "var(--ivory)" }}>

      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-400)" }}>Données officielles</p>
            <h1 className="font-display" style={{ fontSize: "1.9rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-900)", lineHeight: 1.1 }}>
              Prix Réels — DVF
            </h1>
            <p className="mt-1.5" style={{ fontSize: "13px", color: "var(--text-400)" }}>
              Demandes de Valeurs Foncières · Source data.gouv.fr · {CITY}
            </p>
          </div>
          <button onClick={() => sync.mutate()} disabled={sync.isPending} className="btn btn-primary">
            <RefreshCw size={14} className={sync.isPending ? "animate-spin" : ""} />
            {sync.isPending ? "Import..." : "Importer DVF"}
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">

        {/* Filtres */}
        <div className="flex gap-2">
          {[
            { v: undefined, label: "Tous types", icon: <Building size={13} /> },
            { v: "Appartement", label: "Appartements", icon: <Building size={13} /> },
            { v: "Maison", label: "Maisons", icon: <Home size={13} /> },
          ].map(t => (
            <button key={t.label} onClick={() => setType(t.v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all"
              style={{
                fontSize: "13px", fontWeight: 600,
                background: type === t.v ? "var(--navy)" : "var(--white)",
                color: type === t.v ? "white" : "var(--text-600)",
                border: "1px solid",
                borderColor: type === t.v ? "var(--navy)" : "var(--stone-200)",
                boxShadow: type === t.v ? "0 2px 8px rgba(27,42,74,0.2)" : "var(--shadow-xs)",
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <PrixKPI label="Prix médian / m²" value={median} suffix="€/m²" sub="12 derniers mois" color="var(--blue)" trend="up" />
          <PrixKPI label="1er quartile (Q1)" value={q1} suffix="€/m²" sub="25% des ventes" color="var(--emerald)" />
          <PrixKPI label="3e quartile (Q3)" value={q3} suffix="€/m²" sub="75% des ventes" color="#7C3AED" />
          <PrixKPI label="Transactions" value={nbTx} suffix="ventes" sub="12 derniers mois" color="var(--text-700)" />
        </div>

        {chart.length > 0 ? (
          <>
            {/* Évolution prix */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="section-title">Évolution du prix médian / m²</div>
                  <div className="section-sub">24 derniers mois · {CITY}</div>
                </div>
                <span className="tag tag-blue">Source DVF officielle</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chart} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "'DM Sans', sans-serif" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "'DM Mono', monospace" }} tickFormatter={v => `${v.toLocaleString("fr-FR")}€`} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="prix_m2" stroke="#2563EB" strokeWidth={2.5} fill="url(#g1)" dot={false} activeDot={{ r: 5, fill: "#2563EB" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Volume */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="section-title">Volume de transactions</div>
                  <div className="section-sub">Nombre de ventes enregistrées par mois</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={chart} barSize={22} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "'DM Sans', sans-serif" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="nb" fill="#10B981" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="card p-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--blue-50)" }}>
                <TrendingUp size={28} style={{ color: "var(--blue)" }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, color: "var(--text-700)", fontSize: "15px" }}>Aucune donnée DVF chargée</p>
                <p style={{ fontSize: "13px", color: "var(--text-400)", marginTop: "4px" }}>
                  Cliquez sur <strong>Importer DVF</strong> pour charger les transactions de {CITY}.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrixKPI({ label, value, suffix, sub, color, trend }: {
  label: string; value: number | undefined; suffix: string; sub: string; color: string; trend?: string;
}) {
  return (
    <div className="card p-5">
      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
        {label}
      </div>
      <div className="kpi-value" style={{ fontSize: "2.2rem", color: value ? color : "var(--gray-200)", lineHeight: 1 }}>
        {value ? value.toLocaleString("fr-FR") : "—"}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-500)" }}>{suffix}</span>
        {trend === "up" && <ArrowUp size={11} style={{ color: "var(--emerald)" }} />}
        {trend === "down" && <ArrowDown size={11} style={{ color: "var(--red)" }} />}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-400)", marginTop: "2px" }}>{sub}</div>
    </div>
  );
}
