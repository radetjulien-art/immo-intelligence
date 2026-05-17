"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Map, Zap, TrendingUp,
  BarChart2, Settings, Building2
} from "lucide-react";

const NAV = [
  { href: "/",       icon: LayoutDashboard, label: "Tableau de bord" },
  { href: "/map",    icon: Map,             label: "Carte" },
  { href: "/dpe",    icon: Zap,             label: "Leads DPE" },
  { href: "/dvf",    icon: TrendingUp,      label: "Prix réels" },
  { href: "/market", icon: BarChart2,       label: "Marché" },
];

export function Navigation() {
  const path = usePathname();

  return (
    <nav
      className="w-52 flex flex-col h-screen shrink-0"
      style={{ background: "var(--white)", borderRight: "1px solid var(--border)" }}
    >
      {/* ── Logo ───────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--blue-600)", boxShadow: "0 2px 6px rgba(26,86,219,0.3)" }}
          >
            <Building2 size={15} color="white" />
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.01em" }}>
              ImmoIntel
            </div>
            <div style={{ fontSize: "10px", color: "var(--gray-400)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Data · IA
            </div>
          </div>
        </div>
      </div>

      {/* ── Zone pilote ────────────────────────────────────────────────── */}
      <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
          style={{ background: "var(--blue-50)", border: "1px solid var(--blue-100)" }}
        >
          <div className="live-dot shrink-0" />
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)" }}>Nantes — 44000</div>
            <div style={{ fontSize: "10px", color: "var(--gray-500)" }}>Zone pilote active</div>
          </div>
        </div>
      </div>

      {/* ── Nav items ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div
          className="px-2 pb-2"
          style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          Menu
        </div>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
              style={{
                fontSize: "13px",
                fontWeight: active ? 600 : 500,
                color: active ? "var(--blue-600)" : "var(--gray-500)",
                background: active ? "var(--blue-50)" : "transparent",
                borderLeft: `2px solid ${active ? "var(--blue-600)" : "transparent"}`,
                textDecoration: "none",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--gray-50)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Icon
                size={15}
                style={{ color: active ? "var(--blue-600)" : "var(--gray-400)", flexShrink: 0 }}
              />
              {label}
            </Link>
          );
        })}
      </div>

      {/* ── Settings ───────────────────────────────────────────────────── */}
      <div className="px-3 pb-4" style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
          style={{ fontSize: "13px", fontWeight: 500, color: "var(--gray-500)", textDecoration: "none" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--gray-50)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <Settings size={15} style={{ color: "var(--gray-400)", flexShrink: 0 }} />
          Paramètres
        </Link>
      </div>
    </nav>
  );
}
