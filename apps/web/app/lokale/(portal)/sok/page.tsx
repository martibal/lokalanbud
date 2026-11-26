import type { Metadata } from "next";
import Link from "next/link";
import { deleteSearchAction, toggleNotifyAction } from "@/lib/demo/actions";
import { applyFilters, describeFilters, parseQuery } from "@/lib/demo/filters";
import { requireVenueUser } from "@/lib/demo/session";
import { getVenue, openRequestsForVenue, savedSearchesForVenue } from "@/lib/demo/store";

export const metadata: Metadata = { title: "Lagrede søk" };

export default async function SavedSearchesPage({ searchParams }: { searchParams: Promise<{ lagret?: string }> }) {
  const user = await requireVenueUser();
  const venue = getVenue(user.venueId)!;
  const { lagret } = await searchParams;
  const searches = savedSearchesForVenue(user.id);
  const open = openRequestsForVenue(user.id).filter((r) => !r.declined);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lagrede søk</h1>
          <p className="muted">
            Få beskjed når det kommer forespørsler som passer. Lag et søk ved å filtrere på Forespørsler og trykke
            «Lagre søk».
          </p>
        </div>
      </div>
      {lagret && <p className="notice good">Søket er lagret.</p>}

      {searches.length === 0 ? (
        <div className="empty">
          <p>Dere har ingen lagrede søk ennå.</p>
          <Link href="/lokale" className="button button-primary">
            Gå til forespørsler
          </Link>
        </div>
      ) : (
        <ul className="list">
          {searches.map((s) => {
            const filters = parseQuery(s.query);
            const matches = applyFilters(open, filters, venue);
            const fresh = matches.filter((m) => m.request.createdAt > s.lastSeenAt).length;
            return (
              <li key={s.id} className="card">
                <div className="offer-head">
                  <div>
                    <h2>{s.name}</h2>
                    <span className="muted">{describeFilters(filters)}</span>
                  </div>
                  {fresh > 0 && <span className="badge party">{fresh} nye</span>}
                </div>
                <p>
                  {matches.length} {matches.length === 1 ? "åpen forespørsel" : "åpne forespørsler"} passer nå.
                </p>
                <div className="actions-row">
                  <Link href={`/lokale?${s.query}&sok=${s.id}`} className="button button-primary">
                    Vis treff
                  </Link>
                  <form action={toggleNotifyAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="button">{s.notify ? "Slå av varsel" : "Slå på varsel"}</button>
                  </form>
                  <form action={deleteSearchAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="link-button">Slett</button>
                  </form>
                </div>
                <p className="muted small">
                  {s.notify
                    ? "Varsel er på. I den ferdige løsningen kommer det som push i appen, med SMS eller e-post som reserve. Demoen sender ingenting."
                    : "Varsel er av."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
