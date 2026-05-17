"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Zap, TrendingUp, Map, BarChart2, Settings, MapPin, Search, X, Layers } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useCity, CityState } from "@/contexts/CityContext";

const NAV = [
  { href: "/",         label: "Tableau de bord",  icon: LayoutDashboard },
  { href: "/dpe",      label: "Radar DPE",         icon: Zap },
  { href: "/dvf",      label: "Prix DVF",          icon: TrendingUp },
  { href: "/market",   label: "Marché",            icon: BarChart2 },
  { href: "/cadastre", label: "Cadastre",          icon: Layers },
  { href: "/map",      label: "Carte",             icon: Map },
];

interface GeoCommune {
  nom: string;
  code: string;
  codesPostaux?: string[];
  centre?: { coordinates: [number, number] };
}

export function Navigation() {
  const pathname = usePathname();
  const { city, setCity } = useCity();

  const [searching, setSearching]   = useState(false);
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<GeoCommune[]>([]);
  const [loading, setLoading]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus when search opens
  useEffect(() => {
    if (searching) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searching]);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=centre,code,nom,codesPostaux&type=commune-actuelle&limit=6`
        );
        const data: GeoCommune[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  }, []);

  const pick = (commune: GeoCommune) => {
    const [lon, lat] = commune.centre?.coordinates ?? [0, 0];
    const codePostal = commune.codesPostaux?.[0] ?? "";
    setCity({ city: commune.nom, lat, lon, codeInsee: commune.code, codePostal });
    setSearching(false);
    setQuery("");
    setResults([]);
  };

  const cancel = () => {
    setSearching(false);
    setQuery("");
    setResults([]);
  };

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
      <div style={{ padding: "28px 24px 24px", borderBottom: "1px solid #E5DFD8" }}>
        <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 22, fontWeight: 600, letterSpacing: "0.01em", color: "#18150F", lineHeight: 1.1 }}>
          ImmoIntel
        </div>
        <div style={{ marginTop: 4, fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B8965A" }}>
          Intelligence immobilière
        </div>
      </div>

      {/* Zone pilote / city selector */}
      <div style={{ margin: "16px 16px 8px", position: "relative" }}>
        {!searching ? (
          /* Display mode */
          <button
            onClick={() => setSearching(true)}
            style={{
              width: "100%", padding: "10px 14px", background: "#F8F6F2",
              border: "1px solid #E5DFD8", borderRadius: 4, textAlign: "left",
              cursor: "pointer", transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#C9BFB4"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E5DFD8"; }}
          >
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9C8F83", marginBottom: 5 }}>
              Zone d'analyse
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", flexShrink: 0, boxShadow: "0 0 0 2px rgba(5,150,105,0.2)" }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 500, color: "#18150F" }}>{city}</span>
              </div>
              <Search size={11} color="#9C8F83" />
            </div>
          </button>
        ) : (
          /* Search mode */
          <div style={{ background: "#FFFFFF", border: "1px solid #B8965A", borderRadius: 4, overflow: "visible" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px" }}>
              <Search size={12} color="#B8965A" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder="Rechercher une ville..."
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontFamily: "Inter, sans-serif", fontSize: 12.5, color: "#18150F",
                }}
              />
              <button onClick={cancel} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9C8F83", padding: 0, display: "flex" }}>
                <X size={13} />
              </button>
            </div>

            {/* Dropdown results */}
            {(results.length > 0 || loading) && (
              <div style={{ borderTop: "1px solid #E5DFD8", maxHeight: 200, overflowY: "auto" }}>
                {loading && (
                  <div style={{ padding: "8px 12px", fontSize: 11.5, color: "#9C8F83" }}>Recherche...</div>
                )}
                {results.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => pick(c)}
                    style={{
                      width: "100%", textAlign: "left", padding: "8px 12px",
                      border: "none", background: "transparent", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 12.5, fontFamily: "Inter, sans-serif", color: "#18150F",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F8F6F2"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <MapPin size={11} color="#B8965A" />
                    <span style={{ flex: 1 }}>{c.nom}</span>
                    <span style={{ fontSize: 10, color: "#9C8F83", fontFamily: "JetBrains Mono, monospace" }}>{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: "8px 0" }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
                margin: "2px 8px", borderRadius: 4, fontFamily: "Inter, sans-serif",
                fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? "#18150F" : "#6B6057",
                background: active ? "#F2EFE9" : "transparent",
                borderLeft: active ? "2px solid #B8965A" : "2px solid transparent",
                textDecoration: "none", transition: "all 0.15s ease",
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
              <Icon size={14} color={active ? "#B8965A" : "#9C8F83"} strokeWidth={active ? 2 : 1.5} />
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
            display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            borderRadius: 4, fontFamily: "Inter, sans-serif", fontSize: 12.5,
            color: "#9C8F83", textDecoration: "none",
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
