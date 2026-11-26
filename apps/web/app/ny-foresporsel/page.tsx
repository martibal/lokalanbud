import type { Metadata } from "next";
import { todayInOslo } from "@lokalbud/core";
import { RequestForm } from "./RequestForm";

export const metadata: Metadata = { title: "Legg inn behovet ditt" };

export default function NewRequestPage() {
  return (
    <>
      <h1>Hva trenger festen?</h1>
      <p className="lead">
        Det tar under to minutter. Lokalene ser aldri navnet eller nummeret ditt før du selv
        svarer på et tilbud.
      </p>
      <RequestForm today={todayInOslo()} />
    </>
  );
}
