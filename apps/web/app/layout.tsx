import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lokalbud", template: "%s · Lokalbud" },
  description: "Fortell hva festen trenger. Lokalene sender deg tilbud.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f3d36",
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
            Utviklingsversjon. Ikke i drift, og ingenting sendes til lokaler.
          </div>
        )}
        <header className="site-header">
          <Link href="/" className="brand">
            Lokalbud
          </Link>
        </header>
        <main className="page">{children}</main>
        <footer className="site-footer">
          <p>Lokalbud formidler. Avtalen inngås mellom deg og lokalet.</p>
        </footer>
      </body>
    </html>
  );
}
