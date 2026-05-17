"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import { Home, Zap, BarChart2, X } from "lucide-react";

const PILOT_LAT = parseFloat(process.env.NEXT_PUBLIC_PILOT_LAT || "47.2184");
const PILOT_LON = parseFloat(process.env.NEXT_PUBLIC_PILOT_LON || "-1.5536");

const DPE_COLORS: Record<string, string> = {
  A: "#059669", B: "#10b981", C: "#84cc16",
  D: "#eab308", E: "#f97316", F: "#ef4444", G: "#991b1b",
  NC: "#9C8F83",
};

type MapMode = "biens" | "dpe" | "dvf";

const MODES: { key: MapMode; label: string; icon: typeof Home }[] = [
  { key: "biens", label: "Biens en vente", icon: Home },
  { key: "dpe",   label: "Leads DPE",      icon: Zap },
  { key: "dvf",   label: "Ventes DVF",     icon: BarChart2 },
];

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [mode, setMode] = useState<MapMode>("biens");
  const [selectedFeature, setSelectedFeature] = useState<unknown>(null);

  const { data: biensData } = useQuery({
    queryKey: ["biens-map", mode],
    queryFn: () => mode === "biens" ? apiClient.getBiensMap(PILOT_LAT, PILOT_LON, 15) : Promise.resolve(null),
    enabled: mode === "biens",
  });

  const { data: dpeData } = useQuery({
    queryKey: ["dpe-map"],
    queryFn: () => apiClient.getDPELeads({ lat: PILOT_LAT, lon: PILOT_LON, rayon_km: 15, jours_recents: 180, score_min: 0.3, limit: 500 }),
    enabled: mode === "dpe",
  });

  useEffect(() => {
    if (!mapContainer.current) return;
    let map: unknown = null;

    (async () => {
      const maplibre = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");

      map = new maplibre.Map({
        container: mapContainer.current!,
        style: {
          version: 8,
          sources: {
            "osm-tiles": {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{
            id: "osm-tiles", type: "raster", source: "osm-tiles",
            paint: { "raster-saturation": -0.5, "raster-brightness-min": 0.65, "raster-brightness-max": 1, "raster-contrast": -0.08 },
          }],
        },
        center: [PILOT_LON, PILOT_LAT],
        zoom: 12,
      });

      mapRef.current = map;
    })();

    return () => {
      if (map && (map as { remove: () => void }).remove)
        (map as { remove: () => void }).remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current as {
      getSource: (id: string) => unknown;
      addSource: (id: string, config: unknown) => void;
      addLayer: (config: unknown) => void;
      on: (event: string, layer: string, cb: (e: unknown) => void) => void;
      getCanvas: () => { style: { cursor: string } };
    } | null;
    if (!map) return;

    const features =
      mode === "biens" && biensData
        ? biensData.features.map((f: { lat: number; lon: number; prix: number; surface: number; type: string; dpe: string; jours: number; score: number; agences: string[] }) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [f.lon, f.lat] },
            properties: {
              prix: f.prix, surface: f.surface, type: f.type,
              dpe: f.dpe || "NC", jours: f.jours, score: f.score,
              agences: (f.agences || []).join(", "),
              color: DPE_COLORS[f.dpe] || DPE_COLORS.NC,
            },
          }))
        : mode === "dpe" && dpeData
        ? dpeData.leads.map((d: { longitude: number; latitude: number; adresse: string; classe_conso_energie: string; surface_habitable: number; score_vente_probable: number; score_priorite_contact: number }) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [d.longitude, d.latitude] },
            properties: {
              adresse: d.adresse, dpe: d.classe_conso_energie || "NC",
              surface: d.surface_habitable, score: d.score_vente_probable,
              priorite: d.score_priorite_contact,
              color: DPE_COLORS[d.classe_conso_energie] || DPE_COLORS.NC,
            },
          }))
        : [];

    const geojson = { type: "FeatureCollection" as const, features };

    if (map.getSource("points")) {
      (map.getSource("points") as { setData: (data: unknown) => void }).setData(geojson);
    } else {
      map.addSource("points", { type: "geojson", data: geojson });
      map.addLayer({
        id: "points-layer", type: "circle", source: "points",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 10],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.on("click", "points-layer", (e: unknown) => {
        const evt = e as { features?: Array<{ properties: unknown }> };
        if (evt.features?.[0]) setSelectedFeature(evt.features[0].properties);
      });
      map.on("mouseenter", "points-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "points-layer", () => { map.getCanvas().style.cursor = ""; });
    }
  }, [biensData, dpeData, mode]);

  const sf = selectedFeature as Record<string, unknown> | null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>

      {/* ── Toolbar ────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 20, padding: "14px 24px",
        background: "#FFFFFF", borderBottom: "1px solid #E5DFD8", flexShrink: 0, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", fontFamily: "Inter, sans-serif" }}>
          Couche
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {MODES.map(({ key, label, icon: Icon }) => {
            const active = mode === key;
            return (
              <button
                key={key}
                onClick={() => setMode(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                  borderRadius: 4, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                  fontFamily: "Inter, sans-serif", transition: "all 0.15s",
                  border: "1px solid",
                  borderColor: active ? "#1B2A4A" : "#E5DFD8",
                  background: active ? "#1B2A4A" : "#FFFFFF",
                  color: active ? "#FFFFFF" : "#6B6057",
                }}
              >
                <Icon size={12} />{label}
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", fontFamily: "Inter, sans-serif" }}>
            Légende DPE
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {Object.entries(DPE_COLORS).filter(([k]) => k !== "NC").map(([cls, color]) => (
              <div key={cls} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: "0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.1)" }} />
                <span style={{ fontSize: 11.5, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#6B6057" }}>{cls}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map + panel ─────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        <div ref={mapContainer} style={{ flex: 1 }} />

        {/* ── Feature panel ──────────────────────────────── */}
        {sf && (
          <div
            style={{
              position: "absolute", top: 16, right: 16, width: 300,
              background: "#FFFFFF", border: "1px solid #E5DFD8", borderRadius: 4,
              boxShadow: "0 8px 32px rgba(24,21,15,0.12)", padding: "20px", zIndex: 10,
            }}
          >
            <button
              onClick={() => setSelectedFeature(null)}
              style={{
                position: "absolute", top: 12, right: 12, width: 26, height: 26,
                borderRadius: 4, border: "1px solid #E5DFD8", background: "#FFFFFF",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#9C8F83",
              }}
            >
              <X size={12} />
            </button>

            {mode === "biens" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingRight: 32 }}>
                  <span className={`dpe-badge dpe-${sf.dpe}`}>{sf.dpe as string}</span>
                  <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 16, fontWeight: 500, color: "#18150F" }}>{sf.type as string}</span>
                </div>
                {sf.prix !== undefined && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", marginBottom: 4 }}>Prix</div>
                    <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, fontWeight: 400, color: "#18150F", lineHeight: 1 }}>
                      {(sf.prix as number).toLocaleString("fr-FR")} €
                    </div>
                  </div>
                )}
                {sf.surface !== undefined && (
                  <div style={{ fontSize: 12, color: "#6B6057", marginBottom: 12 }}>{sf.surface as number} m² · {sf.jours as number}j sur le marché</div>
                )}
                {sf.agences && <div style={{ fontSize: 11.5, color: "#9C8F83", marginBottom: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📋 {sf.agences as string}</div>}
                <div style={{ borderTop: "1px solid #E5DFD8", paddingTop: 14 }}>
                  <div className="progress"><div className="progress-fill" style={{ width: `${((sf.score as number) || 0) * 100}%`, background: "#B8965A" }} /></div>
                  <div style={{ fontSize: 11.5, color: "#6B6057", marginTop: 6 }}>
                    Score opportunité :{" "}
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#B8965A" }}>{Math.round(((sf.score as number) || 0) * 100)}%</span>
                  </div>
                </div>
              </>
            )}

            {mode === "dpe" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingRight: 32 }}>
                  <span className={`dpe-badge dpe-${sf.dpe}`}>{sf.dpe as string}</span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 600, color: "#18150F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sf.adresse as string}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B6057", marginBottom: 14 }}>{sf.surface as number} m²</div>
                <div style={{ borderTop: "1px solid #E5DFD8", paddingTop: 14 }}>
                  <div className="progress"><div className="progress-fill" style={{ width: `${((sf.score as number) || 0) * 100}%`, background: "#C0392B" }} /></div>
                  <div style={{ fontSize: 11.5, color: "#6B6057", marginTop: 6 }}>
                    Probabilité vente :{" "}
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#C0392B" }}>{Math.round(((sf.score as number) || 0) * 100)}%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
