"use client";

import { FREE_INTRO_OFFERS, formatNok, offerFeeNok, type AnswerValue, type Importance } from "@lokalbud/core";
import { useState, useTransition } from "react";
import { submitOfferAction } from "@/lib/demo/actions";

type CriterionView = { id: string; label: string; importance: Importance };

const OPTIONS: { value: AnswerValue; label: string }[] = [
  { value: "meets", label: "Oppfylt" },
  { value: "meets_with_reservation", label: "Med forbehold" },
  { value: "does_not_meet", label: "Ikke oppfylt" },
];

export function OfferForm({
  requestId,
  criteria,
  budgetNok,
  budgetIndicative,
  freeIntroUsed,
}: {
  requestId: string;
  criteria: CriterionView[];
  budgetNok: number;
  budgetIndicative: boolean;
  freeIntroUsed: number;
}) {
  const [answers, setAnswers] = useState<Record<string, { value: AnswerValue | ""; comment: string }>>(() =>
    Object.fromEntries(criteria.map((c) => [c.id, { value: "", comment: "" }])),
  );
  const [price, setPrice] = useState("");
  const [conditions, setConditions] = useState("");
  const [cancellation, setCancellation] = useState("Gratis avbestilling inntil 30 dager før.");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const priceNok = Number(price.replace(/[\s.]/g, ""));
  const priceValid = Number.isSafeInteger(priceNok) && priceNok > 0;
  const blockingMust = criteria.filter((c) => c.importance === "must" && answers[c.id]?.value === "does_not_meet");
  const unanswered = criteria.filter((c) => !answers[c.id]?.value);
  const missingComment = criteria.filter(
    (c) => answers[c.id]?.value && answers[c.id]?.value !== "meets" && (answers[c.id]?.comment.trim().length ?? 0) < 5,
  );

  const free = freeIntroUsed < FREE_INTRO_OFFERS;
  const feeBasis = budgetIndicative ? (priceValid ? priceNok : undefined) : budgetNok;
  const feeText = free
    ? `Gratis. Dette er introduksjonstilbud ${freeIntroUsed + 1} av ${FREE_INTRO_OFFERS}.`
    : feeBasis
      ? `${formatNok(offerFeeNok(feeBasis))} uten mva, bare hvis gjesten åpner tilbudet.`
      : "Regnes av totalprisen deres, fordi budsjettet er veiledende.";

  function setAnswer(id: string, patch: Partial<{ value: AnswerValue; comment: string }>) {
    setAnswers((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }));
    setError(undefined);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (blockingMust.length > 0) return setError("Et må-krav er ikke oppfylt. Svar «Passer ikke» i stedet.");
    if (unanswered.length > 0) return setError("Svar på alle kravene.");
    if (missingComment.length > 0) return setError("Forklar alle avvik med en kort kommentar.");
    if (!priceValid) return setError("Oppgi totalpris i hele kroner.");
    if (conditions.trim().length < 10) return setError("Beskriv kort hva som er inkludert.");
    startTransition(async () => {
      const result = await submitOfferAction({
        requestId,
        totalPriceNok: priceNok,
        conditions,
        cancellationTerms: cancellation,
        answers: criteria.map((c) => ({
          criterionId: c.id,
          value: answers[c.id]!.value as AnswerValue,
          comment: answers[c.id]!.comment,
        })),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form className="request-form" onSubmit={submit} noValidate>
      <fieldset>
        <legend>Svar på hvert krav</legend>
        <ul className="criteria">
          {criteria.map((c) => {
            const a = answers[c.id]!;
            const options = c.importance === "must" ? OPTIONS.filter((o) => o.value !== "meets_with_reservation") : OPTIONS;
            return (
              <li key={c.id}>
                <span id={`k-${c.id}`}>
                  {c.label} {c.importance === "must" ? <span className="tag must small">Må</span> : <span className="tag small">Ønske</span>}
                </span>
                <div className="segmented small" role="radiogroup" aria-labelledby={`k-${c.id}`}>
                  {options.map((o) => (
                    <label key={o.value} className={a.value === o.value ? `selected ${o.value}` : undefined}>
                      <input
                        type="radio"
                        name={`svar-${c.id}`}
                        checked={a.value === o.value}
                        onChange={() => setAnswer(c.id, { value: o.value })}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
                {a.value && a.value !== "meets" && c.importance !== "must" && (
                  <input
                    aria-label={`Forklaring for ${c.label}`}
                    placeholder="Forklar kort, for eksempel: rampe ved bakinngangen"
                    maxLength={500}
                    value={a.comment}
                    onChange={(e) => setAnswer(c.id, { comment: e.target.value })}
                  />
                )}
                {c.importance === "must" && a.value === "does_not_meet" && (
                  <p className="field-error">Dette er et må-krav. Dere kan ikke sende tilbud, men kan svare «Passer ikke» gratis.</p>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset>
        <legend>Pris og vilkår</legend>
        <label htmlFor="pris">Totalpris for hele arrangementet</label>
        <div className="suffix-input">
          <input id="pris" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
          <span aria-hidden="true">kr</span>
        </div>
        <p className="muted small">Gjestens budsjett: {formatNok(budgetNok)}{budgetIndicative ? " (veiledende)" : ""}</p>
        <label htmlFor="inkludert">Hva er inkludert</label>
        <textarea
          id="inkludert"
          rows={3}
          maxLength={2000}
          placeholder="For eksempel: leie fra kl. 17 til 01, bord, stoler, lydanlegg og vakt"
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
        />
        <label htmlFor="avbestilling">Avbestillingsvilkår</label>
        <input id="avbestilling" maxLength={1000} value={cancellation} onChange={(e) => setCancellation(e.target.value)} />
      </fieldset>

      <div className="card fee">
        <strong>Pris for dette tilbudet</strong>
        <p>{feeText}</p>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button button-primary" disabled={pending || blockingMust.length > 0}>
        {pending ? "Sender …" : "Send tilbud"}
      </button>
    </form>
  );
}
