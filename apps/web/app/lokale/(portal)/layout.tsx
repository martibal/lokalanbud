import { Brand } from "@/components/Brand";
import { NavLink } from "@/components/NavLink";
import { logout } from "@/lib/demo/actions";
import { requireVenueUser } from "@/lib/demo/session";
import { getVenue } from "@/lib/demo/store";

const ROLE_LABELS = { owner: "Eier", booking: "Booking", staff: "Ansatt", accounting: "Regnskap" } as const;

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireVenueUser();
  const venue = getVenue(user.venueId)!;
  const seesBilling = user.role === "owner" || user.role === "accounting";

  return (
    <div className="portal">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <Brand href="/lokale" />
          <nav aria-label="Lokalportalen">
            <NavLink href="/lokale" exact>
              Forespørsler
            </NavLink>
            <NavLink href="/lokale/sok">Lagrede søk</NavLink>
            <NavLink href="/lokale/tilbud">Våre tilbud</NavLink>
            {seesBilling && <NavLink href="/lokale/faktura">Faktura</NavLink>}
          </nav>
          <div className="sidebar-foot">
            <p className="sidebar-user">
              <strong>{venue.name}</strong>
              {user.name.replace(/ \(.*\)$/, "")}, {ROLE_LABELS[user.role].toLowerCase()}
            </p>
            <form action={logout}>
              <button className="link-button">Logg ut</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="portal-main">{children}</main>
    </div>
  );
}
