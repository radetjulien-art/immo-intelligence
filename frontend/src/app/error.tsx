"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ImmoIntel] Page error:", error);
  }, [error]);

  return (
    <div style={{ padding: "48px 56px", maxWidth: 640 }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", fontFamily: "Inter, sans-serif", marginBottom: 10 }}>
        Erreur
      </p>
      <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 36, fontWeight: 400, color: "#18150F", marginBottom: 8, lineHeight: 1.1 }}>
        Un problème est survenu
      </h1>
      <div style={{ width: 32, height: 1, background: "#B8965A", marginBottom: 20 }} />

      <div style={{
        background: "#FFFFFF", border: "1px solid #E5DFD8",
        borderLeft: "3px solid #C0392B", borderRadius: 4,
        padding: "16px 20px", marginBottom: 28,
      }}>
        <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#3D3429", wordBreak: "break-word", margin: 0 }}>
          {error.message || "Erreur inconnue"}
        </p>
        {error.digest && (
          <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#9C8F83", marginTop: 8, marginBottom: 0 }}>
            digest: {error.digest}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={reset}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", background: "#1B2A4A", color: "#FFFFFF",
            border: "none", borderRadius: 4, fontFamily: "Inter, sans-serif",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          Réessayer
        </button>
        <Link
          href="/"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", background: "#FFFFFF", color: "#6B6057",
            border: "1px solid #E5DFD8", borderRadius: 4, fontFamily: "Inter, sans-serif",
            fontSize: 13, fontWeight: 500, textDecoration: "none",
          }}
        >
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}
