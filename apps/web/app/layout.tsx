import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { logout } from "@/lib/demo/actions";
import { currentUser } from "@/lib/demo/session";
import { getVenue } from "@/lib/demo/store";
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
  const user = await currentUser();
  const venue = user?.kind === "venue" ? getVenue(user.venueId) : undefined;

  return (
    <html lang="nb">
      <body>
        {!isProductionStage && (
          <div className="stage-banner" role="note">
            Demoversjon med oppdiktede lokaler og gjester. Ingenting sendes til noen.
          </div>
        )}
        <header className="site-header">
          <Link href="/" className="brand">
            Lokalbud
          </Link>
          {user && (
            <nav className="nav" aria-label="Hovedmeny">
              {user.kind === "guest" && (
                <>
                  <Link href="/ny-foresporsel">Nytt behov</Link>
                  <Link href="/mine">Mine forespørsler</Link>
                </>
              )}
              {user.kind === "venue" && (
                <>
                  <Link href="/lokale">Forespørsler</Link>
                  <Link href="/lokale/tilbud">Våre tilbud</Link>
                  {(user.role === "owner" || user.role === "accounting") && (
                    <Link href="/lokale/faktura">Faktura</Link>
                  )}
                </>
              )}
              <span className="nav-role">{venue ? `${venue.name} · ${user.name}` : user.name}</span>
              <form action={logout}>
                <button className="link-button">Logg ut</button>
              </form>
            </nav>
          )}
        </header>
        <main className={user?.kind === "venue" ? "page wide" : "page"}>{children}</main>
        <footer className="site-footer">
          <p>Lokalbud formidler. Avtalen inngås mellom deg og lokalet.</p>
          {!isProductionStage && (
            <p>
              <Link href="/demo">Demoverktøy</Link>: bytt rolle raskt eller nullstill dataene.
            </p>
          )}
        </footer>
      </body>
    </html>
  );
}
