import { logout } from "@/lib/demo/actions";
import { currentUser } from "@/lib/demo/session";
import { Brand } from "./Brand";
import { NavLink } from "./NavLink";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="site-header shell narrow">
      <Brand />
      {user && (
        <nav className="nav" aria-label="Hovedmeny">
          {user.kind === "guest" ? (
            <>
              <NavLink href="/ny-foresporsel">Finn lokale</NavLink>
              <NavLink href="/mine">Mine forespørsler</NavLink>
            </>
          ) : (
            <NavLink href="/lokale" exact>
              Til lokalportalen
            </NavLink>
          )}
          <span className="who">{user.name}</span>
          <form action={logout}>
            <button className="link-button">Logg ut</button>
          </form>
        </nav>
      )}
    </header>
  );
}
