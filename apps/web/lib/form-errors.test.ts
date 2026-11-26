import { requestInputSchema } from "@lokalbud/core";
import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./form-errors";

describe("toFieldErrors", () => {
  it("gir én norsk melding per felt", () => {
    const result = requestInputSchema("2026-12-01").safeParse({
      eventType: "",
      date: { mode: "exact", date: "2027-01-10" },
      guestCount: Number.NaN,
      areas: [],
      budget: { amountNok: 500, indicative: false },
      fixedCriteria: {},
      customCriteria: [],
      markedUrgent: false,
    });
    expect(result.success).toBe(false);
    const errors = toFieldErrors(result.error!.issues);
    expect(errors.eventType).toBe("Velg type arrangement");
    expect(errors.areas).toBe("Velg minst ett område");
    expect(errors["budget.amountNok"]).toBe("Budsjettet må være minst 1 000 kr");
    expect(errors.guestCount).toBeDefined();
  });
});
