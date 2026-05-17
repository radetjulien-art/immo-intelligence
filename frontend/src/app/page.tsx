"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import Link from "next/link";
import { Zap, TrendingUp, BarChart2, Map, ArrowRight } from "lucide-react";

const CITY = process.env.NEXT_PUBLIC_PILOT_CITY || "Nantes";

export default function DashboardPage() {
  const { data: stats }   = useQuery({ queryKey: ["global-stats"],        queryFn: () => apiClient.getGlobalStats() });
  const { data: dpeStats } = useQuery({ queryKey: ["dpe-stats", CITY],    queryFn: () => apiClient.getDPEStats(CITY) });
  const { data: prix }    = useQuery({ queryKey: ["prix-median", CITY],   queryFn: () => apiClient.getPrixMedian(CITY, undefined) });

  return (
    <div style={{ padding: "48px 56px", maxWidth: 1200 }}>

      {/* ── Page header ──────────────────────────────────── */}
      <header style={{ marginBottom: 48 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Tableau de bord</p>
        <h1 className="page-title">{CITY}</h1>
        <div className="gold-rule" />
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#6B6057", marginTop: 8 }}>
          Vue d'ensemble du marché immobilier · mise à jour en temps réel
        </p>
      </header>

      {/* ── KPI row ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#E5DFD8", border: "1px solid #E5DFD8", borderRadius: 4, overflow: "hidden", marginBottom: 40 }}>
        <KPI
          label="Biens en vente"
          value={stats?.nb_biens_actifs ?? "—"}
          unit="annonces actives"
          href="/map"
        />
        <KPI
          label="Leads DPE"
          value={dpeStats?.total_leads ?? "—"}
          unit="propriétaires ciblés"
          href="/dpe"
        />
        <KPI
          label="Prix médian"
          value={prix?.prix_median_m2 ? `${Math.round(prix.prix_median_m2).toLocaleString("fr-FR")}` : "—"}
          unit="€ / m² (médian)"
          href="/dvf"
        />
        <KPI
          label="Agences actives"
          value={stats?.nb_agences ?? "—"}
          unit="concurrents identifiés"
          href="/market"
        />
      </div>

      {/* ── Modules grid ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>

        <ModuleCard
          icon={Zap}
          eyebrow="Prospection vendeurs"
          title="Radar DPE"
          description="Identifiez les propriétaires en obligation de rénovation et anticipez les mises en vente."
          stat={dpeStats?.urgents_count}
          statLabel="contacts urgents"
          statColor="#C0392B"
          href="/dpe"
        />

        <ModuleCard
          icon={TrendingUp}
          eyebrow="Analyse de prix"
          title="Prix DVF"
          description="Suivez l'évolution des prix de vente au m² par type de bien sur votre zone."
          stat={prix?.prix_median_m2 ? `${Math.round(prix.prix_median_m2).toLocaleString("fr-FR")} €` : null}
          statLabel="médian / m²"
          statColor="#B8965A"
          href="/dvf"
        />

        <ModuleCard
          icon={BarChart2}
          eyebrow="Veille concurrentielle"
          title="Analyse de marché"
          description="Biens stagnants, baisses de prix récentes et parts de marché par agence."
          stat={stats?.biens_stagnants_count}
          statLabel="biens stagnants"
          statColor="#C8810A"
          href="/market"
        />

        <ModuleCard
          icon={Map}
          eyebrow="Visualisation géo"
          title="Carte interactive"
          description="Explorez les biens, scores DPE et transactions DVF sur la carte."
          stat={null}
          statLabel=""
          statColor="#1B2A4A"
          href="/map"
        />
      </div>

      {/* ── Market snapshot ──────────────────────────────── */}
      {stats && (
        <div className="card" style={{ padding: "28px 32px" }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Snapshot de marché</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            <Stat label="Délai moyen de vente" value={stats.delai_moyen_jours != null ? `${stats.delai_moyen_jours}j` : "—"} />
            <Stat label="Taux de négociation" value={stats.taux_nego != null ? `${stats.taux_nego}%` : "—"} />
            <Stat label="Transactions / 12 mois" value={stats.nb_transactions_annee?.toLocaleString("fr-FR") ?? "—"} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function KPI({ label, value, unit, href }: { label: string; value: string | number; unit: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", background: "#FFFFFF", padding: "28px 24px", transition: "background 0.15s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F8F6F2"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", fontFamily: "Inter, sans-serif", marginBottom: 12 }}>
        {label}
      </div>
      <div className="kpi-number">{value}</div>
      <div className="kpi-unit">{unit}</div>
    </Link>
  );
}

function ModuleCard({ icon: Icon, eyebrow, title, description, stat, statLabel, statColor, href }: {
  icon: typeof Zap; eyebrow: string; title: string; description: string;
  stat: string | number | null | undefined; statLabel: string; statColor: string; href: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="card"
        style={{ padding: "28px", height: "100%", transition: "box-shadow 0.15s, border-color 0.15s", cursor: "pointer" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "#C9BFB4";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(24,21,15,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "#E5DFD8";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(24,21,15,0.06)";
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, background: "#F8F6F2", border: "1px solid #E5DFD8", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={16} color="#B8965A" strokeWidth={1.5} />
          </div>
          <ArrowRight size={14} color="#C9BFB4" />
        </div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>
        <div className="section-title" style={{ marginBottom: 10 }}>{title}</div>
        <p style={{ fontSize: 13, color: "#6B6057", lineHeight: 1.6, marginBottom: stat != null ? 20 : 0 }}>{description}</p>
        {stat != null && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, paddingTop: 16, borderTop: "1px solid #E5DFD8" }}>
            <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26, fontWeight: 500, color: statColor, lineHeight: 1 }}>{stat}</span>
            <span style={{ fontSize: 11.5, color: "#9C8F83", fontFamily: "Inter, sans-serif" }}>{statLabel}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, fontWeight: 400, color: "#18150F" }}>{value}</div>
    </div>
  );
}
