"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useCity } from "@/contexts/CityContext";
import { useEffect, useRef, useState } from "react";
import { Layers, RefreshCw, MapPin, Grid3X3, Maximize2 } from "lucide-react";

type Parcel = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: {
    commune: string;
    prefixe: string;
    section: string;
    numero: string;
    contenance: number;   // m²
    idu: string;
  };
};

type RadiusOption = 500 | 1000 | 2000;

export default function CadastrePage() {
  const { city, lat, lon, codeInsee } = useCity();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<unknown>(null);
  const [radius, setRadius]   = useState<RadiusOption>(1000);
  const [selected, setSelected] = useState<Parcel["properties"] | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cadastre-parcelles", lat, lon, radius],
    queryFn:  () => apiClient.getCadastreParcelles(lat, lon, radius),
    staleTime: 5 * 60 * 1000,
  });

  const parcelles: Parcel[] = data?.features ?? [];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSurface   = parcelles.reduce((s, p) => s + (p.properties.contenance || 0), 0);
  const avgSurface     = parcelles.length ? Math.round(totalSurface / parcelles.length) : 0;
  const sections       = new Set(parcelles.map((p) => p.properties.section)).size;

  // ── Map ────────────────────────────────────────────────────────────────────
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
            "osm": {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
            "cadastre": {
              type: "raster",
              tiles: [
                "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
                "&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal" +
                "&FORMAT=image/png&TILEMATRIXSET=PM" +
                "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
              ],
              tileSize: 256,
              attribution: "© IGN — Géoportail",
            },
          },
          layers: [
            { id: "osm",      type: "raster", source: "osm",      paint: { "raster-saturation": -0.4, "raster-brightness-min": 0.7 } },
            { id: "cadastre", type: "raster", source: "cadastre", paint: { "raster-opacity": 0.7 } },
          ],
        },
        center: [lon, lat],
        zoom: 15,
      });

      mapRef.current = map;
    })();

    return () => { if (map && (map as { remove: () => void }).remove) (map as { remove: () => void }).remove(); };
  }, []);

  // Re-center when city changes
  useEffect(() => {
    const map = mapRef.current as { setCenter?: (c: [number, number]) => void; setZoom?: (z: number) => void } | null;
    if (map?.setCenter) { map.setCenter([lon, lat]); map.setZoom?.(15); }
  }, [lat, lon]);

  // Add parcel GeoJSON overlay
  useEffect(() => {
    const map = mapRef.current as {
      getSource: (id: string) => unknown;
      addSource: (id: string, c: unknown) => void;
      addLayer:  (c: unknown) => void;
      on:        (ev: string, layer: string, cb: (e: unknown) => void) => void;
      getCanvas: () => { style: { cursor: string } };
    } | null;
    if (!map || !data) return;

    const geojson = { type: "FeatureCollection", features: parcelles };

    if (map.getSource("parcels")) {
      (map.getSource("parcels") as { setData: (d: unknown) => void }).setData(geojson);
    } else {
      map.addSource("parcels", { type: "geojson", data: geojson });
      map.addLayer({ id: "parcels-fill", type: "fill", source: "parcels", paint: { "fill-color": "#B8965A", "fill-opacity": 0.12 } });
      map.addLayer({ id: "parcels-stroke", type: "line", source: "parcels", paint: { "line-color": "#B8965A", "line-width": 1.5, "line-opacity": 0.8 } });
      map.on("click", "parcels-fill", (e: unknown) => {
        const evt = e as { features?: Array<{ properties: Parcel["properties"] }> };
        if (evt.features?.[0]) setSelected(evt.features[0].properties);
      });
      map.on("mouseenter", "parcels-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "parcels-fill", () => { map.getCanvas().style.cursor = ""; });
    }
  }, [data, parcelles]);

  return (
    <div style={{ padding: "48px 56px" }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40, flexWrap: "wrap", gap: 20 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Données foncières</p>
          <h1 className="page-title">Cadastre — {city}</h1>
          <div className="gold-rule" />
          <p style={{ fontSize: 13, color: "#6B6057", marginTop: 8 }}>
            Parcelles cadastrales · Source IGN — données publiques officielles
            {codeInsee && <span style={{ fontFamily: "JetBrains Mono, monospace", marginLeft: 8, color: "#9C8F83", fontSize: 11 }}>INSEE {codeInsee}</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Radius selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83" }}>Rayon</span>
            {([500, 1000, 2000] as RadiusOption[]).map((r) => (
              <button key={r} onClick={() => setRadius(r)} style={{ padding: "6px 10px", borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s", border: "1px solid", borderColor: radius === r ? "#1B2A4A" : "#E5DFD8", background: radius === r ? "#1B2A4A" : "#FFFFFF", color: radius === r ? "#FFFFFF" : "#6B6057" }}>
                {r >= 1000 ? `${r/1000}km` : `${r}m`}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} disabled={isLoading} className="btn btn-white">
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>
      </header>

      {/* ── KPI strip ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#E5DFD8", border: "1px solid #E5DFD8", borderRadius: 4, overflow: "hidden", marginBottom: 28 }}>
        <KPI icon={Grid3X3}  label="Parcelles"         value={isLoading ? "…" : parcelles.length.toLocaleString("fr-FR")} unit={`dans un rayon de ${radius >= 1000 ? radius/1000 + "km" : radius + "m"}`} />
        <KPI icon={Maximize2} label="Surface totale"   value={isLoading ? "…" : (totalSurface / 10000).toFixed(1)}        unit="hectares" />
        <KPI icon={MapPin}   label="Surface moyenne"   value={isLoading ? "…" : avgSurface.toLocaleString("fr-FR")}       unit="m² par parcelle" />
        <KPI icon={Layers}   label="Sections cadastrales" value={isLoading ? "…" : sections.toString()}                  unit="sections distinctes" />
      </div>

      {/* ── Map ──────────────────────────────────────────────────── */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #E5DFD8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={14} color="#B8965A" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#18150F" }}>Carte cadastrale</span>
          </div>
          <div style={{ display: "flex", items: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 14, height: 14, background: "rgba(184,150,90,0.15)", border: "1.5px solid #B8965A", borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: "#9C8F83" }}>Parcelles IGN</span>
            </div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <div ref={mapContainer} style={{ height: 420 }} />
          {/* Selected parcel popup */}
          {selected && (
            <div style={{ position: "absolute", bottom: 16, left: 16, background: "#FFFFFF", border: "1px solid #E5DFD8", borderRadius: 4, padding: "14px 18px", boxShadow: "0 4px 16px rgba(24,21,15,0.1)", minWidth: 200, zIndex: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B8965A", marginBottom: 10 }}>Parcelle sélectionnée</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                <InfoItem label="Section"  value={`${selected.prefixe}${selected.section}`} />
                <InfoItem label="Numéro"   value={selected.numero} />
                <InfoItem label="Surface"  value={selected.contenance ? `${selected.contenance.toLocaleString("fr-FR")} m²` : "—"} />
                <InfoItem label="Commune"  value={selected.commune} />
              </div>
              <button onClick={() => setSelected(null)} style={{ marginTop: 10, fontSize: 11, color: "#9C8F83", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>Fermer</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 4 }} />)}
        </div>
      ) : !parcelles.length ? (
        <div className="card" style={{ padding: "64px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>🗺️</div>
          <p style={{ fontWeight: 600, color: "#18150F", marginBottom: 4 }}>Aucune parcelle trouvée</p>
          <p style={{ fontSize: 13, color: "#6B6057" }}>Essayez d'augmenter le rayon de recherche.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #E5DFD8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#18150F" }}>Liste des parcelles</span>
            <span style={{ fontSize: 11.5, color: "#9C8F83" }}>{parcelles.length} résultats</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Section</th><th>Numéro</th><th>Surface</th><th>Commune</th><th>Identifiant</th>
              </tr>
            </thead>
            <tbody>
              {parcelles
                .sort((a, b) => (b.properties.contenance || 0) - (a.properties.contenance || 0))
                .slice(0, 100)
                .map((p) => (
                <tr
                  key={p.properties.idu}
                  onClick={() => setSelected(p.properties)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <span className="tag tag-gold">{p.properties.prefixe}{p.properties.section}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, fontSize: 13, color: "#18150F" }}>
                      {p.properties.numero}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="progress" style={{ width: 60 }}>
                        <div className="progress-fill" style={{ width: `${Math.min(100, ((p.properties.contenance || 0) / 5000) * 100)}%`, background: "#B8965A" }} />
                      </div>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 500, fontSize: 12.5, color: "#3D3429" }}>
                        {p.properties.contenance ? `${p.properties.contenance.toLocaleString("fr-FR")} m²` : "—"}
                      </span>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 13, color: "#6B6057" }}>{p.properties.commune}</span></td>
                  <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#9C8F83" }}>{p.properties.idu}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {parcelles.length > 100 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid #E5DFD8", fontSize: 12, color: "#9C8F83", textAlign: "center" }}>
              Affichage des 100 plus grandes parcelles sur {parcelles.length} résultats. Réduisez le rayon pour voir toutes les parcelles.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, unit }: { icon: typeof Layers; label: string; value: string; unit: string }) {
  return (
    <div style={{ background: "#FFFFFF", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon size={13} color="#B8965A" strokeWidth={1.5} />
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", fontFamily: "Inter, sans-serif" }}>{label}</div>
      </div>
      <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 36, fontWeight: 400, color: "#18150F", lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#9C8F83", fontFamily: "Inter, sans-serif" }}>{unit}</div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#18150F", fontFamily: value?.match(/^\d/) ? "JetBrains Mono, monospace" : "Inter, sans-serif" }}>{value || "—"}</div>
    </div>
  );
}
