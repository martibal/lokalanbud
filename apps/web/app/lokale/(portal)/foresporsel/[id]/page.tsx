import { MAX_OFFER_SLOTS } from "@lokalbud/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestSummary } from "@/components/RequestSummary";
import { declineAction } from "@/lib/demo/actions";
import { requireVenueUser } from "@/lib/demo/session";
import { currentVersion, getVenue, openRequestsForVenue } from "@/lib/demo/store";
import { criterionLabel, formatNok } from "@/lib/format";
import { OfferForm } from "./OfferForm";

export const metadata: Metadata = { title: "Svar på forespørsel" };

export default async function VenueRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireVenueUser();
  const venue = getVenue(user.venueId)!;
  const { id } = await params;
  const view = openRequestsForVenue(user.id).find((r) => r.request.id === id);
  if (!view) notFound();
  const { request, urgent, slotsLeft, ownOffer, declined } = view;
  const canOffer = !ownOffer && !declined && slotsLeft > 0 && user.role !== "accounting";

  return (
    <>
      <p className="breadcrumb">
        <Link href="/lokale">Alle forespørsler</Link>
      </p>
      <div className="two-col">
        <div>
          <RequestSummary request={request} urgent={urgent} />
          {canOffer && (
            <OfferForm
              requestId={request.id}
              criteria={request.criteria.map((c) => ({ id: c.id, label: criterionLabel(c), importance: c.importance }))}
              budgetNok={request.input.budget.amountNok}
              budgetIndicative={request.input.budget.indicative}
              freeIntroUsed={venue.freeIntroOffersUsed}
            />
          )}
        </div>

        <aside className="sticky">
          <div className="card">
            <h2>Tilbudsplasser</h2>
            <p className="slots" aria-label={`${slotsLeft} av ${MAX_OFFER_SLOTS} ledige`}>
              {Array.from({ length: MAX_OFFER_SLOTS }, (_, i) => (
                <i key={i} className={i < slotsLeft ? "free" : undefined} />
              ))}
              <span>
                {slotsLeft} av {MAX_OFFER_SLOTS} ledige
              </span>
            </p>
            <p className="muted small">Den som sender først, får plassen. Gjesten kan be om en ny runde senere.</p>
          </div>

          {ownOffer ? (
            <div className="card success">
              <h2>Dere har sendt tilbud</h2>
              <p>
                {formatNok(currentVersion(ownOffer).totalPriceNok)}, versjon {currentVersion(ownOffer).version}.
              </p>
              <Link href="/lokale/tilbud" className="button">
                Se våre tilbud
              </Link>
            </div>
          ) : declined ? (
            <div className="card">
              <p>Dere har svart «Passer ikke» på denne forespørselen.</p>
            </div>
          ) : slotsLeft <= 0 ? (
            <div className="card">
              <p>Alle tilbudsplassene er tatt.</p>
            </div>
          ) : user.role === "accounting" ? (
            <div className="card">
              <p>Regnskap kan se forespørsler, men ikke sende tilbud.</p>
            </div>
          ) : (
            <form action={declineAction} className="card">
              <input type="hidden" name="requestId" value={request.id} />
              <h2>Passer ikke?</h2>
              <p className="muted small">Gratis. Forespørselen skjules for dere, og gjesten får ikke beskjed.</p>
              <div className="field request-form">
                <label htmlFor="reason">Hvorfor (valgfritt)</label>
                <select id="reason" name="reason" defaultValue="">
                  <option value="">Velg …</option>
                  <option value="dato">Datoen er opptatt</option>
                  <option value="krav">Vi oppfyller ikke kravene</option>
                  <option value="pris">Budsjettet er for lavt</option>
                  <option value="storrelse">Feil størrelse</option>
                  <option value="annet">Annet</option>
                </select>
              </div>
              <button className="button button-block">Svar «Passer ikke»</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
