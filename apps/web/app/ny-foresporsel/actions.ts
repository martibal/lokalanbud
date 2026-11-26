"use server";

import { isUrgent, requestInputSchema, todayInOslo, type RequestInput } from "@lokalbud/core";
import { toFieldErrors, type FieldErrors } from "@/lib/form-errors";

export type SubmitResult =
  | { ok: true; urgent: boolean; summary: { guestCount: number; areaCount: number; criteriaCount: number } }
  | { ok: false; errors: FieldErrors };

/**
 * Tar imot en ny forespørsel. All validering gjøres på nytt her, uansett hva
 * nettleseren har sjekket. Ukjente felt avvises.
 *
 * Lagring i databasen og bekreftelse av mobilnummer kobles på i neste steg.
 */
export async function submitRequest(input: unknown): Promise<SubmitResult> {
  const today = todayInOslo();
  const parsed = requestInputSchema(today).safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: toFieldErrors(parsed.error.issues) };
  }
  const request: RequestInput = parsed.data;
  const earliestDate = request.date.mode === "exact" ? request.date.date : request.date.from;

  return {
    ok: true,
    urgent: isUrgent({ earliestDate, today, markedUrgentByGuest: request.markedUrgent }),
    summary: {
      guestCount: request.guestCount,
      areaCount: request.areas.length,
      criteriaCount: Object.keys(request.fixedCriteria).length + request.customCriteria.length,
    },
  };
}
