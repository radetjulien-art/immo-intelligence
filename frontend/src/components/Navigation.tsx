"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Zap, TrendingUp, Map, BarChart2, Settings } from "lucide-react";

const PILOT = process.env.NEXT_PUBLIC_PILOT_CITY || "Nantes";

const NAV = [
  { href: "/",        label: "Tableau de bord",  icon: LayoutDashboard },
  { href: "/dpe",     label: "Radar DPE",         icon: Zap },
  { href: "/dvf",     label: "Prix DVF",          icon: TrendingUp },
  { href: "/market",  label: "Marché",            icon: BarChart2 },
  { href: "/map",     label: "Carte",             icon: Map },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: 220,
        minHeight: "100vh",
        background: "#FFFFFF",
        borderRight: "1px solid #E5DFD8",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "28px 24px 24px",
          borderBottom: "1px solid #E5DFD8",
        }}
      >
        <div
          style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: "#18150F",
            lineHeight: 1.1,
          }}
        >
          ImmoIntel
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "Inter, sans-serif",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#B8965A",
          }}
        >
          Intelligence immobilière
        </div>
      </div>

      {/* Zone pilote */}
      <div
        style={{
          margin: "16px 16px 8px",
          padding: "10px 14px",
          background: "#F8F6F2",
          border: "1px solid #E5DFD8",
          borderRadius: 4,
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#9C8F83",
            marginBottom: 3,
          }}
        >
          Zone pilote
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#059669",
              flexShrink: 0,
              boxShadow: "0 0 0 2px rgba(5,150,105,0.2)",
            }}
          />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12.5,
              fontWeight: 500,
              color: "#18150F",
            }}
          >
            {PILOT}
          </span>
        </div>
      </div>

      {/* Navigation items */}
      <div style={{ flex: 1, padding: "8px 0" }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                margin: "2px 8px",
                borderRadius: 4,
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? "#18150F" : "#6B6057",
                background: active ? "#F2EFE9" : "transparent",
                borderLeft: active ? "2px solid #B8965A" : "2px solid transparent",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = "#18150F";
                  (e.currentTarget as HTMLElement).style.background = "#F8F6F2";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = "#6B6057";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
            >
              <Icon
                size={14}
                color={active ? "#B8965A" : "#9C8F83"}
                strokeWidth={active ? 2 : 1.5}
              />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 16px 24px", borderTop: "1px solid #E5DFD8" }}>
        <Link
          href="/settings"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 4,
            fontFamily: "Inter, sans-serif",
            fontSize: 12.5,
            color: "#9C8F83",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#18150F";
            (e.currentTarget as HTMLElement).style.background = "#F8F6F2";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#9C8F83";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <Settings size={13} strokeWidth={1.5} />
          Paramètres
        </Link>
      </div>
    </nav>
  );
}
