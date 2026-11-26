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
  today,
  defaultValidUntil,
  lastValidDate,
}: {
  requestId: string;
  criteria: CriterionView[];
  budgetNok: number;
  budgetIndicative: boolean;
  freeIntroUsed: number;
  today: string;
  defaultValidUntil: string;
  lastValidDate: string;
}) {
  const [answers, setAnswers] = useState<Record<string, { value: AnswerValue | ""; comment: string }>>(() =>
    Object.fromEntries(criteria.map((c) => [c.id, { value: "", comment: "" }])),
  );
  const [price, setPrice] = useState("");
  const [conditions, setConditions] = useState("");
  const [cancellation, setCancellation] = useState("Gratis avbestilling inntil 30 dager før.");
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const priceNok = Number(price.replace(/[\s. ]/g, ""));
  const priceValid = price.trim() !== "" && Number.isSafeInteger(priceNok) && priceNok > 0;

  // Alle problemer samlet, slik at de kan vises både ved feltet og ved knappen.
  const problems: Record<string, string> = {};
  for (const c of criteria) {
    const a = answers[c.id]!;
    if (!a.value) problems[`a-${c.id}`] = "Velg et svar";
    else if (c.importance === "must" && a.value !== "meets")
      problems[`a-${c.id}`] = "Dette er et må-krav. Dere kan ikke sende tilbud, men kan svare «Passer ikke» gratis.";
    else if (a.value !== "meets" && a.comment.trim().length < 5) problems[`a-${c.id}`] = "Forklar avviket kort";
  }
  if (!priceValid) problems.price = "Oppgi totalpris i hele kroner";
  if (conditions.trim().length < 3) problems.conditions = "Skriv kort hva som er inkludert";
  if (!validUntil || validUntil < today || validUntil > lastValidDate)
    problems.validUntil = "Velg en dato mellom i dag og arrangementet";
  const mustBlocked = criteria.some((c) => c.importance === "must" && answers[c.id]?.value === "does_not_meet");
  const show = (key: string) =>
    attempted ? problems[key] : key.startsWith("a-") && mustBlocked ? problems[key] : undefined;

  const free = freeIntroUsed < FREE_INTRO_OFFERS;
  const feeBasis = budgetIndicative ? (priceValid ? priceNok : undefined) : budgetNok;
  const feeText = free
    ? `Gratis. Dette er introduksjonstilbud ${freeIntroUsed + 1} av ${FREE_INTRO_OFFERS}.`
    : feeBasis
      ? `${formatNok(offerFeeNok(feeBasis))} uten mva, og bare hvis gjesten åpner tilbudet.`
      : "Regnes av totalprisen deres, fordi gjestens pris er veiledende.";

  function setAnswer(id: string, patch: Partial<{ value: AnswerValue; comment: string }>) {
    setAnswers((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }));
    setServerError(undefined);
  }

  function allMet() {
    setAnswers((current) =>
      Object.fromEntries(Object.entries(current).map(([id, a]) => [id, { ...a, value: "meets" as AnswerValue }])),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setServerError(undefined);
    if (Object.keys(problems).length > 0) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".offer-form [data-problem='true']")?.scrollIntoView({ block: "center" }),
      );
      return;
    }
    startTransition(async () => {
      const result = await submitOfferAction({
        requestId,
        totalPriceNok: priceNok,
        conditions,
        cancellationTerms: cancellation,
        validUntil,
        answers: criteria.map((c) => ({
          criterionId: c.id,
          value: answers[c.id]!.value as AnswerValue,
          comment: answers[c.id]!.comment,
        })),
      });
      if (result?.error) setServerError(result.error);
    });
  }

  const problemCount = Object.keys(problems).length;

  return (
    <form className="request-form offer-form" onSubmit={submit} noValidate>
      {criteria.length > 0 && (
        <section className="card">
          <div className="review-head">
            <h2>Svar på hvert krav</h2>
            <button type="button" className="link-button" onClick={allMet}>
              Alt er oppfylt
            </button>
          </div>
          <p className="hint">Må-krav må være oppfylt. Avvik fra et ønske forklarer du med én setning.</p>
          <ul className="criteria-answers">
            {criteria.map((c) => {
              const a = answers[c.id]!;
              const options =
                c.importance === "must" ? OPTIONS.filter((o) => o.value !== "meets_with_reservation") : OPTIONS;
              const problem = show(`a-${c.id}`);
              return (
                <li key={c.id} data-problem={Boolean(problem)}>
                  <span id={`k-${c.id}`} className="crit-label">
                    {c.label}{" "}
                    {c.importance === "must" ? (
                      <span className="tag must small">Må</span>
                    ) : (
                      <span className="tag small">Ønske</span>
                    )}
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
                  {problem && <p className="field-error">{problem}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Pris og vilkår</h2>
        <div className="row">
          <div className="field" data-problem={Boolean(show("price"))}>
            <label htmlFor="pris">Totalpris</label>
            <div className="suffix-input">
              <input
                id="pris"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-invalid={Boolean(show("price"))}
              />
              <span aria-hidden="true">kr</span>
            </div>
            <p className="hint spaced">
              Gjestens makspris: {formatNok(budgetNok)}
              {budgetIndicative ? ", veiledende" : ""}
            </p>
            {show("price") && <p className="field-error">{show("price")}</p>}
          </div>
          <div className="field" data-problem={Boolean(show("validUntil"))}>
            <label htmlFor="gyldig">Tilbudet gjelder til</label>
            <input
              id="gyldig"
              type="date"
              min={today}
              max={lastValidDate}
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              aria-invalid={Boolean(show("validUntil"))}
            />
            <p className="hint spaced">Dere holder datoen av til da. Godtar gjesten innen fristen, er det bindende.</p>
            {show("validUntil") && <p className="field-error">{show("validUntil")}</p>}
          </div>
        </div>
        <div className="field" data-problem={Boolean(show("conditions"))}>
          <label htmlFor="inkludert">Hva er inkludert</label>
          <textarea
            id="inkludert"
            rows={3}
            maxLength={2000}
            placeholder="For eksempel: leie fra kl. 17 til 01, bord, stoler, lydanlegg og vakt"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            aria-invalid={Boolean(show("conditions"))}
          />
          {show("conditions") && <p className="field-error">{show("conditions")}</p>}
        </div>
        <div className="field">
          <label htmlFor="avbestilling">Avbestillingsvilkår</label>
          <input
            id="avbestilling"
            maxLength={1000}
            value={cancellation}
            onChange={(e) => setCancellation(e.target.value)}
          />
        </div>
      </section>

      <div className="card fee">
        <strong>Pris for dette tilbudet</strong>
        <p>{feeText}</p>
      </div>

      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}
      {attempted && problemCount > 0 && (
        <p className="form-error" role="alert">
          {problemCount === 1 ? "Ett felt mangler eller må rettes." : `${problemCount} felt mangler eller må rettes.`}{" "}
          Se de røde meldingene over.
        </p>
      )}
      {mustBlocked && (
        <p className="form-error">
          Et må-krav er ikke oppfylt, så dere kan ikke sende tilbud. Svar «Passer ikke» i stedet.
        </p>
      )}
      <button type="submit" className="button button-party button-block" disabled={pending || mustBlocked}>
        {pending ? "Sender …" : "Send tilbud"}
      </button>
    </form>
  );
}
