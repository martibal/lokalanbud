import type { Metadata } from "next";
import Link from "next/link";
import { loginAs } from "@/lib/demo/actions";
import { currentUser } from "@/lib/demo/session";
import { listUsers } from "@/lib/demo/store";

export const metadata: Metadata = { title: "Se forespørslene dine" };

/** I demoen velger du en demogjest. Innlogging for gjester kommer når løsningen kobles til en database. */
export default async function GuestLoginPage() {
  const user = await currentUser();
  const guests = listUsers().filter((u) => u.kind === "guest");
  return (
    <>
      <h1>Se forespørslene dine</h1>
      <p className="lead">Velg en demogjest for å se forespørslene og tilbudene til gjesten.</p>
      <div className="role-grid">
        {guests.map((g) => (
          <form key={g.id} action={loginAs}>
            <input type="hidden" name="userId" value={g.id} />
            <button className={user?.id === g.id ? "role-card selected" : "role-card"}>
              <strong>{g.name}</strong>
              <span>Demogjest</span>
            </button>
          </form>
        ))}
      </div>
      <p>
        <Link href="/ny-foresporsel">Legg inn et nytt behov i stedet</Link>
      </p>
    </>
  );
}
