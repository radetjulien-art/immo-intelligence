"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ArrowRight, Zap, TrendingUp, Home, BarChart2, AlertTriangle, Clock, CheckCircle2, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const CITY = process.env.NEXT_PUBLIC_PILOT_CITY || "Nantes";

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ["global-stats"], queryFn: () => apiClient.getGlobalStats() });
  const { data: dpeStats } = useQuery({ queryKey: ["dpe-stats", CITY], queryFn: () => apiClient.getDPEStats(CITY) });
  const { data: prixMedian } = useQuery({ queryKey: ["prix-median", CITY], queryFn: () => apiClient.getPrixMedian(CITY, undefined) });

  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";

  const dpeCount   = stats?.dpe_records ?? 0;
  const dvfCount   = stats?.transactions_dvf ?? 0;
  const biensCount = stats?.biens_en_vente ?? 0;
  const urgentDpe  = dpeStats?.repartition?.filter((d: { classe: string }) => ["F","G"].includes(d.classe))?.reduce((a: number, d: { nb: number }) => a + d.nb, 0) ?? 0;
  const prix       = prixMedian?.prix_m2?.median;

  return (
    <div className="min-h-screen" style={{ background: "var(--ivory)" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-400)" }}>
              {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="font-display mt-1" style={{ fontSize: "2rem", fontWeight: 600, color: "var(--text-900)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {greeting} — <span style={{ color: "var(--blue)" }}>vue du marché</span>
            </h1>
            <p className="mt-1.5" style={{ fontSize: "13px", color: "var(--text-400)" }}>
              Zone pilote · <strong style={{ color: "var(--text-700)" }}>{CITY}</strong> · données actualisées automatiquement
            </p>
          </div>
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
            style={{ background: "var(--white)", border: "1px solid var(--stone-100)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="live-dot" />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-600)" }}>En direct</span>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8 space-y-6">

        {/* ── KPIs ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <KPI
            label="Leads DPE urgents"
            value={urgentDpe > 0 ? urgentDpe : null}
            unit="propriétaires"
            sub="DPE F & G — à contacter"
            href="/dpe"
            accentColor="var(--red)"
            accentBg="var(--red-50)"
            icon={<Zap size={14} />}
            urgent={urgentDpe > 0}
          />
          <KPI
            label="Prix médian / m²"
            value={prix ? Math.round(prix) : null}
            unit="€/m²"
            sub="toutes transactions"
            href="/dvf"
            accentColor="var(--blue)"
            accentBg="var(--blue-50)"
            icon={<TrendingUp size={14} />}
          />
          <KPI
            label="Transactions DVF"
            value={dvfCount > 0 ? dvfCount : null}
            unit="ventes"
            sub="3 dernières années"
            href="/dvf"
            accentColor="var(--emerald)"
            accentBg="var(--emerald-50)"
            icon={<BarChart2 size={14} />}
          />
          <KPI
            label="Diagnostics DPE"
            value={dpeCount > 0 ? dpeCount : null}
            unit="diagnostics"
            sub="base ADEME indexée"
            href="/dpe"
            accentColor="#7C3AED"
            accentBg="#F5F3FF"
            icon={<Home size={14} />}
          />
        </div>

        {/* ── 2 colonnes ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-4">

          {/* Répartition DPE — 3 cols */}
          <div className="col-span-3 card p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="section-title">Répartition des diagnostics DPE</div>
                <div className="section-sub">{CITY} · {dpeCount.toLocaleString("fr-FR")} diagnostics indexés</div>
              </div>
              <Link href="/dpe" className="btn btn-ghost" style={{ fontSize: "12px" }}>
                Voir les leads <ArrowUpRight size={12} />
              </Link>
            </div>

            {dpeStats?.repartition ? (
              <div className="space-y-3.5">
                {dpeStats.repartition.map((d: { classe: string; nb: number; pct: number; prioritaire: boolean }) => (
                  <div key={d.classe} className="flex items-center gap-3">
                    <span className={`dpe-badge dpe-${d.classe}`}>{d.classe}</span>
                    <div className="flex-1">
                      <div className="progress">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.max(d.pct, 2)}%`,
                            background: d.prioritaire
                              ? "linear-gradient(90deg, #DC2626, #F97316)"
                              : "linear-gradient(90deg, #2563EB, #10B981)",
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3" style={{ minWidth: "80px", justifyContent: "flex-end" }}>
                      <span className="font-mono font-semibold" style={{ fontSize: "13px", color: "var(--text-700)" }}>{d.nb.toLocaleString()}</span>
                      <span className="font-mono" style={{ fontSize: "11px", color: "var(--text-400)", minWidth: "32px", textAlign: "right" }}>{d.pct}%</span>
                    </div>
                    {d.prioritaire && <span className="tag tag-red">Urgent</span>}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock icon="⚡" text="Synchronisation DPE à effectuer" />
            )}
          </div>

          {/* Actions prioritaires — 2 cols */}
          <div className="col-span-2 card p-6">
            <div className="mb-5">
              <div className="section-title">Actions prioritaires</div>
              <div className="section-sub">Ce que vous devriez faire aujourd'hui</div>
            </div>
            <div className="space-y-2">
              <ActionRow href="/dpe" color="#DC2626" bg="#FEF2F2" icon={<AlertTriangle size={14} />} title="Leads DPE F/G" sub="Obligation de rénovation" badge={urgentDpe > 0 ? `${urgentDpe}` : undefined} />
              <ActionRow href="/market" color="#D97706" bg="#FFFBEB" icon={<Clock size={14} />} title="Biens stagnants" sub="+60j sur le marché" />
              <ActionRow href="/dvf" color="#2563EB" bg="#EFF6FF" icon={<TrendingUp size={14} />} title="Prix réels DVF" sub={dvfCount > 0 ? `${dvfCount.toLocaleString()} transactions` : "À charger"} />
              <ActionRow href="/market" color="#059669" bg="#ECFDF5" icon={<BarChart2 size={14} />} title="Baisses de prix" sub="Signaux de la semaine" />
            </div>
          </div>
        </div>

        {/* ── Résumé base de données ─────────────────────────────────────── */}
        <div className="surface p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <DBStat label="Transactions DVF" value={dvfCount.toLocaleString("fr-FR")} color="var(--green-600)" />
              <div style={{ width: 1, height: 28, background: "var(--border)" }} />
              <DBStat label="Diagnostics DPE" value={dpeCount.toLocaleString("fr-FR")} color="var(--blue-600)" />
              <div style={{ width: 1, height: 28, background: "var(--border)" }} />
              <DBStat label="Biens indexés" value={biensCount.toLocaleString("fr-FR")} color="var(--gray-700)" />
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} style={{ color: "var(--green-600)" }} />
              <span style={{ fontSize: "12px", color: "var(--gray-400)", fontWeight: 500 }}>
                Synchronisation automatique · 6h00
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KPI({ label, value, unit, sub, href, accentColor, accentBg, icon, urgent }: {
  label: string; value: number | null; unit: string; sub: string;
  href: string; accentColor: string; accentBg: string;
  icon: React.ReactNode; urgent?: boolean;
}) {
  return (
    <Link href={href} className="card p-5 block group" style={{ position: "relative", overflow: "hidden" }}>
      {urgent && (
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <div className="live-dot" style={{ "--emerald": accentColor } as React.CSSProperties} />
        </div>
      )}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: accentBg, color: accentColor }}
        >
          {icon}
        </div>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>
      <div className="font-display" style={{ fontSize: "2.8rem", fontWeight: 600, color: value ? accentColor : "var(--text-200)", lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value !== null ? value.toLocaleString("fr-FR") : "—"}
      </div>
      <div className="mt-1.5 flex items-end justify-between">
        <div>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-500)" }}>{unit}</span>
          <div style={{ fontSize: "11px", color: "var(--text-400)", marginTop: "2px" }}>{sub}</div>
        </div>
        <ArrowRight size={14} style={{ color: accentColor, opacity: 0.4, transition: "all 0.2s" }} className="group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

/* ── Action row ───────────────────────────────────────────────────────────── */
function ActionRow({ href, color, bg, icon, title, sub, badge }: {
  href: string; color: string; bg: string; icon: React.ReactNode;
  title: string; sub: string; badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-3 rounded-xl group transition-all"
      style={{ border: "1px solid transparent" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--ivory)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--stone-100)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-900)" }}>{title}</div>
        <div style={{ fontSize: "11px", color: "var(--text-400)" }}>{sub}</div>
      </div>
      {badge && (
        <span className="font-mono font-bold px-2 py-0.5 rounded-lg" style={{ fontSize: "12px", background: bg, color }}>
          {badge}
        </span>
      )}
      <ArrowRight size={13} style={{ color: "var(--text-200)" }} className="group-hover:text-slate-400 transition-colors shrink-0" />
    </Link>
  );
}

/* ── DB stat ──────────────────────────────────────────────────────────────── */
function DBStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="kpi-value" style={{ fontSize: "1.5rem", color }}>
        {value || "—"}
      </div>
      <div style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "3px", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function EmptyBlock({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <div style={{ fontSize: "2rem" }}>{icon}</div>
      <p style={{ fontSize: "13px", color: "var(--text-400)" }}>{text}</p>
    </div>
  );
}
