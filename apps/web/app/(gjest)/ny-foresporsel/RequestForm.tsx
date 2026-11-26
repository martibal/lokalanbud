"use client";

import {
  EVENT_TYPES,
  FIXED_CRITERIA,
  MAX_CUSTOM_CRITERIA,
  OSLO_AREAS,
  formatNok,
  requestInputSchema,
  type AreaId,
  type FixedCriterionKey,
} from "@lokalbud/core";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { toFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { submitRequest } from "./actions";

type DateMode = "exact" | "flexible";
type CustomRow = { key: number; text: string; must: boolean };
type Step = 1 | 2 | 3;

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: "Arrangementet" },
  { step: 2, label: "Behovene" },
  { step: 3, label: "Se over" },
];

const QUICK_GUESTS = [20, 40, 60, 100, 150];

/** Hvilke felt som hører til hvilket steg, for å vise feil på riktig sted. */
function stepOf(path: string): Step {
  return /^(eventType|guestCount|areas|date)/.test(path) ? 1 : 2;
}

/** Tall fra et tekstfelt. Tomt eller ugyldig blir NaN, som skjemaet avviser med en tydelig melding. */
function toInt(value: string): number {
  const cleaned = value.replace(/[\s.]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}

const dateFormat = new Intl.DateTimeFormat("nb-NO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const fmtDate = (iso: string) => (iso ? dateFormat.format(new Date(`${iso}T00:00:00Z`)) : "");

export function RequestForm({ today }: { today: string }) {
  const id = useId();
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(1);

  const [eventType, setEventType] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [areas, setAreas] = useState<AreaId[]>([]);
  const [dateMode, setDateMode] = useState<DateMode>("exact");
  const [date, setDate] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [urgent, setUrgent] = useState(false);

  const [budget, setBudget] = useState("");
  const [indicative, setIndicative] = useState(false);
  const [facilities, setFacilities] = useState<FixedCriterionKey[]>([]);
  const [mustFacilities, setMustFacilities] = useState<FixedCriterionKey[]>([]);
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [nextKey, setNextKey] = useState(1);
  const [description, setDescription] = useState("");

  const [attempted, setAttempted] = useState<Record<Step, boolean>>({ 1: false, 2: false, 3: false });
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const input = {
    eventType,
    date:
      dateMode === "exact" ? { mode: "exact" as const, date } : { mode: "flexible" as const, from: date, to: dateTo },
    guestCount: toInt(guestCount),
    areas,
    budget: { amountNok: toInt(budget), indicative },
    fixedCriteria: Object.fromEntries(
      facilities.map((k) => [k, mustFacilities.includes(k) ? "must" : "wish"]),
    ) as Partial<Record<FixedCriterionKey, "must" | "wish">>,
    customCriteria: custom.map((c) => ({ text: c.text, importance: c.must ? ("must" as const) : ("wish" as const) })),
    markedUrgent: urgent,
    ...(description.trim() ? { description } : {}),
  };
  const inputKey = JSON.stringify(input);

  const allErrors = useMemo(() => {
    const check = requestInputSchema(today).safeParse(JSON.parse(inputKey));
    return check.success ? {} : toFieldErrors(check.error.issues);
  }, [today, inputKey]);

  const errorsFor = (s: Step) => Object.fromEntries(Object.entries(allErrors).filter(([path]) => stepOf(path) === s));
  const shown: FieldErrors = {
    ...serverErrors,
    ...(attempted[1] ? errorsFor(1) : {}),
    ...(attempted[2] ? errorsFor(2) : {}),
  };
  const err = (path: string) => shown[path];

  function goTo(next: Step) {
    setStep(next);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  }

  function next() {
    setAttempted((a) => ({ ...a, [step]: true }));
    if (Object.keys(errorsFor(step)).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    goTo((step + 1) as Step);
  }

  function publish() {
    setServerErrors({});
    if (Object.keys(allErrors).length > 0) {
      setAttempted({ 1: true, 2: true, 3: true });
      goTo(Object.keys(errorsFor(1)).length > 0 ? 1 : 2);
      return;
    }
    startTransition(async () => {
      const response = await submitRequest(input);
      if (response.ok) router.push(`/mine/${response.requestId}?ny=1`);
      else {
        setServerErrors(response.errors);
        setAttempted({ 1: true, 2: true, 3: true });
        goTo(Object.keys(response.errors).some((p) => stepOf(p) === 1) ? 1 : 2);
      }
    });
  }

  function toggleArea(area: AreaId) {
    setAreas((a) => (a.includes(area) ? a.filter((x) => x !== area) : [...a, area]));
  }

  function toggleFacility(key: FixedCriterionKey) {
    const removing = facilities.includes(key);
    setFacilities((f) => (removing ? f.filter((x) => x !== key) : [...f, key]));
    if (removing) setMustFacilities((m) => m.filter((x) => x !== key));
  }

  function addCustom() {
    const text = customDraft.trim();
    if (text.length < 3 || custom.length >= MAX_CUSTOM_CRITERIA) return;
    setCustom((rows) => [...rows, { key: nextKey, text, must: false }]);
    setNextKey((k) => k + 1);
    setCustomDraft("");
  }

  const allAreas = areas.length === OSLO_AREAS.length;
  const selectedLabels = [
    ...facilities.map((k) => ({
      id: `f-${k}`,
      label: FIXED_CRITERIA.find((c) => c.key === k)!.label,
      must: mustFacilities.includes(k),
      toggle: () => setMustFacilities((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k])),
    })),
    ...custom.map((c) => ({
      id: `c-${c.key}`,
      label: c.text,
      must: c.must,
      toggle: () => setCustom((rows) => rows.map((r) => (r.key === c.key ? { ...r, must: !r.must } : r))),
    })),
  ];

  return (
    <div className="wizard request-form" ref={topRef}>
      <ol className="progress" aria-label="Steg">
        {STEPS.map((s) => (
          <li
            key={s.step}
            className={s.step === step ? "current" : s.step < step ? "done" : undefined}
            aria-current={s.step === step ? "step" : undefined}
          >
            {s.label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="wizard-section" aria-labelledby={`${id}-s1`}>
          <h2 id={`${id}-s1`}>Hva skal dere feire?</h2>
          <p className="hint">Hva, hvor, når og hvor mange.</p>

          <div className="question">
            <span className="label" id={`${id}-type`}>
              Type arrangement
            </span>
            <div
              className="tiles"
              role="radiogroup"
              aria-labelledby={`${id}-type`}
              aria-invalid={Boolean(err("eventType"))}
            >
              {EVENT_TYPES.map((t) => (
                <label key={t.id} className={eventType === t.id ? "tile selected" : "tile"}>
                  <input
                    type="radio"
                    name={`${id}-eventType`}
                    value={t.id}
                    checked={eventType === t.id}
                    onChange={() => setEventType(t.id)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <FieldError message={err("eventType")} />
          </div>

          <div className="question">
            <label className="label" htmlFor={`${id}-guests`}>
              Hvor mange blir dere?
            </label>
            <input
              id={`${id}-guests`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Antall gjester"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              aria-invalid={Boolean(err("guestCount"))}
            />
            <div className="quick" aria-label="Vanlige antall">
              {QUICK_GUESTS.map((n) => (
                <button key={n} type="button" onClick={() => setGuestCount(String(n))}>
                  {n}
                </button>
              ))}
            </div>
            <FieldError message={err("guestCount")} />
          </div>

          <div className="question">
            <div className="chip-actions">
              <span className="label" id={`${id}-areas`}>
                Hvor i Oslo?
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => setAreas(allAreas ? [] : OSLO_AREAS.map((a) => a.id))}
              >
                {allAreas ? "Fjern alle" : "Hele Oslo"}
              </button>
            </div>
            <p className="hint">Velg så mange bydeler du vil. Flere bydeler gir flere tilbud.</p>
            <div
              className="chips"
              role="group"
              aria-labelledby={`${id}-areas`}
              aria-invalid={Boolean(err("areas"))}
              tabIndex={err("areas") ? -1 : undefined}
            >
              {OSLO_AREAS.map((a) => (
                <label key={a.id} className={areas.includes(a.id) ? "chip selected" : "chip"}>
                  <input type="checkbox" checked={areas.includes(a.id)} onChange={() => toggleArea(a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
            <FieldError message={err("areas")} />
          </div>

          <div className="question">
            <span className="label">Når?</span>
            <div className="segmented" role="radiogroup" aria-label="Datotype">
              {(["exact", "flexible"] as const).map((mode) => (
                <label key={mode} className={dateMode === mode ? "selected" : undefined}>
                  <input
                    type="radio"
                    name={`${id}-dateMode`}
                    checked={dateMode === mode}
                    onChange={() => setDateMode(mode)}
                  />
                  {mode === "exact" ? "Fast dato" : "Vi er fleksible"}
                </label>
              ))}
            </div>
            <div className="row spaced">
              <div className="field">
                <label htmlFor={`${id}-date`}>{dateMode === "exact" ? "Dato" : "Tidligst"}</label>
                <input
                  id={`${id}-date`}
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={Boolean(err("date") || err("date.date") || err("date.from"))}
                />
              </div>
              {dateMode === "flexible" && (
                <div className="field">
                  <label htmlFor={`${id}-dateTo`}>Senest</label>
                  <input
                    id={`${id}-dateTo`}
                    type="date"
                    min={date || today}
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-invalid={Boolean(err("date.to"))}
                  />
                </div>
              )}
            </div>
            <FieldError message={err("date") ?? err("date.date") ?? err("date.from") ?? err("date.to")} />
            <label className="check">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              Det haster, for eksempel etter en dobbeltbooking
            </label>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="wizard-section" aria-labelledby={`${id}-s2`}>
          <h2 id={`${id}-s2`}>Hva trenger dere?</h2>
          <p className="hint">Lokaler som ikke oppfyller et må-krav, kan ikke sende deg tilbud.</p>

          <div className="question">
            <label className="label" htmlFor={`${id}-budget`}>
              Makspris
            </label>
            <p className="hint">Totalt for hele arrangementet, med leie, mat og drikke.</p>
            <div className="suffix-input">
              <input
                id={`${id}-budget`}
                inputMode="numeric"
                autoComplete="off"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                aria-invalid={Boolean(err("budget.amountNok"))}
              />
              <span aria-hidden="true">kr</span>
            </div>
            <FieldError message={err("budget.amountNok")} />
            <label className="check">
              <input type="checkbox" checked={indicative} onChange={(e) => setIndicative(e.target.checked)} />
              Prisen er veiledende, lokalene kan foreslå en annen
            </label>
          </div>

          <div className="question">
            <span className="label" id={`${id}-fac`}>
              Hva må eller bør lokalet ha?
            </span>
            <p className="hint">Trykk på det som er viktig. Resten lar du stå.</p>
            <div className="chips" role="group" aria-labelledby={`${id}-fac`}>
              {FIXED_CRITERIA.map((c) => (
                <label key={c.key} className={facilities.includes(c.key) ? "chip selected" : "chip"}>
                  <input type="checkbox" checked={facilities.includes(c.key)} onChange={() => toggleFacility(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>

            <label className="label spaced" htmlFor={`${id}-custom`}>
              Noe annet?
            </label>
            <div className="custom-row">
              <input
                id={`${id}-custom`}
                placeholder="For eksempel: plass til liveband"
                maxLength={200}
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
              />
              <button
                type="button"
                className="button"
                onClick={addCustom}
                disabled={customDraft.trim().length < 3 || custom.length >= MAX_CUSTOM_CRITERIA}
              >
                Legg til
              </button>
            </div>
            {custom.length > 0 && (
              <div className="chips">
                {custom.map((c, i) => (
                  <span key={c.key} className="chip selected">
                    {c.text}
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Fjern ${c.text}`}
                      onClick={() => setCustom((rows) => rows.filter((r) => r.key !== c.key))}
                    >
                      ×
                    </button>
                    {err(`customCriteria.${i}.text`) && (
                      <span className="visually-hidden">{err(`customCriteria.${i}.text`)}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
            <FieldError message={err("customCriteria")} />
          </div>

          {selectedLabels.length > 0 && (
            <div className="question">
              <span className="label">Hva av dette er et må?</span>
              <p className="hint">
                Resten regnes som ønsker. Lokalet kan avvike fra et ønske hvis det forklarer hvorfor.
              </p>
              <ul className="switch-list">
                {selectedLabels.map((s) => (
                  <li key={s.id}>
                    <label className="switch-row">
                      <span>{s.label}</span>
                      <input type="checkbox" checked={s.must} onChange={s.toggle} />
                      <span className="switch" aria-hidden="true" />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="question">
            <label className="label" htmlFor={`${id}-desc`}>
              Noe mer lokalene bør vite?
            </label>
            <textarea
              id={`${id}-desc`}
              rows={3}
              maxLength={1000}
              placeholder="For eksempel: 50-årsdag med middag og dans"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={Boolean(err("description"))}
            />
            <FieldError message={err("description")} />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="wizard-section review" aria-labelledby={`${id}-s3`}>
          <h2 id={`${id}-s3`}>Ser dette riktig ut?</h2>
          <p className="hint">Forespørselen vises for lokalene med en gang du publiserer. Navnet ditt vises ikke.</p>
          <div className="review-group">
            <div className="review-head">
              <h3>Arrangementet</h3>
              <button type="button" className="link-button" onClick={() => goTo(1)}>
                Endre
              </button>
            </div>
            <dl className="facts">
              <div>
                <dt>Type</dt>
                <dd>{EVENT_TYPES.find((t) => t.id === eventType)?.label}</dd>
              </div>
              <div>
                <dt>Gjester</dt>
                <dd>{guestCount}</dd>
              </div>
              <div>
                <dt>Hvor</dt>
                <dd>
                  {allAreas ? "Hele Oslo" : areas.map((a) => OSLO_AREAS.find((o) => o.id === a)?.name).join(", ")}
                </dd>
              </div>
              <div>
                <dt>Når</dt>
                <dd>
                  {dateMode === "exact" ? fmtDate(date) : `Mellom ${fmtDate(date)} og ${fmtDate(dateTo)}`}
                  {urgent && ", haster"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="review-group">
            <div className="review-head">
              <h3>Behovene</h3>
              <button type="button" className="link-button" onClick={() => goTo(2)}>
                Endre
              </button>
            </div>
            <dl className="facts">
              <div>
                <dt>Makspris</dt>
                <dd>
                  {Number.isFinite(toInt(budget)) ? formatNok(toInt(budget)) : ""}
                  {indicative && " (veiledende)"}
                </dd>
              </div>
            </dl>
            {selectedLabels.length > 0 ? (
              <ul className="tags">
                {selectedLabels.map((s) => (
                  <li key={s.id} className={s.must ? "tag must" : "tag"}>
                    {s.must ? `Må: ${s.label}` : s.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Ingen spesielle krav.</p>
            )}
            {description.trim() && <p className="description">{description}</p>}
          </div>
        </section>
      )}

      <div className="wizard-nav">
        {step > 1 ? (
          <button type="button" className="link-button" onClick={() => goTo((step - 1) as Step)}>
            Tilbake
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button type="button" className="button button-party" onClick={next}>
            Neste
          </button>
        ) : (
          <button type="button" className="button button-party" onClick={publish} disabled={pending}>
            {pending ? "Publiserer …" : "Publiser forespørselen"}
          </button>
        )}
      </div>
    </div>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}
