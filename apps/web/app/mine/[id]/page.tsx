import { MAX_OFFER_SLOTS, areaName } from "@lokalbud/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorNotice } from "@/components/ErrorNotice";
import { RequestSummary } from "@/components/RequestSummary";
import { acceptOfferAction, closeRequestAction, newRoundAction, openOfferAction } from "@/lib/demo/actions";
import { requireGuest } from "@/lib/demo/session";
import {
  billingOpened,
  currentVersion,
  getRequest,
  getVenue,
  offersForRequest,
  requestIsUrgent,
  type DemoOffer,
  type DemoRequest,
} from "@/lib/demo/store";
import { ANSWER_LABELS, criterionLabel, formatDateTime, formatNok, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Forespørsel" };

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feil?: string }>;
}) {
  const guest = await requireGuest();
  const { id } = await params;
  const { feil } = await searchParams;
  const request = getRequest(id);
  if (!request || request.guestId !== guest.id) notFound();

  const all = offersForRequest(request.id);
  const confirmed = all.find((o) => o.status === "confirmed");
  const accepted = all.find((o) => o.status === "accepted");
  const current = all.filter((o) => o.round === request.round && o.status !== "superseded");
  const earlier = all.filter((o) => o.status === "superseded");
  const opened = current.filter((o) => billingOpened(o.id));
  const canAct = request.status === "open" && !accepted;

  return (
    <>
      <p className="breadcrumb">
        <Link href="/mine">Mine forespørsler</Link>
      </p>
      <ErrorNotice message={feil} />

      {confirmed && (
        <div className="card success">
          <h2>Booket hos {getVenue(confirmed.venueId)?.name}</h2>
          <p>Lokalet har bekreftet. Avtalen er bindende for begge parter.</p>
          <Link href={`/avtale/${confirmed.id}`} className="button button-primary">
            Se avtaledokumentet
          </Link>
        </div>
      )}
      {accepted && (
        <div className="card notice-card">
          <h2>Venter på bekreftelse fra {getVenue(accepted.venueId)?.name}</h2>
          <p>
            Du har akseptert tilbudet. Lokalet har fått navnet og nummeret ditt og må bekrefte innen
            fristen. Du får SMS når det skjer.
          </p>
        </div>
      )}

      <RequestSummary request={request} urgent={requestIsUrgent(request)} />

      <div className="section-head">
        <h2>
          Tilbud{request.round > 1 && `, runde ${request.round}`}
          <span className="muted">
            {" "}
            {current.filter((o) => o.status !== "declined").length} av {MAX_OFFER_SLOTS} plasser
          </span>
        </h2>
      </div>

      {current.length === 0 && (
        <div className="card">
          <p>Ingen tilbud ennå. Lokalene som passer, er varslet, og de fleste svarer innen noen timer.</p>
        </div>
      )}

      {current.map((offer) => (
        <OfferCard key={offer.id} offer={offer} request={request} canAct={canAct} />
      ))}

      {opened.length >= 2 && <Comparison offers={opened} request={request} />}

      {request.status === "open" && !accepted && (
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

function OfferCard({ offer, request, canAct }: { offer: DemoOffer; request: DemoRequest; canAct: boolean }) {
  const venue = getVenue(offer.venueId)!;
  const version = currentVersion(offer);
  const isOpen = Boolean(billingOpened(offer.id));
  const wishes = request.criteria.filter((c) => c.importance === "wish");
  const wishesMet = wishes.filter(
    (c) => version.answers.find((a) => a.criterionId === c.id)?.value === "meets",
  ).length;

  if (!isOpen) {
    return (
      <div className="card offer teaser" id={`tilbud-${offer.id}`}>
        <div className="offer-head">
          <div>
            <strong>Nytt tilbud fra et lokale i {areaName(venue.area)}</strong>
            <span className="muted">Mottatt {timeAgo(offer.createdAt)}</span>
          </div>
        </div>
        <ul className="checks">
          <li>Oppfyller alle må-krav</li>
          {wishes.length > 0 && (
            <li>
              Oppfyller {wishesMet} av {wishes.length} ønsker helt
            </li>
          )}
        </ul>
        <form action={openOfferAction}>
          <input type="hidden" name="offerId" value={offer.id} />
          <input type="hidden" name="requestId" value={request.id} />
          <button className="button button-primary">Åpne tilbudet</button>
        </form>
      </div>
    );
  }

  return (
    <div className={`card offer ${offer.status}`} id={`tilbud-${offer.id}`}>
      <div className="offer-head">
        <div>
          <strong>{venue.name}</strong>
          <span className="muted">
            {areaName(venue.area)} · plass til {venue.capacity}
          </span>
        </div>
        <div className="price">{formatNok(version.totalPriceNok)}</div>
      </div>
      <p>{venue.description}</p>
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
      </ul>
      <h3>Hva er inkludert</h3>
      <p>{version.conditions}</p>
      <h3>Avbestilling</h3>
      <p>{version.cancellationTerms}</p>
      <p className="muted small">
        Versjon {version.version}, {formatDateTime(version.createdAt)}
      </p>
      {offer.status === "active" && canAct && (
        <form action={acceptOfferAction}>
          <input type="hidden" name="offerId" value={offer.id} />
          <input type="hidden" name="requestId" value={request.id} />
          <button className="button button-primary">Aksepter tilbudet</button>
          <p className="muted small">
            Lokalet får da navnet og nummeret ditt og må bekrefte. Du forplikter deg først når
            lokalet har bekreftet.
          </p>
        </form>
      )}
      {offer.status === "accepted" && <p className="badge accent">Akseptert, venter på bekreftelse</p>}
      {offer.status === "declined" && <p className="badge">Ikke valgt</p>}
    </div>
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
