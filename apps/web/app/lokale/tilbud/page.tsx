import type { Metadata } from "next";
import Link from "next/link";
import { ErrorNotice } from "@/components/ErrorNotice";
import { confirmBookingAction, rejectAcceptedAction } from "@/lib/demo/actions";
import { requireVenueUser } from "@/lib/demo/session";
import { billingOpened, currentVersion, getRequest, getUser, venueOffers } from "@/lib/demo/store";
import { eventTypeLabel, formatDateRange, formatNok, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Våre tilbud" };

const STATUS = {
  active: "Sendt",
  accepted: "Akseptert, må bekreftes",
  confirmed: "Booket",
  declined: "Ikke valgt",
  superseded: "Ny runde startet",
} as const;

export default async function VenueOffersPage({ searchParams }: { searchParams: Promise<{ sendt?: string; feil?: string }> }) {
  const user = await requireVenueUser();
  const { sendt, feil } = await searchParams;
  const offers = venueOffers(user.id);
  const canConfirm = user.role === "owner" || user.role === "booking";

  return (
    <>
      <h1>Våre tilbud</h1>
      {sendt && <p className="notice">Tilbudet er sendt. Gjesten får SMS.</p>}
      <ErrorNotice message={feil} />
      {offers.length === 0 && (
        <div className="card">
          <p>Dere har ikke sendt noen tilbud ennå.</p>
          <Link href="/lokale" className="button">
            Se forespørsler
          </Link>
        </div>
      )}
      <ul className="list">
        {offers.map((offer) => {
          const request = getRequest(offer.requestId)!;
          const version = currentVersion(offer);
          const opened = billingOpened(offer.id);
          const guest = getUser(request.guestId);
          return (
            <li key={offer.id} className={`card offer-row ${offer.status}`}>
              <div className="offer-head">
                <div>
                  <strong>
                    {eventTypeLabel(request.input.eventType)}, {request.input.guestCount} gjester
                  </strong>
                  <span className="muted">{formatDateRange(request.input.date)}</span>
                </div>
                <span className={offer.status === "confirmed" ? "badge good" : offer.status === "accepted" ? "badge urgent" : "badge"}>
                  {STATUS[offer.status]}
                </span>
              </div>
              <p>
                {formatNok(version.totalPriceNok)} · versjon {version.version} · sendt {timeAgo(offer.createdAt)} ·{" "}
                {opened ? "åpnet av gjesten" : "ikke åpnet ennå"}
              </p>

              {(offer.status === "accepted" || offer.status === "confirmed") && guest && (
                <p className="contact">
                  Gjest: <strong>{guest.name}</strong>
                  {guest.kind === "guest" && ` · ${guest.phone}`}
                </p>
              )}

              {offer.status === "accepted" && canConfirm && (
                <div className="actions-row">
                  <form action={confirmBookingAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <button className="button button-primary">Bekreft booking</button>
                  </form>
                  <form action={rejectAcceptedAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <button className="link-button">Kan ikke likevel</button>
                  </form>
                </div>
              )}
              {offer.status === "confirmed" && (
                <Link href={`/avtale/${offer.id}`} className="button">
                  Avtaledokument {offer.reference}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
