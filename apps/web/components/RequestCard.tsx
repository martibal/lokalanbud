import { MAX_OFFER_SLOTS } from "@lokalbud/core";
import Link from "next/link";
import type { OpenRequestView } from "@/lib/demo/store";
import { areasLabel, criterionLabel, eventTypeLabel, formatDateRange, formatNok, timeAgo } from "@/lib/format";

/** Kort for én forespørsel i lokalets oversikt. Alt som avgjør om det er verdt å svare, står på kortet. */
export function RequestCard({ view, fits }: { view: OpenRequestView; fits: boolean }) {
  const { request, urgent, slotsLeft, ownOffer, declined } = view;
  const { input } = request;
  const must = request.criteria.filter((c) => c.importance === "must");
  return (
    <Link href={`/lokale/foresporsel/${request.id}`} className={urgent ? "request-card urgent" : "request-card"}>
      <div className="request-card-badges">
        {urgent && <span className="badge urgent">Haster</span>}
        {fits && <span className="badge good">Passer for dere</span>}
        {ownOffer && <span className="badge accent">Tilbud sendt</span>}
        {declined && <span className="badge">Avslått</span>}
      </div>
      <h3>
        {eventTypeLabel(input.eventType)}, {input.guestCount} gjester
      </h3>
      <p className="budget">
        {formatNok(input.budget.amountNok)} {input.budget.indicative && <small>veiledende</small>}
      </p>
      <p className="meta">{formatDateRange(input.date)}</p>
      <p className="meta">{areasLabel(input.areas)}</p>
      {must.length > 0 && (
        <ul className="tags">
          {must.map((c) => (
            <li key={c.id} className="tag must">
              Må: {criterionLabel(c)}
            </li>
          ))}
        </ul>
      )}
      <div className="request-card-foot">
        <span className="slots" aria-label={`${slotsLeft} av ${MAX_OFFER_SLOTS} tilbudsplasser ledige`}>
          {Array.from({ length: MAX_OFFER_SLOTS }, (_, i) => (
            <i key={i} className={i < slotsLeft ? "free" : undefined} />
          ))}
          <span>{slotsLeft === 0 ? "Fullt" : `${slotsLeft} ledige`}</span>
        </span>
        <span className="muted">{timeAgo(request.createdAt)}</span>
      </div>
    </Link>
  );
}
