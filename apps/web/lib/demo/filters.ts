import { OSLO_AREAS, type AreaId } from "@lokalbud/core";
import { earliestDate, type OpenRequestView, type Venue } from "./store";

export type RequestFilters = {
  areas: AreaId[];
  from?: string;
  to?: string;
  minBudget?: number;
  onlyFitting: boolean;
};

export type FilterParams = {
  omrade?: string | string[];
  fra?: string;
  til?: string;
  minbudsjett?: string;
  passer?: string;
};

const isoDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function parseFilters(params: FilterParams): RequestFilters {
  const raw = Array.isArray(params.omrade) ? params.omrade : params.omrade ? [params.omrade] : [];
  const minBudget = Number.parseInt((params.minbudsjett ?? "").replace(/\s/g, ""), 10);
  return {
    areas: raw.filter((a): a is AreaId => OSLO_AREAS.some((o) => o.id === a)),
    ...(isoDate(params.fra) ? { from: isoDate(params.fra)! } : {}),
    ...(isoDate(params.til) ? { to: isoDate(params.til)! } : {}),
    ...(Number.isFinite(minBudget) && minBudget > 0 ? { minBudget } : {}),
    onlyFitting: params.passer === "1",
  };
}

/** Leser et lagret søk (spørrestreng) tilbake til filter. */
export function parseQuery(query: string): RequestFilters {
  const q = new URLSearchParams(query);
  return parseFilters({
    omrade: q.getAll("omrade"),
    ...(q.get("fra") ? { fra: q.get("fra")! } : {}),
    ...(q.get("til") ? { til: q.get("til")! } : {}),
    ...(q.get("minbudsjett") ? { minbudsjett: q.get("minbudsjett")! } : {}),
    ...(q.get("passer") ? { passer: q.get("passer")! } : {}),
  });
}

export function filtersToQuery(f: RequestFilters): string {
  const q = new URLSearchParams();
  for (const a of f.areas) q.append("omrade", a);
  if (f.from) q.set("fra", f.from);
  if (f.to) q.set("til", f.to);
  if (f.minBudget) q.set("minbudsjett", String(f.minBudget));
  if (f.onlyFitting) q.set("passer", "1");
  return q.toString();
}

export function hasFilters(f: RequestFilters): boolean {
  return f.areas.length > 0 || Boolean(f.from || f.to || f.minBudget) || f.onlyFitting;
}

/** Forespørselen gjelder lokalets område, og lokalet har plass til alle. */
export function fitsVenue(view: OpenRequestView, venue: Venue): boolean {
  const { input } = view.request;
  return input.areas.includes(venue.area) && input.guestCount <= venue.capacity;
}

export function applyFilters(rows: OpenRequestView[], f: RequestFilters, venue: Venue): OpenRequestView[] {
  return rows.filter((row) => {
    const { input } = row.request;
    if (f.onlyFitting && !fitsVenue(row, venue)) return false;
    if (f.areas.length > 0 && !input.areas.some((a) => f.areas.includes(a))) return false;
    const date = earliestDate(row.request);
    if (f.from && date < f.from) return false;
    if (f.to && date > f.to) return false;
    if (f.minBudget && input.budget.amountNok < f.minBudget) return false;
    return true;
  });
}

/** Kort beskrivelse av et søk, for listen over lagrede søk. */
export function describeFilters(f: RequestFilters): string {
  const parts: string[] = [];
  if (f.areas.length > 0) {
    parts.push(f.areas.map((a) => OSLO_AREAS.find((o) => o.id === a)?.name).join(", "));
  } else {
    parts.push("Hele Oslo");
  }
  if (f.from || f.to) parts.push(`dato ${f.from ?? "…"} til ${f.to ?? "…"}`);
  if (f.minBudget) parts.push(`fra ${f.minBudget.toLocaleString("nb-NO")} kr`);
  if (f.onlyFitting) parts.push("bare de som passer lokalet");
  return parts.join(", ");
}
