import { OSLO_AREAS, type AreaId } from "@lokalbud/core";
import type { Metadata } from "next";
import Link from "next/link";
import { requireVenueUser } from "@/lib/demo/session";
import { earliestDate, getVenue, openRequestsForVenue } from "@/lib/demo/store";
import { areasLabel, criterionLabel, eventTypeLabel, formatDateRange, formatNok, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Forespørsler" };

type Search = {
  omrade?: string | string[];
  fra?: string;
  til?: string;
  minbudsjett?: string;
  passer?: string;
  avslatte?: string;
  avslatt?: string;
};

export default async function VenueOverviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireVenueUser();
  const venue = getVenue(user.venueId)!;
  const params = await searchParams;

  const chosenAreas = new Set(
    (Array.isArray(params.omrade) ? params.omrade : params.omrade ? [params.omrade] : []).filter((a) =>
      OSLO_AREAS.some((o) => o.id === a),
    ) as AreaId[],
  );
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.fra ?? "") ? params.fra : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.til ?? "") ? params.til : undefined;
  const minBudget = Number.parseInt(params.minbudsjett ?? "", 10);
  const onlyFitting = params.passer === "1";
  const showDeclined = params.avslatte === "1";

  /** Forespørselen gjelder lokalets område, og lokalet har plass til alle. */
  const fits = (areas: readonly AreaId[], guestCount: number) =>
    areas.includes(venue.area) && guestCount <= venue.capacity;

  // Alle åpne forespørsler vises, nyeste og mest haster først. Filtrene er valgfrie.
  const rows = openRequestsForVenue(user.id).filter(({ request, declined }) => {
    const { input } = request;
    if (declined && !showDeclined) return false;
    if (onlyFitting && !fits(input.areas, input.guestCount)) return false;
    if (chosenAreas.size > 0 && !input.areas.some((a) => chosenAreas.has(a))) return false;
    const date = earliestDate(request);
    if (from && date < from) return false;
    if (to && date > to) return false;
    if (Number.isFinite(minBudget) && input.budget.amountNok < minBudget) return false;
    return true;
  });

  return (
    <>
      <h1>Forespørsler</h1>
      <p className="lead">
        Gjester som leter etter lokale nå. Du ser aldri navn eller nummer før gjesten aksepterer
        tilbudet ditt. Det koster ingenting å se eller svare «Passer ikke».
      </p>
      {params.avslatt && <p className="notice">Registrert. Forespørselen er skjult for dere.</p>}

      <details
        className="card filters"
        open={chosenAreas.size > 0 || onlyFitting || showDeclined || Boolean(from || to || params.minbudsjett)}
      >
        <summary>Filtrer</summary>
        <form method="get">
          <fieldset>
            <legend>Område</legend>
            <div className="chips">
              {OSLO_AREAS.map((a) => (
                <label key={a.id} className="chip">
                  <input type="checkbox" name="omrade" value={a.id} defaultChecked={chosenAreas.has(a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
            <p className="muted small">Uten valg vises forespørsler fra hele Oslo.</p>
          </fieldset>
          <div className="row">
            <div>
              <label htmlFor="fra">Dato fra</label>
              <input id="fra" type="date" name="fra" defaultValue={from} />
            </div>
            <div>
              <label htmlFor="til">Dato til</label>
              <input id="til" type="date" name="til" defaultValue={to} />
            </div>
            <div>
              <label htmlFor="minbudsjett">Minste budsjett (kr)</label>
              <input id="minbudsjett" inputMode="numeric" name="minbudsjett" defaultValue={params.minbudsjett} />
            </div>
          </div>
          <label className="check">
            <input type="checkbox" name="passer" value="1" defaultChecked={onlyFitting} />
            Bare forespørsler i {areasLabel([venue.area])} med plass til alle gjestene ({venue.capacity})
          </label>
          <label className="check">
            <input type="checkbox" name="avslatte" value="1" defaultChecked={showDeclined} />
            Vis også forespørsler dere har svart «Passer ikke» på
          </label>
          <div className="actions-row">
            <button className="button button-primary">Bruk filter</button>
            <Link href="/lokale" className="link-button">
              Nullstill
            </Link>
          </div>
        </form>
      </details>

      <p className="muted">
        {rows.length} {rows.length === 1 ? "forespørsel" : "forespørsler"}
      </p>

      <ul className="list">
        {rows.map(({ request, urgent, slotsLeft, ownOffer, declined }) => {
          const { input } = request;
          const must = request.criteria.filter((c) => c.importance === "must");
          return (
            <li key={request.id}>
              <Link href={`/lokale/foresporsel/${request.id}`} className="list-item request-row">
                <div>
                  <strong>
                    {eventTypeLabel(input.eventType)}, {input.guestCount} gjester
                  </strong>
                  <span>
                    {formatDateRange(input.date)} · {areasLabel(input.areas)}
                  </span>
                  <span>
                    {formatNok(input.budget.amountNok)}
                    {input.budget.indicative && " (veiledende)"}
                  </span>
                  {must.length > 0 && (
                    <span className="tags inline">
                      {must.map((c) => (
                        <span key={c.id} className="tag must small">
                          {criterionLabel(c)}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="muted small">Lagt inn {timeAgo(request.createdAt)}</span>
                </div>
                <div className="row-badges">
                  {urgent && <span className="badge urgent">Haster</span>}
                  {fits(input.areas, input.guestCount) && <span className="badge good">Passer for dere</span>}
                  {ownOffer ? (
                    <span className="badge good">Tilbud sendt</span>
                  ) : declined ? (
                    <span className="badge">Avslått</span>
                  ) : slotsLeft > 0 ? (
                    <span className="badge accent">
                      {slotsLeft} {slotsLeft === 1 ? "plass" : "plasser"} igjen
                    </span>
                  ) : (
                    <span className="badge">Fullt</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
