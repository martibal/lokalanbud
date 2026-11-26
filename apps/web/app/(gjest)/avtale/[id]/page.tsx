import { areaName } from "@lokalbud/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/demo/session";
import { getOffer, getRequest, getUser, getVenue, outboxForOffer } from "@/lib/demo/store";
import {
  ANSWER_LABELS,
  criterionLabel,
  eventTypeLabel,
  formatDateRange,
  formatDateTime,
  formatNok,
} from "@/lib/format";

export const metadata: Metadata = { title: "Bestilling" };

const prettyPhone = (p: string) => p.replace(/^\+47(\d{3})(\d{2})(\d{3})$/, "$1 $2 $3");

/** Bestillingen med godtatt tilbud. Gjest og lokale ser nøyaktig samme versjon. */
export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ny?: string }>;
}) {
  const user = await currentUser();
  const { id } = await params;
  const { ny } = await searchParams;
  const offer = getOffer(id);
  if (!offer || offer.status !== "confirmed" || !user) notFound();
  const request = getRequest(offer.requestId)!;
  const isGuest = user.kind === "guest" && user.id === request.guestId;
  const isVenue = user.kind === "venue" && user.venueId === offer.venueId;
  if (!isGuest && !isVenue) notFound();

  const venue = getVenue(offer.venueId)!;
  const guest = getUser(request.guestId)!;
  const version = offer.versions.find((v) => v.version === offer.acceptedVersion)!;
  const contact = getUser(version.createdBy);
  const copies = outboxForOffer(offer.id);

  return (
    <>
      {ny && (
        <div className="card success">
          <h2>Bestillingen er bekreftet</h2>
          <p>
            {venue.name} er booket. En kopi er sendt til {copies.map((c) => c.to).join(" og ")}.
          </p>
        </div>
      )}
      <article className="card agreement">
        <header>
          <p className="muted">Bestilling med godtatt tilbud</p>
          <h1 className="reference">{offer.reference}</h1>
          <p className="badge good">Bindende for begge parter</p>
        </header>

        <section>
          <h2>Parter</h2>
          <dl className="facts">
            <div>
              <dt>Gjest</dt>
              <dd>
                {guest.name}
                {guest.kind === "guest" && (
                  <>
                    <br />
                    {prettyPhone(guest.phone)}
                    {guest.email && (
                      <>
                        <br />
                        {guest.email}
                      </>
                    )}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Lokale</dt>
              <dd>
                {venue.name}, {venue.address}, {areaName(venue.area)}
                <br />
                Org.nr. {venue.orgNumber}
              </dd>
            </div>
            {contact?.kind === "venue" && (
              <div>
                <dt>Kontaktperson</dt>
                <dd>
                  {contact.name.replace(/ \(.*\)$/, "")}
                  <br />
                  {prettyPhone(contact.phone)}
                  <br />
                  {contact.email}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section>
          <h2>Arrangement</h2>
          <dl className="facts">
            <div>
              <dt>Type</dt>
              <dd>
                {eventTypeLabel(request.input.eventType)}, {request.input.guestCount} gjester
              </dd>
            </div>
            <div>
              <dt>Dato</dt>
              <dd>{formatDateRange(request.input.date)}</dd>
            </div>
            <div>
              <dt>Totalpris</dt>
              <dd className="strong">{formatNok(version.totalPriceNok)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2>Krav og svar</h2>
          <ul className="answers">
            {request.criteria.map((c) => {
              const a = version.answers.find((x) => x.criterionId === c.id);
              return (
                <li key={c.id} className={`answer ${a?.value ?? ""}`}>
                  <span className="answer-label">
                    {criterionLabel(c)} {c.importance === "must" && <span className="tag must small">Må</span>}
                  </span>
                  <span className="answer-value">{a ? ANSWER_LABELS[a.value] : "–"}</span>
                  {a?.comment && <span className="answer-comment">{a.comment}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2>Inkludert</h2>
          <p>{version.conditions}</p>
          <h2>Avbestilling</h2>
          <p>{version.cancellationTerms}</p>
        </section>

        <section className="muted small">
          <p>
            Tilbudsversjon {version.version}, sendt {formatDateTime(version.createdAt)}. Godtatt av gjesten{" "}
            {formatDateTime(offer.acceptedAt!)}.
          </p>
          {copies.length > 0 && (
            <p>
              Kopi sendt på e-post til {copies.map((c) => `${c.toName} (${c.to})`).join(" og ")}. I demoen sendes ingen
              e-post; kopiene ligger under <Link href="/demo">Demoverktøy</Link>.
            </p>
          )}
          <p className="hash">Kontrollsum (SHA-256): {version.contentHash}</p>
          <p>Avtalen er inngått mellom gjest og lokale. Lokalbud formidler og er ikke part i avtalen.</p>
        </section>
      </article>
    </>
  );
}
