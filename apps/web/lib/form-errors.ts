import type { z } from "zod";

export type FieldErrors = Record<string, string>;

/**
 * Gjør valideringsfeil om til én melding per felt, med feltets sti som nøkkel
 * (for eksempel "budget.amountNok" eller "customCriteria.0.text").
 * Den første feilen per felt vinner.
 */
export function toFieldErrors(issues: readonly z.core.$ZodIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
