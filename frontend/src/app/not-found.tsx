import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "48px 56px", maxWidth: 600 }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8F83", fontFamily: "Inter, sans-serif", marginBottom: 10 }}>
        404
      </p>
      <h1 style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 36, fontWeight: 400, color: "#18150F", marginBottom: 8, lineHeight: 1.1 }}>
        Page introuvable
      </h1>
      <div style={{ width: 32, height: 1, background: "#B8965A", marginBottom: 20 }} />
      <p style={{ fontSize: 13, color: "#6B6057", marginBottom: 28 }}>
        Cette page n&apos;existe pas encore.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 20px", background: "#1B2A4A", color: "#FFFFFF",
          borderRadius: 4, fontFamily: "Inter, sans-serif",
          fontSize: 13, fontWeight: 500, textDecoration: "none",
        }}
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
