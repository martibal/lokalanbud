import { todayInOslo } from "@lokalbud/core";
import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/demo/session";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = { title: "Finn lokale" };

export default async function NewRequestPage() {
  const user = await currentUser();
  const loggedIn = user?.kind === "guest";
  return (
    <>
      <h1>Hva trenger festen?</h1>
      <p className="lead">
        Det tar under to minutter. Lokalene som passer, sender deg tilbud, og de ser aldri navnet
        eller nummeret ditt før du selv aksepterer et tilbud.
      </p>
      {!loggedIn && (
        <p className="muted">
          Har du allerede en forespørsel? <Link href="/logg-inn">Se forespørslene dine</Link>
        </p>
      )}
      <RequestForm today={todayInOslo()} loggedIn={loggedIn} />
    </>
  );
}
