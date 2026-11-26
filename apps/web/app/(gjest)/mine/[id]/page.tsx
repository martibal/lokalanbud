import { MAX_OFFER_SLOTS, areaName } from "@lokalbud/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcceptOffer } from "@/components/AcceptOffer";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Gallery } from "@/components/Gallery";
import { RequestSummary } from "@/components/RequestSummary";
import { closeRequestAction, newRoundAction, openOfferAction } from "@/lib/demo/actions";
import { requireGuest } from "@/lib/demo/session";
import {
  billingOpened,
  currentVersion,
  getRequest,
  getUser,
  getVenue,
  offersForRequest,
  requestIsUrgent,
  type DemoOffer,
  type DemoRequest,
} from "@/lib/demo/store";
import { ANSWER_LABELS, criterionLabel, formatDate, formatNok, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Tilbudene dine" };

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feil?: string; ny?: string }>;
}) {
  const guest = await requireGuest();
  const { id } = await params;
  const { feil, ny } = await searchParams;
  const request = getRequest(id);
  if (!request || request.guestId !== guest.id) notFound();

  const all = offersForRequest(request.id);
  const booked = all.find((o) => o.status === "confirmed");
  const current = all.filter((o) => o.round === request.round && o.status !== "superseded" && o.status !== "withdrawn");
  const earlier = all.filter((o) => o.status === "superseded");
  const opened = current.filter((o) => billingOpened(o.id));
  const canAccept = request.status === "open";
  const contactDefaults = { name: guest.name, phone: guest.phone.replace(/^\+47/, ""), email: guest.email ?? "" };

  return (
    <>
      <p className="breadcrumb">
        <Link href="/mine">Mine forespørsler</Link>
      </p>
      <ErrorNotice message={feil} />
      {ny && (
        <p className="notice good">
          Forespørselen er publisert. Lokalene ser den nå, og du får beskjed når det kommer tilbud.
        </p>
      )}

      {booked ? (
        <div className="card success">
          <h2>Booket hos {getVenue(booked.venueId)?.name}</h2>
          <p>Bestillingen er bindende for begge. Dere har fått en kopi på e-post.</p>
          <Link href={`/avtale/${booked.id}`} className="button button-primary">
            Se bestillingen
          </Link>
        </div>
      ) : (
        <div className="page-head">
          <div>
            <h1>
              {current.length === 0
                ? "Venter på tilbud"
                : `${current.length} ${current.length === 1 ? "tilbud" : "tilbud"} å velge mellom`}
            </h1>
            <p className="muted">
              {current.length} av {MAX_OFFER_SLOTS} plasser er fylt{request.round > 1 ? `, runde ${request.round}` : ""}
              . Trykk på et tilbud for å se lokalet, bilder og kontaktperson.
            </p>
          </div>
        </div>
      )}

      {current.length === 0 && !booked && (
        <div className="empty">
          <p>Lokalene som passer, ser forespørselen nå. De fleste svarer innen noen timer.</p>
        </div>
      )}

      {current.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          request={request}
          canAccept={canAccept}
          contactDefaults={contactDefaults}
        />
      ))}

      {opened.length >= 2 && !booked && <Comparison offers={opened} request={request} />}

      <details className="card request-details">
        <summary>Det du ba om</summary>
        <RequestSummary request={request} urgent={requestIsUrgent(request)} />
      </details>

      {request.status === "open" && (
        <div className="actions-row">
          <form action={newRoundAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <button className="button">Be om nye tilbud</button>
          </form>
          <form action={closeRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <button className="link-button">Avslutt forespørselen</button>
          </form>
        </div>
      )}

      {earlier.length > 0 && (
        <details className="earlier">
          <summary>Tilbud fra tidligere runder ({earlier.length})</summary>
          {earlier.map((o) => (
            <p key={o.id} className="muted">
              {billingOpened(o.id) ? getVenue(o.venueId)?.name : `Lokale i ${areaName(getVenue(o.venueId)!.area)}`}:{" "}
              {billingOpened(o.id) ? formatNok(currentVersion(o).totalPriceNok) : "ikke åpnet"}
            </p>
          ))}
        </details>
      )}
    </>
  );
}

function OfferCard({
  offer,
  request,
  canAccept,
  contactDefaults,
}: {
  offer: DemoOffer;
  request: DemoRequest;
  canAccept: boolean;
  contactDefaults: { name: string; phone: string; email: string };
}) {
  const venue = getVenue(offer.venueId)!;
  const version = currentVersion(offer);
  const isOpen = Boolean(billingOpened(offer.id));
  const wishes = request.criteria.filter((c) => c.importance === "wish");
  const wishesMet = wishes.filter((c) => version.answers.find((a) => a.criterionId === c.id)?.value === "meets").length;

  if (!isOpen) {
    return (
      <form action={openOfferAction} className="card offer teaser" id={`tilbud-${offer.id}`}>
        <input type="hidden" name="offerId" value={offer.id} />
        <input type="hidden" name="requestId" value={request.id} />
        <div className="offer-head">
          <div>
            <strong>Nytt tilbud fra et lokale i {areaName(venue.area)}</strong>
            <span className="muted">Mottatt {timeAgo(offer.createdAt)}</span>
          </div>
          <span className="badge party">Nytt</span>
        </div>
        <ul className="checks">
          <li>Oppfyller alle må-krav</li>
          {wishes.length > 0 && (
            <li>
              Oppfyller {wishesMet} av {wishes.length} ønsker helt
            </li>
          )}
          <li>Gjelder til {formatDate(version.validUntil)}</li>
        </ul>
        <button className="button button-party">Se tilbudet</button>
      </form>
    );
  }

  const sender = getUser(version.createdBy);
  const expired = version.validUntil < new Date().toISOString().slice(0, 10);

  return (
    <article className={`card offer offer-full ${offer.status}`} id={`tilbud-${offer.id}`}>
      <div className="offer-layout">
        <Gallery images={venue.images} name={venue.name} />
        <div className="offer-info">
          <div className="offer-head">
            <div>
              <h2>{venue.name}</h2>
              <span className="muted">
                {venue.address}, {areaName(venue.area)}. Plass til {venue.capacity}.
              </span>
            </div>
          </div>
          <p className="offer-price">{formatNok(version.totalPriceNok)}</p>
          <p className="muted small">
            Totalpris. {expired ? "Tilbudet har gått ut." : `Gjelder til ${formatDate(version.validUntil)}.`}
          </p>
          <p>{venue.description}</p>
          <ul className="highlights">
            {venue.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="offer-details">
        <div>
          <h3>Svar på det du ba om</h3>
          <ul className="answers">
            {request.criteria.map((c) => {
              const a = version.answers.find((x) => x.criterionId === c.id);
              return (
                <li key={c.id} className={`answer ${a?.value ?? ""}`}>
                  <span className="answer-label">
                    {criterionLabel(c)}
                    {c.importance === "must" && <span className="tag must small">Må</span>}
                  </span>
                  <span className="answer-value">{a ? ANSWER_LABELS[a.value] : "Ikke besvart"}</span>
                  {a?.comment && <span className="answer-comment">{a.comment}</span>}
                </li>
              );
            })}
            {request.criteria.length === 0 && <li className="muted">Du la ikke inn spesielle krav.</li>}
          </ul>
          <h3>Inkludert</h3>
          <p>{version.conditions}</p>
          <h3>Avbestilling</h3>
          <p>{version.cancellationTerms}</p>
        </div>
        {sender?.kind === "venue" && (
          <aside className="contact-card">
            <h3>Kontaktperson</h3>
            <p>
              <strong>{sender.name.replace(/ \(.*\)$/, "")}</strong>
              <br />
              {venue.name}
            </p>
            <p>
              <a href={`tel:${sender.phone}`}>{sender.phone.replace(/^\+47(\d{3})(\d{2})(\d{3})$/, "$1 $2 $3")}</a>
              <br />
              <a href={`mailto:${sender.email}`}>{sender.email}</a>
            </p>
          </aside>
        )}
      </div>

      {offer.status === "active" && canAccept && !expired && (
        <AcceptOffer
          offerId={offer.id}
          venueName={venue.name}
          priceText={formatNok(version.totalPriceNok)}
          defaults={contactDefaults}
        />
      )}
      {offer.status === "confirmed" && <p className="badge good">Booket</p>}
      {offer.status === "declined" && <p className="badge">Ikke valgt</p>}
    </article>
  );
}

function Comparison({ offers, request }: { offers: DemoOffer[]; request: DemoRequest }) {
  return (
    <div className="card comparison">
      <h2>Sammenlign</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col" />
              {offers.map((o) => (
                <th key={o.id} scope="col">
                  {getVenue(o.venueId)?.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Totalpris</th>
              {offers.map((o) => (
                <td key={o.id} className="strong">
                  {formatNok(currentVersion(o).totalPriceNok)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Gjelder til</th>
              {offers.map((o) => (
                <td key={o.id}>{formatDate(currentVersion(o).validUntil)}</td>
              ))}
            </tr>
            {request.criteria.map((c) => (
              <tr key={c.id}>
                <th scope="row">{criterionLabel(c)}</th>
                {offers.map((o) => {
                  const a = currentVersion(o).answers.find((x) => x.criterionId === c.id);
                  return (
                    <td key={o.id} className={`answer ${a?.value ?? ""}`}>
                      {a ? ANSWER_LABELS[a.value] : "–"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
