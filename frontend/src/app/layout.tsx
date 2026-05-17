import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { QueryProvider } from "@/components/QueryProvider";
import { CityProvider } from "@/contexts/CityContext";

export const metadata: Metadata = {
  title: "ImmoIntel — Intelligence immobilière",
  description: "Plateforme d'analyse immobilière professionnelle",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ background: "#F8F6F2", color: "#18150F", margin: 0, padding: 0 }}>
        <QueryProvider>
          <CityProvider>
            <div style={{ display: "flex", minHeight: "100vh" }}>
              <Navigation />
              <main
                style={{
                  flex: 1,
                  overflow: "auto",
                  background: "#F8F6F2",
                  minWidth: 0,
                }}
              >
                {children}
              </main>
            </div>
          </CityProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
