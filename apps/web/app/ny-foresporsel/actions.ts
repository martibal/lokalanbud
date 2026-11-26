"use server";

import { isUrgent, requestInputSchema, todayInOslo, type RequestInput } from "@lokalbud/core";
import { currentUser } from "@/lib/demo/session";
import { createRequest } from "@/lib/demo/store";
import { toFieldErrors, type FieldErrors } from "@/lib/form-errors";

export type SubmitResult =
  | {
      ok: true;
      requestId: string;
      urgent: boolean;
      summary: { guestCount: number; areaCount: number; criteriaCount: number };
    }
  | { ok: false; errors: FieldErrors };

/**
 * Tar imot en ny forespørsel. All validering gjøres på nytt her, uansett hva
 * nettleseren har sjekket. Ukjente felt avvises.
 *
 * I demoversjonen lagres forespørselen i minnet. Lagring i databasen og
 * bekreftelse av mobilnummer kobles på senere.
 */
export async function submitRequest(input: unknown): Promise<SubmitResult> {
  const user = await currentUser();
  if (!user || user.kind !== "guest") {
    return { ok: false, errors: { _form: "Velg en gjest under «Velg rolle» før du sender." } };
  }
  const today = todayInOslo();
  const parsed = requestInputSchema(today).safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: toFieldErrors(parsed.error.issues) };
  }
  const request: RequestInput = parsed.data;
  const earliestDate = request.date.mode === "exact" ? request.date.date : request.date.from;

  const stored = createRequest(user.id, request);

  return {
    ok: true,
    requestId: stored.id,
    urgent: isUrgent({ earliestDate, today, markedUrgentByGuest: request.markedUrgent }),
    summary: {
      guestCount: request.guestCount,
      areaCount: request.areas.length,
      criteriaCount: Object.keys(request.fixedCriteria).length + request.customCriteria.length,
    },
  };
}
