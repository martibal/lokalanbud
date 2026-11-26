import type { DemoRequest } from "@/lib/demo/store";
import { areasLabel, criterionLabel, eventTypeLabel, formatDateRange, formatNok } from "@/lib/format";

/** Sammendrag av en forespørsel. Viser aldri gjestens navn eller nummer. */
export function RequestSummary({ request, urgent }: { request: DemoRequest; urgent?: boolean }) {
  const { input } = request;
  const must = request.criteria.filter((c) => c.importance === "must");
  const wish = request.criteria.filter((c) => c.importance === "wish");
  return (
    <div className="card summary">
      <div className="summary-head">
        <h2>
          {eventTypeLabel(input.eventType)}, {input.guestCount} gjester
        </h2>
        {urgent && <span className="badge urgent">Haster</span>}
      </div>
      <dl className="facts">
        <div>
          <dt>Dato</dt>
          <dd>
            {formatDateRange(input.date)}
            {input.startTime && `, fra kl. ${input.startTime}`}
          </dd>
        </div>
        <div>
          <dt>Område</dt>
          <dd>{areasLabel(input.areas)}</dd>
        </div>
        <div>
          <dt>Budsjett</dt>
          <dd>
            {formatNok(input.budget.amountNok)} totalt
            {input.budget.indicative && " (veiledende)"}
          </dd>
        </div>
      </dl>
      {must.length > 0 && (
        <>
          <h3>Må-krav</h3>
          <ul className="tags">
            {must.map((c) => (
              <li key={c.id} className="tag must">
                {criterionLabel(c)}
              </li>
            ))}
          </ul>
        </>
      )}
      {wish.length > 0 && (
        <>
          <h3>Ønsker</h3>
          <ul className="tags">
            {wish.map((c) => (
              <li key={c.id} className="tag">
                {criterionLabel(c)}
              </li>
            ))}
          </ul>
        </>
      )}
      {input.description && <p className="description">{input.description}</p>}
    </div>
  );
}
