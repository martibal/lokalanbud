import type { Metadata } from "next";
import { todayInOslo } from "@lokalbud/core";
import Link from "next/link";
import { currentUser } from "@/lib/demo/session";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = { title: "Legg inn behovet ditt" };

export default async function NewRequestPage() {
  const user = await currentUser();
  return (
    <>
      {user?.kind !== "guest" && (
        <p className="notice">
          Du er ikke logget inn som gjest. <Link href="/demo">Velg en gjest</Link> først.
        </p>
      )}
      <h1>Hva trenger festen?</h1>
      <p className="lead">
        Det tar under to minutter. Lokalene ser aldri navnet eller nummeret ditt før du selv
        svarer på et tilbud.
      </p>
      <RequestForm today={todayInOslo()} />
    </>
  );
}
