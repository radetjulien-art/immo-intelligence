import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { QueryProvider } from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "Immo Intelligence — Copilote Data de l'Agent Immobilier",
  description: "Plateforme SaaS de data intelligence immobilière pour agences indépendantes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <QueryProvider>
          <div className="flex h-screen overflow-hidden">
            <Navigation />
            <main className="flex-1 overflow-auto" style={{ background: "var(--page-bg)" }}>
              {children}
            </main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
