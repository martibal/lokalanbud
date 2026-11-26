import { FREE_INTRO_OFFERS } from "@lokalbud/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireVenueUser } from "@/lib/demo/session";
import { DemoRuleError, getRequest, venueBilling } from "@/lib/demo/store";
import { eventTypeLabel, formatDateTime, formatNok } from "@/lib/format";

export const metadata: Metadata = { title: "Faktura" };

export default async function BillingPage() {
  const user = await requireVenueUser();
  let data: ReturnType<typeof venueBilling>;
  try {
    data = venueBilling(user.id);
  } catch (error) {
    if (error instanceof DemoRuleError) redirect("/lokale");
    throw error;
  }
  const { events, venue } = data;
  const total = events.reduce((sum, e) => sum + e.feeNok, 0);
  const freeLeft = Math.max(0, FREE_INTRO_OFFERS - venue.freeIntroOffersUsed);

  return (
    <>
      <div className="page-head">
        <h1>Fakturagrunnlag</h1>
      </div>
      <p className="lead">
        Dere betaler bare for tilbud gjesten har åpnet. Alt samles på én faktura i måneden. Beløp er uten mva.
      </p>
      <div className="stats">
        <div className="stat highlight">
          <strong>{formatNok(total)}</strong>
          <span>denne måneden, uten mva</span>
        </div>
        <div className="stat">
          <strong>{events.length}</strong>
          <span>åpnede tilbud</span>
        </div>
        <div className="stat">
          <strong>
            {freeLeft} av {FREE_INTRO_OFFERS}
          </strong>
          <span>gratistilbud igjen</span>
        </div>
      </div>
      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Åpnet</th>
                <th scope="col">Forespørsel</th>
                <th scope="col" className="num">
                  Beløp
                </th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Ingen åpnede tilbud ennå.
                  </td>
                </tr>
              )}
              {events.map((e) => {
                const request = getRequest(e.requestId);
                return (
                  <tr key={e.id}>
                    <td>{formatDateTime(e.openedAt)}</td>
                    <td>
                      {request
                        ? `${eventTypeLabel(request.input.eventType)}, ${request.input.guestCount} gjester`
                        : "–"}
                    </td>
                    <td className="num">{e.freeIntro ? "Gratis" : formatNok(e.feeNok)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
