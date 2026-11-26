"use client";

import { useState, useTransition } from "react";
import { guestLoginByPhone } from "@/lib/demo/actions";

/** I demoen holder mobilnummeret. I den ekte løsningen kommer en engangskode på SMS. */
export function GuestLogin() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await guestLoginByPhone(phone);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form className="card request-form" onSubmit={submit} noValidate>
      <label htmlFor="phone">Mobilnummer</label>
      <input
        id="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="912 34 567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error && <p className="field-error">{error}</p>}
      <button className="button button-primary spaced" disabled={pending}>
        {pending ? "Logger inn …" : "Se forespørslene"}
      </button>
    </form>
  );
}
