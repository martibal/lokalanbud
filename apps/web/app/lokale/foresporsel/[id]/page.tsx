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

  return (
    <>
      <p className="breadcrumb">
        <Link href="/lokale">Forespørsler</Link>
      </p>
      <RequestSummary request={request} urgent={urgent} />

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
          <p>Alle tre tilbudsplassene er tatt. Gjesten kan be om en ny runde senere.</p>
        </div>
      ) : user.role === "accounting" ? (
        <div className="card">
          <p>Regnskap kan se forespørsler, men ikke sende tilbud.</p>
        </div>
      ) : (
        <>
          <p className="notice">
            {slotsLeft} av 3 tilbudsplasser er ledige. Den som sender først, får plassen.
          </p>
          <OfferForm
            requestId={request.id}
            criteria={request.criteria.map((c) => ({ id: c.id, label: criterionLabel(c), importance: c.importance }))}
            budgetNok={request.input.budget.amountNok}
            budgetIndicative={request.input.budget.indicative}
            freeIntroUsed={venue.freeIntroOffersUsed}
          />
          <form action={declineAction} className="card decline">
            <input type="hidden" name="requestId" value={request.id} />
            <h2>Passer ikke?</h2>
            <p className="muted">Gratis. Forespørselen skjules for dere, og gjesten får ikke beskjed.</p>
            <label htmlFor="reason">Hvorfor (valgfritt, hjelper oss å sende bedre forespørsler)</label>
            <select id="reason" name="reason" defaultValue="">
              <option value="">Velg …</option>
              <option value="dato">Datoen er opptatt</option>
              <option value="krav">Vi oppfyller ikke kravene</option>
              <option value="pris">Budsjettet er for lavt</option>
              <option value="storrelse">Feil størrelse</option>
              <option value="annet">Annet</option>
            </select>
            <button className="button">Passer ikke</button>
          </form>
        </>
      )}
    </>
  );
}
