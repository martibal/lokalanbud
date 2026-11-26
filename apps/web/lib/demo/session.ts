import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser, type DemoUser } from "./store";

export const DEMO_COOKIE = "lokalbud_demo_user";

export async function currentUser(): Promise<DemoUser | undefined> {
  const jar = await cookies();
  return getUser(jar.get(DEMO_COOKIE)?.value);
}

export async function requireGuest(): Promise<Extract<DemoUser, { kind: "guest" }>> {
  const user = await currentUser();
  if (!user || user.kind !== "guest") redirect("/demo");
  return user;
}

export async function requireVenueUser(): Promise<Extract<DemoUser, { kind: "venue" }>> {
  const user = await currentUser();
  if (!user || user.kind !== "venue") redirect("/demo");
  return user;
}
