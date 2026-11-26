import type { Metadata } from "next";
import Link from "next/link";
import { ErrorNotice } from "@/components/ErrorNotice";
import { withdrawOfferAction } from "@/lib/demo/actions";
import { requireVenueUser } from "@/lib/demo/session";
import { billingOpened, currentVersion, getRequest, getUser, venueOffers, type OfferStatus } from "@/lib/demo/store";
import { eventTypeLabel, formatDate, formatDateRange, formatNok, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Våre tilbud" };

const STATUS: Record<OfferStatus, { label: string; badge: string }> = {
  active: { label: "Venter på gjesten", badge: "badge accent" },
  confirmed: { label: "Booket", badge: "badge good" },
  declined: { label: "Ikke valgt", badge: "badge" },
  withdrawn: { label: "Trukket", badge: "badge" },
  superseded: { label: "Ny runde startet", badge: "badge" },
};

const prettyPhone = (p: string) => p.replace(/^\+47(\d{3})(\d{2})(\d{3})$/, "$1 $2 $3");

export default async function VenueOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ sendt?: string; feil?: string }>;
}) {
  const user = await requireVenueUser();
  const { sendt, feil } = await searchParams;
  const offers = venueOffers(user.id);
  const booked = offers.filter((o) => o.status === "confirmed");
  const waiting = offers.filter((o) => o.status === "active");
  const closed = offers.filter((o) => o.status !== "confirmed" && o.status !== "active");
  const canWithdraw = user.role !== "accounting";

  const renderOffer = (offer: (typeof offers)[number]) => {
    const request = getRequest(offer.requestId)!;
    const version = currentVersion(offer);
    const guest = getUser(request.guestId);
    const status = STATUS[offer.status];
    return (
      <li key={offer.id} className={`card offer ${offer.status}`}>
        <div className="offer-head">
          <div>
            <strong>
              {eventTypeLabel(request.input.eventType)}, {request.input.guestCount} gjester
            </strong>
            <span className="muted">{formatDateRange(request.input.date)}</span>
          </div>
          <span className={status.badge}>{status.label}</span>
        </div>
        <p>
          <strong>{formatNok(version.totalPriceNok)}</strong>, sendt {timeAgo(offer.createdAt)}.{" "}
          {offer.status === "active" &&
            `${billingOpened(offer.id) ? "Gjesten har sett tilbudet." : "Ikke åpnet ennå."} Gjelder til ${formatDate(version.validUntil)}.`}
        </p>
        {offer.status === "confirmed" && guest?.kind === "guest" && (
          <p className="contact">
            Gjest: <strong>{guest.name}</strong>, <a href={`tel:${guest.phone}`}>{prettyPhone(guest.phone)}</a>
            {guest.email && (
              <>
                , <a href={`mailto:${guest.email}`}>{guest.email}</a>
              </>
            )}
          </p>
        )}
        <div className="actions-row">
          {offer.status === "confirmed" && (
            <Link href={`/avtale/${offer.id}`} className="button button-primary">
              Bestilling {offer.reference}
            </Link>
          )}
          {offer.status === "active" && canWithdraw && (
            <form action={withdrawOfferAction}>
              <input type="hidden" name="offerId" value={offer.id} />
              <button className="link-button">Trekk tilbudet</button>
            </form>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Våre tilbud</h1>
          <p className="muted">
            Når gjesten godtar et tilbud, er det bindende med en gang. Trekk tilbud dere ikke lenger kan holde, for
            eksempel hvis datoen er booket et annet sted.
          </p>
        </div>
      </div>
      {sendt && <p className="notice good">Tilbudet er sendt. Gjesten får beskjed.</p>}
      <ErrorNotice message={feil} />

      {offers.length === 0 && (
        <div className="empty">
          <p>Dere har ikke sendt noen tilbud ennå.</p>
          <Link href="/lokale" className="button button-primary">
            Se forespørsler
          </Link>
        </div>
      )}
      {booked.length > 0 && (
        <>
          <h2 className="section-title">Booket</h2>
          <ul className="list">{booked.map(renderOffer)}</ul>
        </>
      )}
      {waiting.length > 0 && (
        <>
          <h2 className="section-title">Venter på gjesten</h2>
          <ul className="list">{waiting.map(renderOffer)}</ul>
        </>
      )}
      {closed.length > 0 && (
        <details className="earlier">
          <summary>Avsluttede tilbud ({closed.length})</summary>
          <ul className="list">{closed.map(renderOffer)}</ul>
        </details>
      )}
    </>
  );
}
