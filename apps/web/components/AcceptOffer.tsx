"use client";

import { useState, useTransition } from "react";
import { acceptOfferAction } from "@/lib/demo/actions";

/**
 * Godta et tilbud. Gjesten oppgir kontaktinformasjon og bekrefter at
 * bestillingen er bindende. Da sendes en kopi til begge parter.
 */
export function AcceptOffer({
  offerId,
  venueName,
  priceText,
  defaults,
}: {
  offerId: string;
  venueName: string;
  priceText: string;
  defaults: { name: string; phone: string; email: string };
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaults.name.startsWith("Demogjest") ? "" : defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [email, setEmail] = useState(defaults.email);
  const [binding, setBinding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="button button-party button-block accept-open" onClick={() => setOpen(true)}>
        Godta tilbudet fra {venueName}
      </button>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await acceptOfferAction({ offerId, name, phone, email, binding });
      if (result?.errors) setErrors(result.errors);
    });
  }

  return (
    <form className="accept-panel request-form" onSubmit={submit} noValidate>
      <h3>Godta tilbudet</h3>
      <p className="hint">
        {venueName} får navnet og kontaktinformasjonen din, og dere får begge en kopi av bestillingen på e-post.
      </p>
      <div className="row">
        <div className="field">
          <label htmlFor={`n-${offerId}`}>Navn</label>
          <input
            id={`n-${offerId}`}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div className="field">
          <label htmlFor={`p-${offerId}`}>Mobil</label>
          <input
            id={`p-${offerId}`}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(errors.phone)}
          />
          {errors.phone && <p className="field-error">{errors.phone}</p>}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`e-${offerId}`}>E-post</label>
        <input
          id={`e-${offerId}`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && <p className="field-error">{errors.email}</p>}
      </div>
      <label className="check binding">
        <input
          type="checkbox"
          checked={binding}
          onChange={(e) => setBinding(e.target.checked)}
          aria-invalid={Boolean(errors.binding)}
        />
        <span>
          Jeg bestiller {venueName} for {priceText}. Bestillingen er bindende etter avbestillingsvilkårene i tilbudet.
        </span>
      </label>
      {errors.binding && <p className="field-error">{errors.binding}</p>}
      {errors._form && <p className="form-error">{errors._form}</p>}
      <div className="actions-row">
        <button className="button button-party" disabled={pending}>
          {pending ? "Bestiller …" : "Godta og bestill"}
        </button>
        <button type="button" className="link-button" onClick={() => setOpen(false)}>
          Avbryt
        </button>
      </div>
    </form>
  );
}
