/** Forespørsler med dato innen så mange dager merkes automatisk som hastesaker. */
export const AUTO_URGENT_WITHIN_DAYS = 14;

/** Datoer på formen ÅÅÅÅ-MM-DD, tolket som kalenderdager uten klokkeslett. */
function dayNumber(isoDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new RangeError(`Ugyldig dato: ${isoDate}`);
  }
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new RangeError(`Ugyldig dato: ${isoDate}`);
  return Math.round(ms / 86_400_000);
}

export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return dayNumber(toIsoDate) - dayNumber(fromIsoDate);
}

/**
 * En forespørsel haster hvis gjesten selv har merket den, eller hvis den
 * tidligste aktuelle datoen er innen 14 dager.
 */
export function isUrgent(params: {
  earliestDate: string;
  today: string;
  markedUrgentByGuest: boolean;
}): boolean {
  if (params.markedUrgentByGuest) return true;
  const days = daysBetween(params.today, params.earliestDate);
  return days >= 0 && days <= AUTO_URGENT_WITHIN_DAYS;
}

/** Dagens dato i Oslo på formen ÅÅÅÅ-MM-DD, uavhengig av serverens tidssone. */
export function todayInOslo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}
