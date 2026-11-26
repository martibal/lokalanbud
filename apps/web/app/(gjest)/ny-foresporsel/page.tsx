import { todayInOslo } from "@lokalbud/core";
import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/demo/session";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = { title: "Finn lokale" };

export default async function NewRequestPage() {
  const user = await currentUser();
  return (
    <>
      <h1>Finn lokale til festen</h1>
      <p className="lead">
        Tre korte steg. Lokalene som passer, sender deg tilbud, og ingen ser navnet ditt før du selv aksepterer et
        tilbud.
      </p>
      {user?.kind !== "guest" && (
        <p className="muted small">
          Har du allerede lagt inn et behov? <Link href="/logg-inn">Se forespørslene dine</Link>
        </p>
      )}
      <RequestForm today={todayInOslo()} />
    </>
  );
}
