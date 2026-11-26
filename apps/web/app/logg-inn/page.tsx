import type { Metadata } from "next";
import Link from "next/link";
import { GuestLogin } from "./GuestLogin";

export const metadata: Metadata = { title: "Se forespørslene dine" };

export default function GuestLoginPage() {
  return (
    <>
      <h1>Se forespørslene dine</h1>
      <p className="lead">Oppgi mobilnummeret ditt. I demoen trengs ingen SMS-kode.</p>
      <GuestLogin />
      <p className="muted small">
        Demo: Kari har nummer 912 34 567, Ola 412 34 567 og Ingrid 900 00 001.
      </p>
      <p>
        <Link href="/ny-foresporsel">Legg inn et nytt behov i stedet</Link>
      </p>
    </>
  );
}
