import type { Metadata } from "next";
import Link from "next/link";
import { bankIdLogin } from "@/lib/demo/actions";
import { getVenue, listUsers } from "@/lib/demo/store";

export const metadata: Metadata = { title: "BankID (simulert)" };

const ROLE_LABELS = { owner: "eier", booking: "booking", staff: "ansatt", accounting: "regnskap" } as const;

/**
 * Simulert BankID for demoen. I den ekte løsningen sendes brukeren til
 * BankID-leverandøren og kommer tilbake med en bekreftet identitet.
 */
export default function SimulatedBankIdPage() {
  const venueUsers = listUsers().filter((u) => u.kind === "venue");
  return (
    <>
      <p className="breadcrumb">
        <Link href="/lokale/logg-inn">Tilbake</Link>
      </p>
      <h1>BankID</h1>
      <p className="notice">Simulert innlogging for demoen. Velg hvem du vil logge inn som.</p>
      <div className="role-grid">
        {venueUsers.map((u) => (
          <form key={u.id} action={bankIdLogin}>
            <input type="hidden" name="userId" value={u.id} />
            <button className="role-card">
              <strong>{u.name.replace(/ \(.*\)$/, "")}</strong>
              <span>
                {getVenue(u.venueId)?.name}, {ROLE_LABELS[u.role]}
              </span>
            </button>
          </form>
        ))}
      </div>
    </>
  );
}
