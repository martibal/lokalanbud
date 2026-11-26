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
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { sendGuestCode } from "@/lib/demo/actions";
import { toFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { publishWithCode, submitRequest } from "./actions";

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

export function RequestForm({ today, loggedIn }: { today: string; loggedIn: boolean }) {
  const formId = useId();
  const router = useRouter();
  const [areas, setAreas] = useState<AreaId[]>([]);
  const [guestCount, setGuestCount] = useState("");
  const [eventType, setEventType] = useState("");
  const [budget, setBudget] = useState("");
  const [indicative, setIndicative] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>("exact");
  const [date, setDate] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [fixed, setFixed] = useState<Partial<Record<FixedCriterionKey, Importance>>>({});
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [description, setDescription] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  // Steg 2: bekreft mobilnummer
  const [step, setStep] = useState<"form" | "verify">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string>();
  const [demoCode, setDemoCode] = useState<string>();
  const [code, setCode] = useState("");

  const allAreasSelected = areas.length === OSLO_AREAS.length;

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

  // Etter første forsøk valideres skjemaet fortløpende, slik at en feilmelding
  // forsvinner så snart feltet er rettet.
  const input = buildInput();
  const inputKey = JSON.stringify(input);
  const localErrors = useMemo(() => {
    if (!attempted) return {};
    const check = requestInputSchema(today).safeParse(JSON.parse(inputKey));
    return check.success ? {} : toFieldErrors(check.error.issues);
  }, [attempted, today, inputKey]);
  const errors: FieldErrors = { ...serverErrors, ...localErrors };

  function focusFirstError() {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setServerErrors({});
    // Rask sjekk i nettleseren. Serveren sjekker alt på nytt.
    if (!requestInputSchema(today).safeParse(input).success) {
      focusFirstError();
      return;
    }
    startTransition(async () => {
      const response = await submitRequest(input);
      if (response.ok === true) router.push(`/mine/${response.requestId}?ny=1`);
      else if (response.ok === "needs_verification") {
        setStep("verify");
        window.scrollTo({ top: 0 });
      } else {
        setServerErrors(response.errors);
        focusFirstError();
      }
    });
  }

  function onSendCode(event: React.FormEvent) {
    event.preventDefault();
    setServerErrors({});
    if (name.trim().length < 2) return setServerErrors({ name: "Oppgi navnet ditt" });
    startTransition(async () => {
      const result = await sendGuestCode(phone, false);
      if (!result.ok) return setServerErrors({ phone: result.error });
      setCodeSentTo(result.phone);
      setDemoCode(result.demoCode);
    });
  }

  function onPublish(event: React.FormEvent) {
    event.preventDefault();
    setServerErrors({});
    startTransition(async () => {
      const result = await publishWithCode(input, { name, phone: codeSentTo ?? phone, code });
      if (result.ok === true) router.push(`/mine/${result.requestId}?ny=1`);
      else if (result.ok === false) {
        setServerErrors(result.errors);
        if (!("code" in result.errors) && !("name" in result.errors) && !("phone" in result.errors)) setStep("form");
      }
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
  const fieldId = (n: string) => `${formId}-${n}`;

  if (step === "verify") {
    return (
      <div className="request-form">
        <div className="card">
          <h2>Bekreft mobilnummeret ditt</h2>
          <p className="muted">
            Lokalene ser verken navnet eller nummeret ditt før du selv aksepterer et tilbud. Vi
            bruker nummeret til å varsle deg når det kommer tilbud.
          </p>
          {!codeSentTo ? (
            <form onSubmit={onSendCode} noValidate>
              <label htmlFor={fieldId("name")}>Navn</label>
              <input
                id={fieldId("name")}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(err("name"))}
              />
              <FieldError message={err("name")} />
              <label htmlFor={fieldId("phone")}>Mobilnummer</label>
              <input
                id={fieldId("phone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="912 34 567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(err("phone"))}
              />
              <FieldError message={err("phone")} />
              <button className="button button-primary spaced" disabled={pending}>
                {pending ? "Sender …" : "Send kode på SMS"}
              </button>
            </form>
          ) : (
            <form onSubmit={onPublish} noValidate>
              <p>Vi har sendt en kode til {codeSentTo}.</p>
              {demoCode && (
                <p className="notice">
                  Demo: ingen SMS sendes. Koden er <strong>{demoCode}</strong>.
                </p>
              )}
              <label htmlFor={fieldId("code")}>Kode</label>
              <input
                id={fieldId("code")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={Boolean(err("code"))}
              />
              <FieldError message={err("code")} />
              <button className="button button-primary spaced" disabled={pending}>
                {pending ? "Publiserer …" : "Bekreft og publiser"}
              </button>
              <button type="button" className="link-button" onClick={() => setCodeSentTo(undefined)}>
                Endre nummer
              </button>
            </form>
          )}
        </div>
        <button type="button" className="link-button" onClick={() => setStep("form")}>
          Tilbake til skjemaet
        </button>
      </div>
    );
  }

  return (
    <form className="request-form" onSubmit={onSubmit} noValidate>
      {err("_form") && <p className="form-error">{err("_form")}</p>}

      <fieldset>
        <legend>Hvor i Oslo?</legend>
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
        <legend>Arrangement</legend>
        <div className="row">
          <div>
            <label htmlFor={fieldId("guestCount")}>Antall gjester</label>
            <input
              id={fieldId("guestCount")}
              inputMode="numeric"
              autoComplete="off"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              aria-invalid={Boolean(err("guestCount"))}
            />
            <FieldError message={err("guestCount")} />
          </div>
          <div>
            <label htmlFor={fieldId("eventType")}>Type</label>
            <select
              id={fieldId("eventType")}
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              aria-invalid={Boolean(err("eventType"))}
            >
              <option value="">Velg …</option>
              {EVENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <FieldError message={err("eventType")} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Makspris</legend>
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
          Prisen er veiledende, lokalene kan foreslå en annen
        </label>
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
        <legend>Fasiliteter og krav</legend>
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
        {pending ? "Sender …" : loggedIn ? "Publiser" : "Fortsett"}
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
