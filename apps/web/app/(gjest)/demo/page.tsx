import type { Metadata } from "next";
import { loginAs, resetDemo } from "@/lib/demo/actions";
import { currentUser } from "@/lib/demo/session";
import { getVenue, listUsers } from "@/lib/demo/store";

export const metadata: Metadata = { title: "Demoverktøy" };

const ROLE_LABELS = { owner: "eier", booking: "booking", staff: "ansatt", accounting: "regnskap" } as const;

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ nullstilt?: string }> }) {
  const params = await searchParams;
  const user = await currentUser();
  const users = listUsers();
  const guests = users.filter((u) => u.kind === "guest");
  const venueUsers = users.filter((u) => u.kind === "venue");

  return (
    <>
      <h1>Demoverktøy</h1>
      <p className="lead">
        Snarvei for å bytte rolle uten SMS-kode eller BankID, og for å nullstille dataene. Finnes bare i demoen. Åpne
        gjerne to nettleservinduer, ett privat, for å være gjest og lokale samtidig.
      </p>
      {params.nullstilt && <p className="notice">Demoen er nullstilt.</p>}

      <h2>Gjester</h2>
      <div className="role-grid">
        {guests.map((g) => (
          <form key={g.id} action={loginAs}>
            <input type="hidden" name="userId" value={g.id} />
            <button className={user?.id === g.id ? "role-card selected" : "role-card"}>
              <strong>{g.name}</strong>
              <span>Gjest</span>
            </button>
          </form>
        ))}
      </div>

      <h2>Lokaler</h2>
      <div className="role-grid">
        {venueUsers.map((u) => (
          <form key={u.id} action={loginAs}>
            <input type="hidden" name="userId" value={u.id} />
            <button className={user?.id === u.id ? "role-card selected" : "role-card"}>
              <strong>{getVenue(u.venueId)?.name}</strong>
              <span>
                {u.name.replace(/ \(.*\)$/, "")}, {ROLE_LABELS[u.role]}
              </span>
            </button>
          </form>
        ))}
      </div>

      <form action={resetDemo} className="reset">
        <button className="link-button">Nullstill demoen</button>
        <span className="muted"> Sletter alt du har lagt inn og starter med eksempeldataene.</span>
      </form>
    </>
  );
}
