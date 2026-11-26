"use client";

import { useState, useTransition } from "react";
import { guestLoginWithCode, sendGuestCode } from "@/lib/demo/actions";

export function GuestLogin() {
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [demoCode, setDemoCode] = useState<string>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function send(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await sendGuestCode(phone, true);
      if (!result.ok) return setError(result.error);
      setSentTo(result.phone);
      setDemoCode(result.demoCode);
    });
  }

  function verify(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await guestLoginWithCode(sentTo!, code);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="card request-form">
      {!sentTo ? (
        <form onSubmit={send} noValidate>
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
            {pending ? "Sender …" : "Send kode på SMS"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          <p>Vi har sendt en kode til {sentTo}.</p>
          {demoCode && (
            <p className="notice">
              Demo: ingen SMS sendes. Koden er <strong>{demoCode}</strong>.
            </p>
          )}
          <label htmlFor="code">Kode</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={Boolean(error)}
          />
          {error && <p className="field-error">{error}</p>}
          <button className="button button-primary spaced" disabled={pending}>
            {pending ? "Logger inn …" : "Logg inn"}
          </button>
          <button type="button" className="link-button" onClick={() => setSentTo(undefined)}>
            Endre nummer
          </button>
        </form>
      )}
    </div>
  );
}
