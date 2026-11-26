import { OSLO_AREAS } from "@lokalbud/core";
import type { Metadata } from "next";
import Link from "next/link";
import { ErrorNotice } from "@/components/ErrorNotice";
import { FilterPanel } from "@/components/FilterPanel";
import { RequestCard } from "@/components/RequestCard";
import { saveSearchAction } from "@/lib/demo/actions";
import {
  applyFilters,
  filtersToQuery,
  fitsVenue,
  hasFilters,
  parseFilters,
  type FilterParams,
} from "@/lib/demo/filters";
import { requireVenueUser } from "@/lib/demo/session";
import { getVenue, markSavedSearchSeen, openRequestsForVenue, getSavedSearch, venueOffers } from "@/lib/demo/store";
import { areasLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Forespørsler" };

type Search = FilterParams & { avslatte?: string; avslatt?: string; sok?: string; feil?: string };

export default async function VenueOverviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireVenueUser();
  const venue = getVenue(user.venueId)!;
  const params = await searchParams;
  const filters = parseFilters(params);
  const showDeclined = params.avslatte === "1";
  const saved = params.sok ? getSavedSearch(user.id, params.sok) : undefined;
  if (saved) markSavedSearchSeen(user.id, saved.id);

  const all = openRequestsForVenue(user.id);
  const visible = all.filter((r) => showDeclined || !r.declined);
  const rows = applyFilters(visible, filters, venue);

  const dayAgo = Date.now() - 86_400_000;
  const stats = {
    open: visible.length,
    fitting: visible.filter((r) => fitsVenue(r, venue)).length,
    newToday: visible.filter((r) => Date.parse(r.request.createdAt) > dayAgo).length,
    offersOut: venueOffers(user.id).filter((o) => o.status === "active").length,
  };
  const query = filtersToQuery(filters);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Forespørsler</h1>
          <p className="muted">
            Gjester som leter etter lokale nå. Du ser aldri navn eller nummer før gjesten aksepterer tilbudet ditt.
          </p>
        </div>
      </div>
      <ErrorNotice message={params.feil} />
      {params.avslatt && <p className="notice">Registrert. Forespørselen er skjult for dere.</p>}

      <div className="stats">
        <div className="stat highlight">
          <strong>{stats.fitting}</strong>
          <span>passer for {venue.name}</span>
        </div>
        <div className="stat">
          <strong>{stats.open}</strong>
          <span>åpne i Oslo</span>
        </div>
        <div className="stat">
          <strong>{stats.newToday}</strong>
          <span>nye siste døgn</span>
        </div>
        <div className="stat">
          <strong>{stats.offersOut}</strong>
          <span>tilbud ute nå</span>
        </div>
      </div>

      <div className="market">
        <FilterPanel
          active={
            filters.areas.length +
            (filters.from ? 1 : 0) +
            (filters.to ? 1 : 0) +
            (filters.minBudget ? 1 : 0) +
            (filters.onlyFitting ? 1 : 0)
          }
        >
          <form method="get" className="filters" aria-label="Filter">
            <h2>Filter</h2>
            <label className="check">
              <input type="checkbox" name="passer" value="1" defaultChecked={filters.onlyFitting} />
              Bare de som passer oss ({areasLabel([venue.area])}, inntil {venue.capacity} gjester)
            </label>
            <div className="field">
              <span className="label">Bydel</span>
              <div className="chips">
                {OSLO_AREAS.map((a) => (
                  <label key={a.id} className="chip">
                    <input type="checkbox" name="omrade" value={a.id} defaultChecked={filters.areas.includes(a.id)} />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="fra">Dato fra</label>
                <input id="fra" type="date" name="fra" defaultValue={filters.from} />
              </div>
              <div className="field">
                <label htmlFor="til">Dato til</label>
                <input id="til" type="date" name="til" defaultValue={filters.to} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="minbudsjett">Budsjett minst</label>
              <div className="suffix-input">
                <input id="minbudsjett" inputMode="numeric" name="minbudsjett" defaultValue={filters.minBudget} />
                <span aria-hidden="true">kr</span>
              </div>
            </div>
            <label className="check">
              <input type="checkbox" name="avslatte" value="1" defaultChecked={showDeclined} />
              Vis også de vi har avslått
            </label>
            <div className="filters-actions">
              <button className="button button-primary">Vis treff</button>
              {(hasFilters(filters) || showDeclined) && (
                <Link href="/lokale" className="button">
                  Nullstill
                </Link>
              )}
            </div>
          </form>
        </FilterPanel>

        <section aria-label="Treff">
          <div className="result-bar">
            <p>
              {saved ? <strong>{saved.name}: </strong> : null}
              {rows.length} {rows.length === 1 ? "forespørsel" : "forespørsler"}
              {hasFilters(filters) ? " med dette filteret" : ""}
            </p>
            {hasFilters(filters) && !saved && (
              <form action={saveSearchAction} className="save-search">
                <input type="hidden" name="query" value={query} />
                <label htmlFor="sokenavn" className="visually-hidden">
                  Navn på søket
                </label>
                <input
                  id="sokenavn"
                  name="name"
                  className="input"
                  placeholder="Navn, for eksempel «Store selskap»"
                  required
                />
                <input type="hidden" name="notify" value="1" />
                <button className="button">Lagre søk</button>
              </form>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="empty">
              <p>Ingen forespørsler passer filteret akkurat nå.</p>
              <p className="small">Lagre søket, så ser du med en gang når det kommer nye.</p>
            </div>
          ) : (
            <ul className="request-grid">
              {rows.map((view) => (
                <li key={view.request.id}>
                  <RequestCard view={view} fits={fitsVenue(view, venue)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
