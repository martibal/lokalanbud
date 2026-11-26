import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lokalbud", template: "%s · Lokalbud" },
  description: "Fortell hva festen trenger. Lokalene sender deg tilbud.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#23204a",
};

const isProductionStage = process.env.LOKALBUD_STAGE === "production";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Leser hodene for å gjøre siden dynamisk, slik at hver visning får sin egen nonce.
  await headers();
  return (
    <html lang="nb">
      <body>
        {!isProductionStage && (
          <div className="stage-banner" role="note">
            Demo med oppdiktede lokaler og gjester. Ingenting sendes til noen.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
