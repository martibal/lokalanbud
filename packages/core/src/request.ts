import { z } from "zod";
import { AREA_IDS } from "./areas.js";
import {
  CUSTOM_CRITERION_MAX_LENGTH,
  CUSTOM_CRITERION_MIN_LENGTH,
  FIXED_CRITERION_KEYS,
  MAX_CUSTOM_CRITERIA,
} from "./criteria.js";
import { daysBetween } from "./urgency.js";

export const EVENT_TYPES = [
  { id: "birthday", label: "Bursdag" },
  { id: "anniversary", label: "Jubileum" },
  { id: "wedding", label: "Bryllup" },
  { id: "confirmation", label: "Konfirmasjon" },
  { id: "company", label: "Firmafest" },
  { id: "christmas", label: "Julebord" },
  { id: "memorial", label: "Minnesamvær" },
  { id: "association", label: "Lag eller forening" },
  { id: "other", label: "Annet" },
] as const;

export type EventTypeId = (typeof EVENT_TYPES)[number]["id"];
const EVENT_TYPE_IDS = EVENT_TYPES.map((t) => t.id) as [EventTypeId, ...EventTypeId[]];

export const GUEST_COUNT_MIN = 5;
export const GUEST_COUNT_MAX = 1000;
export const BUDGET_MIN_NOK = 1_000;
export const BUDGET_MAX_NOK = 2_000_000;
export const FLEXIBLE_RANGE_MAX_DAYS = 60;
export const MAX_DAYS_AHEAD = 730;
export const DESCRIPTION_MAX_LENGTH = 1_000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato");
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ugyldig klokkeslett");
const importance = z.enum(["must", "wish"]);

/** Fjerner kontrolltegn og overflødige mellomrom fra fritekst. */
const cleanText = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().min(min).max(max));

/**
 * Skjemaet for en ny forespørsel. Det tar dagens dato som parameter, slik at
 * reglene for datoer kan testes uten klokke og håndheves likt på server og klient.
 */
export function requestInputSchema(today: string) {
  return z
    .object({
      eventType: z.enum(EVENT_TYPE_IDS),
      date: z.discriminatedUnion("mode", [
        z.object({ mode: z.literal("exact"), date: isoDate }),
        z.object({ mode: z.literal("flexible"), from: isoDate, to: isoDate }),
      ]),
      startTime: clockTime.optional(),
      endTime: clockTime.optional(),
      guestCount: z.number().int().min(GUEST_COUNT_MIN).max(GUEST_COUNT_MAX),
      areas: z
        .array(z.enum(AREA_IDS))
        .min(1, "Velg minst ett område")
        .refine((a) => new Set(a).size === a.length, "Samme område er valgt to ganger"),
      budget: z.object({
        amountNok: z.number().int().min(BUDGET_MIN_NOK).max(BUDGET_MAX_NOK),
        indicative: z.boolean(),
      }),
      fixedCriteria: z.partialRecord(z.enum(FIXED_CRITERION_KEYS), importance),
      customCriteria: z
        .array(
          z.object({
            text: cleanText(CUSTOM_CRITERION_MIN_LENGTH, CUSTOM_CRITERION_MAX_LENGTH),
            importance,
          }),
        )
        .max(MAX_CUSTOM_CRITERIA),
      markedUrgent: z.boolean(),
      description: cleanText(0, DESCRIPTION_MAX_LENGTH).optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      const first = value.date.mode === "exact" ? value.date.date : value.date.from;
      const last = value.date.mode === "exact" ? value.date.date : value.date.to;
      let ahead: number;
      let span: number;
      try {
        ahead = daysBetween(today, first);
        span = daysBetween(first, last);
      } catch {
        ctx.addIssue({ code: "custom", path: ["date"], message: "Ugyldig dato" });
        return;
      }
      if (ahead < 0) {
        ctx.addIssue({ code: "custom", path: ["date"], message: "Datoen har allerede vært" });
      }
      if (daysBetween(today, last) > MAX_DAYS_AHEAD) {
        ctx.addIssue({ code: "custom", path: ["date"], message: "Datoen er mer enn to år frem i tid" });
      }
      if (span < 0) {
        ctx.addIssue({ code: "custom", path: ["date"], message: "Sluttdatoen er før startdatoen" });
      }
      if (span > FLEXIBLE_RANGE_MAX_DAYS) {
        ctx.addIssue({
          code: "custom",
          path: ["date"],
          message: `Perioden kan være maks ${FLEXIBLE_RANGE_MAX_DAYS} dager`,
        });
      }
    });
}

export type RequestInput = z.infer<ReturnType<typeof requestInputSchema>>;

/** Norske mobilnumre, lagret på formen +47XXXXXXXX. */
export const norwegianMobile = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .transform((s) => (s.startsWith("0047") ? `+47${s.slice(4)}` : s))
  .transform((s) => (/^[49]\d{7}$/.test(s) ? `+47${s}` : s))
  .pipe(z.string().regex(/^\+47[49]\d{7}$/, "Oppgi et norsk mobilnummer"));
