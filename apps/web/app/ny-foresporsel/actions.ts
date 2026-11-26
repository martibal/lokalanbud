"use server";

import { norwegianMobile, requestInputSchema, todayInOslo } from "@lokalbud/core";
import { revalidatePath } from "next/cache";
import { currentUser, setSessionUser } from "@/lib/demo/session";
import { DemoRuleError, createRequest, findOrCreateGuest, verifyPhoneCode } from "@/lib/demo/store";
import { toFieldErrors, type FieldErrors } from "@/lib/form-errors";

export type SubmitResult =
  | { ok: true; requestId: string }
  /** Skjemaet er gyldig, men gjesten må bekrefte mobilnummeret før publisering. */
  | { ok: "needs_verification" }
  | { ok: false; errors: FieldErrors };

function validate(input: unknown) {
  return requestInputSchema(todayInOslo()).safeParse(input);
}

/**
 * Tar imot en ny forespørsel. All validering gjøres på nytt her, uansett hva
 * nettleseren har sjekket. Ukjente felt avvises. En gjest som allerede er
 * innlogget, publiserer med en gang. Andre må bekrefte mobilnummeret først.
 */
export async function submitRequest(input: unknown): Promise<SubmitResult> {
  const parsed = validate(input);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error.issues) };

  const user = await currentUser();
  if (user?.kind !== "guest") return { ok: "needs_verification" };

  const stored = createRequest(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, requestId: stored.id };
}

/** Publiserer etter at gjesten har oppgitt navn, nummer og engangskode. */
export async function publishWithCode(
  input: unknown,
  contact: { name: string; phone: string; code: string },
): Promise<SubmitResult> {
  const parsed = validate(input);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error.issues) };

  const name = String(contact?.name ?? "").trim();
  if (name.length < 2 || name.length > 80) return { ok: false, errors: { name: "Oppgi navnet ditt" } };
  const phone = norwegianMobile.safeParse(String(contact?.phone ?? ""));
  if (!phone.success) return { ok: false, errors: { phone: "Oppgi et norsk mobilnummer med 8 siffer" } };

  try {
    verifyPhoneCode(phone.data, String(contact?.code ?? ""));
  } catch (error) {
    if (error instanceof DemoRuleError) return { ok: false, errors: { code: error.message } };
    throw error;
  }

  const guest = findOrCreateGuest(name, phone.data);
  await setSessionUser(guest.id);
  const stored = createRequest(guest.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, requestId: stored.id };
}
