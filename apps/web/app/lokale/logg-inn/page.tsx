import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/demo/session";

export const metadata: Metadata = { title: "Logg inn for lokaler" };

export default async function VenueLoginPage() {
  const user = await currentUser();
  if (user?.kind === "venue") redirect("/lokale");

  return (
    <>
      <h1>Logg inn for lokaler</h1>
      <p className="lead">
        Hver ansatt har sin egen innlogging. Du ser forespørslene som passer lokalet deres, og kan sende tilbud med en
        gang.
      </p>
      <div className="card login-card">
        <Link href="/lokale/logg-inn/bankid" className="button button-primary bankid">
          Logg inn med BankID
        </Link>
        <p className="muted small">
          Vi bruker BankID for å vite at det er deg, og at du har rett til å representere lokalet.
        </p>
      </div>
      <div className="card">
        <h2>Nytt på Lokalbud?</h2>
        <p>
          Registrer lokalet med organisasjonsnummer og BankID. Det er gratis, og de tre første tilbudene som gjestene
          åpner, koster ingenting.
        </p>
        <p className="muted small">Registrering er ikke med i demoen ennå.</p>
      </div>
    </>
  );
}
