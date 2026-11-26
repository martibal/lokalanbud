"use client";

import { useState, useTransition } from "react";
import { acceptOfferAction } from "@/lib/demo/actions";

/**
 * Godta et tilbud. Gjesten bekrefter at bestillingen er bindende. Da deles
 * kontaktinformasjonen med lokalet, og begge parter får en kopi.
 */
export function AcceptOffer({
  offerId,
  venueName,
  priceText,
  contact,
}: {
  offerId: string;
  venueName: string;
  priceText: string;
  contact: { name: string; phone: string; email: string };
}) {
  const [open, setOpen] = useState(false);
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
      const result = await acceptOfferAction({ offerId, binding });
      if (result?.errors) setErrors(result.errors);
    });
  }

  return (
    <form className="accept-panel" onSubmit={submit} noValidate>
      <h3>Godta tilbudet</h3>
      <p className="hint">
        {venueName} får kontaktinformasjonen din, og dere får begge en kopi av bestillingen på e-post.
      </p>
      <dl className="facts">
        <div>
          <dt>Navn</dt>
          <dd>{contact.name}</dd>
        </div>
        <div>
          <dt>Mobil</dt>
          <dd>{contact.phone}</dd>
        </div>
        <div>
          <dt>E-post</dt>
          <dd>{contact.email}</dd>
        </div>
      </dl>
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
