"use client";

import {
  EVENT_TYPES,
  FIXED_CRITERIA,
  MAX_CUSTOM_CRITERIA,
  OSLO_AREAS,
  requestInputSchema,
  type AreaId,
  type FixedCriterionKey,
  type Importance,
} from "@lokalbud/core";
import { useId, useMemo, useState, useTransition } from "react";
import { toFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { submitRequest, type SubmitResult } from "./actions";

type DateMode = "exact" | "flexible";
type CustomRow = { key: number; text: string; importance: Importance };

const IMPORTANCE_OPTIONS: { value: Importance | "none"; label: string }[] = [
  { value: "none", label: "Uviktig" },
  { value: "wish", label: "Ønske" },
  { value: "must", label: "Må" },
];

/** Tall fra et tekstfelt. Tomt eller ugyldig blir NaN, som skjemaet avviser med en tydelig melding. */
function toInt(value: string): number {
  const cleaned = value.replace(/[\s.]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}

export function RequestForm({ today }: { today: string }) {
  const formId = useId();
  const [eventType, setEventType] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("exact");
  const [date, setDate] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [areas, setAreas] = useState<AreaId[]>([]);
  const [budget, setBudget] = useState("");
  const [indicative, setIndicative] = useState(false);
  const [fixed, setFixed] = useState<Partial<Record<FixedCriterionKey, Importance>>>({});
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [urgent, setUrgent] = useState(false);
  const [description, setDescription] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, startTransition] = useTransition();

  const allAreasSelected = areas.length === OSLO_AREAS.length;

  // Etter første forsøk valideres skjemaet fortløpende, slik at en feilmelding
  // forsvinner så snart feltet er rettet.
  const input = buildInput();
  const localErrors = useMemo(() => {
    if (!attempted) return {};
    const check = requestInputSchema(today).safeParse(input);
    return check.success ? {} : toFieldErrors(check.error.issues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempted, today, JSON.stringify(input)]);
  const errors: FieldErrors = { ...serverErrors, ...localErrors };

  function buildInput() {
    return {
      eventType,
      date:
        dateMode === "exact"
          ? { mode: "exact" as const, date }
          : { mode: "flexible" as const, from: date, to: dateTo },
      guestCount: toInt(guestCount),
      areas,
      budget: { amountNok: toInt(budget), indicative },
      fixedCriteria: fixed,
      customCriteria: custom.map(({ text, importance }) => ({ text, importance })),
      markedUrgent: urgent,
      ...(description.trim() ? { description } : {}),
    };
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setServerErrors({});
    // Rask sjekk i nettleseren. Serveren sjekker alt på nytt.
    const local = requestInputSchema(today).safeParse(input);
    if (!local.success) {
      setResult(null);
      focusFirstError();
      return;
    }
    startTransition(async () => {
      const response = await submitRequest(input);
      if (!response.ok) {
        setServerErrors(response.errors);
        focusFirstError();
      }
      setResult(response);
    });
  }

  function focusFirstError() {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    });
  }

  function toggleArea(id: AreaId) {
    setAreas((current) => (current.includes(id) ? current.filter((a) => a !== id) : [...current, id]));
  }

  function setFixedImportance(key: FixedCriterionKey, value: Importance | "none") {
    setFixed((current) => {
      const next = { ...current };
      if (value === "none") delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function addCustom() {
    if (custom.length >= MAX_CUSTOM_CRITERIA) return;
    setCustom((rows) => [...rows, { key: nextKey, text: "", importance: "wish" }]);
    setNextKey((k) => k + 1);
  }

  const err = (path: string) => errors[path];
  const fieldId = (name: string) => `${formId}-${name}`;

  if (result?.ok) {
    return (
      <div className="card success" role="status">
        <h2>Forespørselen er klar</h2>
        <p>
          {result.summary.guestCount} gjester, {result.summary.areaCount}{" "}
          {result.summary.areaCount === 1 ? "område" : "områder"} og {result.summary.criteriaCount}{" "}
          {result.summary.criteriaCount === 1 ? "krav" : "krav"}.
          {result.urgent && " Den er merket som hastesak og varsles først."}
        </p>
        <p>Neste steg er å bekrefte mobilnummeret ditt med en engangskode.</p>
      </div>
    );
  }

  return (
    <form className="request-form" onSubmit={onSubmit} noValidate>
      {err("_form") && <p className="form-error">{err("_form")}</p>}

      <fieldset>
        <legend>Arrangement</legend>
        <label htmlFor={fieldId("eventType")}>Type arrangement</label>
        <select
          id={fieldId("eventType")}
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          aria-invalid={Boolean(err("eventType"))}
          aria-describedby={err("eventType") ? fieldId("eventType-error") : undefined}
        >
          <option value="">Velg …</option>
          {EVENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <FieldError id={fieldId("eventType-error")} message={err("eventType")} />

        <label htmlFor={fieldId("guestCount")}>Antall gjester</label>
        <input
          id={fieldId("guestCount")}
          inputMode="numeric"
          autoComplete="off"
          value={guestCount}
          onChange={(e) => setGuestCount(e.target.value)}
          aria-invalid={Boolean(err("guestCount"))}
          aria-describedby={err("guestCount") ? fieldId("guestCount-error") : undefined}
        />
        <FieldError id={fieldId("guestCount-error")} message={err("guestCount")} />
      </fieldset>

      <fieldset>
        <legend>Dato</legend>
        <div className="segmented" role="radiogroup" aria-label="Datotype">
          {(["exact", "flexible"] as const).map((mode) => (
            <label key={mode} className={dateMode === mode ? "selected" : undefined}>
              <input
                type="radio"
                name={fieldId("dateMode")}
                value={mode}
                checked={dateMode === mode}
                onChange={() => setDateMode(mode)}
              />
              {mode === "exact" ? "Fast dato" : "Fleksibel periode"}
            </label>
          ))}
        </div>
        <div className="row">
          <div>
            <label htmlFor={fieldId("date")}>{dateMode === "exact" ? "Dato" : "Tidligst"}</label>
            <input
              id={fieldId("date")}
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={Boolean(err("date") || err("date.date") || err("date.from"))}
            />
          </div>
          {dateMode === "flexible" && (
            <div>
              <label htmlFor={fieldId("dateTo")}>Senest</label>
              <input
                id={fieldId("dateTo")}
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
      </fieldset>

      <fieldset>
        <legend>Område i Oslo</legend>
        <div className="area-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => setAreas(allAreasSelected ? [] : OSLO_AREAS.map((a) => a.id))}
          >
            {allAreasSelected ? "Fjern alle" : "Velg alle"}
          </button>
          <span className="muted">{areas.length} valgt</span>
        </div>
        <div className="chips" aria-invalid={Boolean(err("areas"))} tabIndex={err("areas") ? -1 : undefined}>
          {OSLO_AREAS.map((area) => (
            <label key={area.id} className={areas.includes(area.id) ? "chip selected" : "chip"}>
              <input type="checkbox" checked={areas.includes(area.id)} onChange={() => toggleArea(area.id)} />
              {area.name}
            </label>
          ))}
        </div>
        <FieldError message={err("areas")} />
      </fieldset>

      <fieldset>
        <legend>Budsjett</legend>
        <label htmlFor={fieldId("budget")}>Totalt for hele arrangementet, med leie, mat og drikke</label>
        <div className="suffix-input">
          <input
            id={fieldId("budget")}
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
          Budsjettet er veiledende, lokalene kan foreslå en annen pris
        </label>
      </fieldset>

      <fieldset>
        <legend>Hva er viktig?</legend>
        <p className="muted">Lokaler som ikke oppfyller et må-krav, kan ikke sende deg tilbud.</p>
        <ul className="criteria">
          {FIXED_CRITERIA.map((c) => {
            const current = fixed[c.key] ?? "none";
            return (
              <li key={c.key}>
                <span id={fieldId(`crit-${c.key}`)}>{c.label}</span>
                <div className="segmented small" role="radiogroup" aria-labelledby={fieldId(`crit-${c.key}`)}>
                  {IMPORTANCE_OPTIONS.map((o) => (
                    <label
                      key={o.value}
                      className={current === o.value ? (o.value === "none" ? "selected neutral" : "selected") : undefined}
                    >
                      <input
                        type="radio"
                        name={fieldId(`crit-${c.key}`)}
                        value={o.value}
                        checked={current === o.value}
                        onChange={() => setFixedImportance(c.key, o.value)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <h3>Egne krav</h3>
        {custom.map((row, index) => (
          <div key={row.key} className="custom-row">
            <input
              aria-label={`Eget krav ${index + 1}`}
              placeholder="For eksempel: plass til liveband"
              maxLength={200}
              value={row.text}
              onChange={(e) =>
                setCustom((rows) => rows.map((r) => (r.key === row.key ? { ...r, text: e.target.value } : r)))
              }
              aria-invalid={Boolean(err(`customCriteria.${index}.text`))}
            />
            <select
              aria-label={`Hvor viktig er krav ${index + 1}`}
              value={row.importance}
              onChange={(e) =>
                setCustom((rows) =>
                  rows.map((r) => (r.key === row.key ? { ...r, importance: e.target.value as Importance } : r)),
                )
              }
            >
              <option value="wish">Ønske</option>
              <option value="must">Må</option>
            </select>
            <button
              type="button"
              className="link-button"
              aria-label={`Fjern krav ${index + 1}`}
              onClick={() => setCustom((rows) => rows.filter((r) => r.key !== row.key))}
            >
              Fjern
            </button>
            <FieldError message={err(`customCriteria.${index}.text`)} />
          </div>
        ))}
        {custom.length < MAX_CUSTOM_CRITERIA && (
          <button type="button" className="button" onClick={addCustom}>
            Legg til eget krav
          </button>
        )}
        <FieldError message={err("customCriteria")} />
      </fieldset>

      <fieldset>
        <legend>Noe mer lokalene bør vite?</legend>
        <label htmlFor={fieldId("description")} className="visually-hidden">
          Beskrivelse
        </label>
        <textarea
          id={fieldId("description")}
          rows={4}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={Boolean(err("description"))}
        />
        <FieldError message={err("description")} />
      </fieldset>

      {attempted && Object.keys(errors).length > 0 && (
        <p className="form-error" role="alert">
          Noe mangler. Se feltene som er merket.
        </p>
      )}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? "Sender …" : "Fortsett"}
      </button>
    </form>
  );
}

function FieldError({ id, message }: { id?: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id}>
      {message}
    </p>
  );
}
