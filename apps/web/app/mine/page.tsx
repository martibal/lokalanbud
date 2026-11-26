import type { Metadata } from "next";
import Link from "next/link";
import { requireGuest } from "@/lib/demo/session";
import { guestRequests, offersForRequest } from "@/lib/demo/store";
import { areasLabel, eventTypeLabel, formatDateRange } from "@/lib/format";

export const metadata: Metadata = { title: "Mine forespørsler" };

export default async function MyRequestsPage() {
  const guest = await requireGuest();
  const requests = guestRequests(guest.id);

  return (
    <>
      <h1>Mine forespørsler</h1>
      {requests.length === 0 && (
        <div className="card">
          <p>Du har ingen forespørsler ennå.</p>
          <Link href="/ny-foresporsel" className="button button-primary">
            Legg inn behovet ditt
          </Link>
        </div>
      )}
      <ul className="list">
        {requests.map((r) => {
          const offers = offersForRequest(r.id);
          const confirmed = offers.find((o) => o.status === "confirmed");
          const accepted = offers.find((o) => o.status === "accepted");
          const active = offers.filter((o) => o.status === "active" && o.round === r.round).length;
          const status = confirmed
            ? "Booket"
            : accepted
              ? "Venter på lokalets bekreftelse"
              : r.status === "closed"
                ? "Avsluttet"
                : active > 0
                  ? `${active} ${active === 1 ? "tilbud" : "tilbud"} å vurdere`
                  : "Venter på tilbud";
          return (
            <li key={r.id}>
              <Link href={`/mine/${r.id}`} className="list-item">
                <div>
                  <strong>
                    {eventTypeLabel(r.input.eventType)}, {r.input.guestCount} gjester
                  </strong>
                  <span className="muted">
                    {formatDateRange(r.input.date)} · {areasLabel(r.input.areas)}
                  </span>
                </div>
                <span className={confirmed ? "badge good" : active > 0 || accepted ? "badge accent" : "badge"}>
                  {status}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
