"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const PILOT_LAT = parseFloat(process.env.NEXT_PUBLIC_PILOT_LAT || "47.2184");
const PILOT_LON = parseFloat(process.env.NEXT_PUBLIC_PILOT_LON || "-1.5536");

// Couleur par classe DPE
const DPE_COLORS: Record<string, string> = {
  A: "#059669", B: "#10b981", C: "#84cc16",
  D: "#eab308", E: "#f97316", F: "#ef4444", G: "#991b1b",
  NC: "#475569",
};

type MapMode = "biens" | "dpe" | "dvf";

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [mode, setMode] = useState<MapMode>("biens");
  const [selectedFeature, setSelectedFeature] = useState<unknown>(null);

  const { data: biensData } = useQuery({
    queryKey: ["biens-map", mode],
    queryFn: () =>
      mode === "biens"
        ? apiClient.getBiensMap(PILOT_LAT, PILOT_LON, 15)
        : Promise.resolve(null),
    enabled: mode === "biens",
  });

  const { data: dpeData } = useQuery({
    queryKey: ["dpe-map"],
    queryFn: () =>
      apiClient.getDPELeads({
        lat: PILOT_LAT,
        lon: PILOT_LON,
        rayon_km: 15,
        jours_recents: 180,
        score_min: 0.3,
        limit: 500,
      }),
    enabled: mode === "dpe",
  });

  // Initialiser MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    let map: unknown = null;

    const initMap = async () => {
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
          layers: [
            {
              id: "osm-tiles",
              type: "raster",
              source: "osm-tiles",
              paint: {
                "raster-saturation": -0.8,
                "raster-brightness-min": 0.1,
                "raster-brightness-max": 0.4,
              },
            },
          ],
        },
        center: [PILOT_LON, PILOT_LAT],
        zoom: 12,
      });

      mapRef.current = map;
    };

    initMap();

    return () => {
      if (map && (map as { remove: () => void }).remove) (map as { remove: () => void }).remove();
    };
  }, []);

  // Ajouter les points sur la carte
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
              prix: f.prix,
              surface: f.surface,
              type: f.type,
              dpe: f.dpe || "NC",
              jours: f.jours,
              score: f.score,
              agences: (f.agences || []).join(", "),
              color: DPE_COLORS[f.dpe] || DPE_COLORS.NC,
            },
          }))
        : mode === "dpe" && dpeData
        ? dpeData.leads.map((d: { longitude: number; latitude: number; adresse: string; classe_conso_energie: string; surface_habitable: number; score_vente_probable: number; score_priorite_contact: number }) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [d.longitude, d.latitude] },
            properties: {
              adresse: d.adresse,
              dpe: d.classe_conso_energie || "NC",
              surface: d.surface_habitable,
              score: d.score_vente_probable,
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
        id: "points-layer",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 14, 8],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.3)",
        },
      });

      map.on("click", "points-layer", (e: unknown) => {
        const evt = e as { features?: Array<{ properties: unknown }> };
        if (evt.features?.[0]) {
          setSelectedFeature(evt.features[0].properties);
        }
      });

      map.on("mouseenter", "points-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "points-layer", () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }, [biensData, dpeData, mode]);

  const sf = selectedFeature as Record<string, unknown> | null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <span className="text-sm text-slate-500 mr-1">Afficher :</span>
        {(["biens", "dpe", "dvf"] as MapMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded transition-all",
              mode === m ? "text-white" : "text-slate-500 hover:text-slate-300"
            )}
            style={
              mode === m
                ? { background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)" }
                : {}
            }
          >
            {m === "biens" ? "🏠 Biens en vente" : m === "dpe" ? "⚡ Leads DPE" : "📊 Ventes DVF"}
          </button>
        ))}

        {/* Légende DPE */}
        <div className="ml-auto flex items-center gap-2">
          {Object.entries(DPE_COLORS).filter(([k]) => k !== "NC").map(([cls, color]) => (
            <div key={cls} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs text-slate-600">{cls}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map + sidebar */}
      <div className="flex-1 flex relative">
        <div ref={mapContainer} className="flex-1" />

        {/* Detail panel */}
        {sf && (
          <div
            className="absolute top-4 right-4 w-72 card p-4 text-sm space-y-2"
            style={{ zIndex: 10 }}
          >
            <button
              onClick={() => setSelectedFeature(null)}
              className="absolute top-2 right-2 text-slate-600 hover:text-slate-400 text-xs"
            >
              ✕
            </button>

            {mode === "biens" && (
              <>
                <div className="flex items-center gap-2">
                  <span className={`dpe-badge dpe-${sf.dpe}`}>{sf.dpe as string}</span>
                  <span className="font-medium text-slate-200">{sf.type as string}</span>
                </div>
                {sf.prix && (
                  <div>
                    <span className="text-slate-500 text-xs">Prix</span>
                    <div className="mono font-semibold text-slate-100">
                      {(sf.prix as number).toLocaleString("fr-FR")} €
                    </div>
                  </div>
                )}
                {sf.surface && (
                  <div className="text-xs text-slate-500">
                    {sf.surface as number} m² · {sf.jours as number}j sur le marché
                  </div>
                )}
                {sf.agences && (
                  <div className="text-xs text-slate-500 truncate">📋 {sf.agences as string}</div>
                )}
                <div>
                  <div className="score-bar">
                    <div
                      className="score-bar-fill"
                      style={{ width: `${((sf.score as number) || 0) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Score opportunité : {Math.round(((sf.score as number) || 0) * 100)}%
                  </div>
                </div>
              </>
            )}

            {mode === "dpe" && (
              <>
                <div className="flex items-center gap-2">
                  <span className={`dpe-badge dpe-${sf.dpe}`}>{sf.dpe as string}</span>
                  <span className="font-medium text-slate-200 text-xs truncate">{sf.adresse as string}</span>
                </div>
                <div className="text-xs text-slate-500">{sf.surface as number} m²</div>
                <div>
                  <div className="score-bar">
                    <div
                      className="score-bar-fill"
                      style={{
                        width: `${((sf.score as number) || 0) * 100}%`,
                        background: "linear-gradient(90deg, #ef4444, #f97316)",
                      }}
                    />
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Probabilité vente : {Math.round(((sf.score as number) || 0) * 100)}%
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
