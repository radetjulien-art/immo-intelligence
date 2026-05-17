"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useCity } from "@/contexts/CityContext";
import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, TrendingUp, Home, Building, CheckCircle2, AlertCircle } from "lucide-react";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E5DFD8", borderRadius: 4, padding: "12px 16px", boxShadow: "0 4px 16px rgba(24,21,15,0.08)" }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", marginBottom: 8 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 15, color: "#18150F" }}>
          {typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#9C8F83", marginLeft: 6 }}>{p.name === "prix_m2" ? "€/m²" : "ventes"}</span>
        </div>
      ))}
    </div>
  );
};

type SyncResult = { status: string; imported: number; message: string };

export default function DVFPage() {
  const { city } = useCity();
  const [type, setType]         = useState<string | undefined>(undefined);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [lastSync,   setLastSync]   = useState<string | null>(null);

  const { data: prix,     refetch: refetchPrix }      = useQuery({ queryKey: ["prix-median", city, type],  queryFn: () => apiClient.getPrixMedian(city, type) });
  const { data: tendances, refetch: refetchTendances } = useQuery({ queryKey: ["tendances", city],           queryFn: () => apiClient.getTendances(city, 24) });

  const sync = useMutation({
    mutationFn: () => apiClient.syncDVF(city),
    onSuccess: (data: SyncResult) => {
      setSyncResult(data);
      setLastSync(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      refetchPrix();
      refetchTendances();
    },
    onError: () => {
      setSyncResult({ status: "error", imported: 0, message: "Impossible de joindre le backend — vérifiez que le serveur tourne sur :8000" });
    },
  });

  const chart = tendances?.data?.map((d: { mois: string; nb_transactions: number; prix_m2_median: number }) => ({
    mois: d.mois.slice(5), nb: d.nb_transactions, prix_m2: d.prix_m2_median,
  })) || [];

  const FILTERS = [
    { v: undefined,     label: "Tous types",   icon: Building },
    { v: "Appartement", label: "Appartements", icon: Building },
    { v: "Maison",      label: "Maisons",      icon: Home },
  ];

  return (
    <div style={{ padding: "48px 56px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40, flexWrap: "wrap", gap: 20 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Données officielles</p>
          <h1 className="page-title">Prix DVF — {city}</h1>
          <div className="gold-rule" />
          <p style={{ fontSize: 13, color: "#6B6057", marginTop: 8 }}>Demandes de Valeurs Foncières · Source data.gouv.fr</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button onClick={() => { setSyncResult(null); sync.mutate(); }} disabled={sync.isPending} className="btn btn-primary">
            <RefreshCw size={13} className={sync.isPending ? "animate-spin" : ""} />
            {sync.isPending ? "Import en cours…" : "Importer DVF"}
          </button>
          {lastSync && !sync.isPending && (
            <span style={{ fontSize: 11, color: "#9C8F83" }}>Dernière sync : {lastSync}</span>
          )}
        </div>
      </header>

      {/* Résultat sync */}
      {syncResult && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", marginBottom: 20, borderRadius: 4, border: "1px solid", borderColor: syncResult.status === "error" ? "#fecaca" : "#a7f3d0", background: syncResult.status === "error" ? "#fef2f2" : "#ecfdf5", borderLeft: `3px solid ${syncResult.status === "error" ? "#C0392B" : "#059669"}` }}>
          {syncResult.status === "error"
            ? <AlertCircle size={15} color="#C0392B" />
            : <CheckCircle2 size={15} color="#059669" />}
          <span style={{ fontSize: 13, color: "#18150F" }}>{syncResult.message}</span>
          <button onClick={() => setSyncResult(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "#9C8F83", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {FILTERS.map((t) => {
          const active = type === t.v;
          const Icon = t.icon;
          return (
            <button key={t.label} onClick={() => setType(t.v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s", border: "1px solid", borderColor: active ? "#1B2A4A" : "#E5DFD8", background: active ? "#1B2A4A" : "#FFFFFF", color: active ? "#FFFFFF" : "#6B6057" }}>
              <Icon size={13} />{t.label}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#E5DFD8", border: "1px solid #E5DFD8", borderRadius: 4, overflow: "hidden", marginBottom: 28 }}>
        <PrixKPI label="Prix médian / m²" value={prix?.prix_m2?.median} unit="€/m²"  note="12 derniers mois" color="#B8965A" />
        <PrixKPI label="1er quartile"     value={prix?.prix_m2?.q1}     unit="€/m²"  note="25% des ventes"   color="#059669" />
        <PrixKPI label="3e quartile"      value={prix?.prix_m2?.q3}     unit="€/m²"  note="75% des ventes"   color="#1B2A4A" />
        <PrixKPI label="Transactions"     value={prix?.nb_transactions}  unit="ventes" note="12 derniers mois" color="#6B6057" />
      </div>

      {chart.length > 0 ? (
        <>
          <div className="card" style={{ padding: "28px", marginBottom: 20 }}>
            <div style={{ marginBottom: 24 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Évolution des prix</div>
              <div className="section-title">Prix médian / m² sur 24 mois</div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chart} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B8965A" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#B8965A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD8" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#9C8F83", fontFamily: "Inter, sans-serif" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9C8F83", fontFamily: "JetBrains Mono, monospace" }} tickFormatter={(v) => `${v.toLocaleString("fr-FR")}€`} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="prix_m2" stroke="#B8965A" strokeWidth={2} fill="url(#goldGrad)" dot={false} activeDot={{ r: 4, fill: "#B8965A" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ padding: "28px" }}>
            <div style={{ marginBottom: 24 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Volume</div>
              <div className="section-title">Transactions par mois</div>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={chart} barSize={20} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD8" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#9C8F83", fontFamily: "Inter, sans-serif" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9C8F83", fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="nb" fill="#1B2A4A" radius={[2, 2, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: "80px 32px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, background: "#F2EFE9", border: "1px solid #E5DFD8", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={22} color="#B8965A" strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "#18150F", fontSize: 15, marginBottom: 4 }}>Aucune donnée DVF chargée</p>
              <p style={{ fontSize: 13, color: "#6B6057" }}>Cliquez sur <strong>Importer DVF</strong> pour charger les transactions de {city}.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrixKPI({ label, value, unit, note, color }: { label: string; value: number | undefined; unit: string; note: string; color: string }) {
  return (
    <div style={{ background: "#FFFFFF", padding: "24px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", fontFamily: "Inter, sans-serif", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 38, fontWeight: 400, color: value ? color : "#C9BFB4", lineHeight: 1, marginBottom: 6 }}>{value ? value.toLocaleString("fr-FR") : "—"}</div>
      <div style={{ fontSize: 11.5, color: "#9C8F83", fontFamily: "Inter, sans-serif" }}>{unit} · {note}</div>
    </div>
  );
}
