import type { Metadata } from "next";
import Link from "next/link";
import { requireGuest } from "@/lib/demo/session";
import { billingOpened, getVenue, guestRequests, offersForRequest } from "@/lib/demo/store";
import { areasLabel, eventTypeLabel, formatDateRange } from "@/lib/format";

export const metadata: Metadata = { title: "Mine forespørsler" };

export default async function MyRequestsPage() {
  const guest = await requireGuest();
  const requests = guestRequests(guest.id);

  return (
    <>
      <div className="page-head">
        <h1>Mine forespørsler</h1>
        <Link href="/ny-foresporsel" className="button button-party">
          Ny forespørsel
        </Link>
      </div>
      {requests.length === 0 && (
        <div className="empty">
          <p>Du har ingen forespørsler ennå.</p>
        </div>
      )}
      <ul className="list">
        {requests.map((r) => {
          const offers = offersForRequest(r.id);
          const booked = offers.find((o) => o.status === "confirmed");
          const active = offers.filter((o) => o.status === "active" && o.round === r.round);
          const unopened = active.filter((o) => !billingOpened(o.id)).length;
          const status = booked
            ? `Booket hos ${getVenue(booked.venueId)?.name}`
            : r.status === "closed"
              ? "Avsluttet"
              : unopened > 0
                ? `${unopened} ${unopened === 1 ? "nytt tilbud" : "nye tilbud"}`
                : active.length > 0
                  ? `${active.length} tilbud å velge mellom`
                  : "Venter på tilbud";
          const badge = booked
            ? "badge good"
            : unopened > 0
              ? "badge party"
              : active.length > 0
                ? "badge accent"
                : "badge";
          return (
            <li key={r.id}>
              <Link href={`/mine/${r.id}`} className="list-item">
                <div>
                  <strong>
                    {eventTypeLabel(r.input.eventType)}, {r.input.guestCount} gjester
                  </strong>
                  <span className="muted">
                    {formatDateRange(r.input.date)}, {areasLabel(r.input.areas)}
                  </span>
                </div>
                <span className={badge}>{status}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
