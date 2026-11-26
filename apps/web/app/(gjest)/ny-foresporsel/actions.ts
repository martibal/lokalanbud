"use server";

import { requestInputSchema, todayInOslo } from "@lokalbud/core";
import { revalidatePath } from "next/cache";
import { currentUser, setSessionUser } from "@/lib/demo/session";
import { createAnonymousGuest, createRequest } from "@/lib/demo/store";
import { toFieldErrors, type FieldErrors } from "@/lib/form-errors";

export type SubmitResult = { ok: true; requestId: string } | { ok: false; errors: FieldErrors };

/**
 * Tar imot en ny forespørsel og publiserer den med en gang. All validering
 * gjøres på nytt her, uansett hva nettleseren har sjekket. Ukjente felt avvises.
 *
 * I demoen kreves ingen bekreftelse av mobilnummer. En ny gjest får en
 * anonym demobruker som huskes i nettleseren.
 */
export async function submitRequest(input: unknown): Promise<SubmitResult> {
  const parsed = requestInputSchema(todayInOslo()).safeParse(input);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error.issues) };

  let user = await currentUser();
  if (user?.kind !== "guest") {
    user = createAnonymousGuest();
    await setSessionUser(user.id);
  }

  const stored = createRequest(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, requestId: stored.id };
}
