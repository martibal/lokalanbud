import { EVENT_TYPES, FIXED_CRITERIA, areaName, formatNok, type AreaId, type Criterion } from "@lokalbud/core";

const dateFormat = new Intl.DateTimeFormat("nb-NO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormat = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", timeZone: "UTC" });

const dateTimeFormat = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatShortDate(isoDate: string): string {
  return shortDateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatDateRange(date: { mode: "exact"; date: string } | { mode: "flexible"; from: string; to: string }) {
  return date.mode === "exact"
    ? formatDate(date.date)
    : `Fleksibel: ${formatShortDate(date.from)} – ${formatShortDate(date.to)}`;
}

export function eventTypeLabel(id: string): string {
  return EVENT_TYPES.find((t) => t.id === id)?.label ?? id;
}

export function criterionLabel(c: Criterion): string {
  return c.kind === "fixed" ? (FIXED_CRITERIA.find((f) => f.key === c.key)?.label ?? c.key) : c.text;
}

export function areasLabel(areas: readonly AreaId[]): string {
  if (areas.length >= 16) return "Hele Oslo";
  return areas.map(areaName).join(", ");
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "nå nettopp";
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.round(hours / 24);
  return days === 1 ? "i går" : `${days} dager siden`;
}

export { formatNok };

export const ANSWER_LABELS = {
  meets: "Oppfylt",
  meets_with_reservation: "Med forbehold",
  does_not_meet: "Ikke oppfylt",
} as const;
