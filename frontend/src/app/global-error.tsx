"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ background: "#F8F6F2", color: "#18150F", margin: 0, padding: 0, fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: 40 }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 96, fontWeight: 300, color: "#E5DFD8", lineHeight: 1, marginBottom: 24 }}>
            !
          </div>
          <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 32, fontWeight: 400, color: "#18150F", marginBottom: 8 }}>
            Erreur critique
          </h1>
          <div style={{ width: 32, height: 1, background: "#B8965A", margin: "0 auto 20px" }} />
          <p style={{ fontSize: 13, color: "#6B6057", marginBottom: 28, fontFamily: "JetBrains Mono, monospace", wordBreak: "break-word" }}>
            {error.message || "Erreur inconnue"}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 28px", background: "#1B2A4A", color: "#FFFFFF",
              border: "none", borderRadius: 4, fontFamily: "Inter, sans-serif",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            Recharger l&apos;application
          </button>
        </div>
      </body>
    </html>
  );
}
