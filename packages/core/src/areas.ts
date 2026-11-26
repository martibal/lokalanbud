/**
 * Områdene gjesten kan velge. Oslos 15 bydeler pluss Sentrum, som formelt
 * ikke er en bydel, men som folk søker etter.
 */
export const OSLO_AREAS = [
  { id: "alna", name: "Alna" },
  { id: "bjerke", name: "Bjerke" },
  { id: "frogner", name: "Frogner" },
  { id: "gamle-oslo", name: "Gamle Oslo" },
  { id: "grorud", name: "Grorud" },
  { id: "grunerlokka", name: "Grünerløkka" },
  { id: "nordre-aker", name: "Nordre Aker" },
  { id: "nordstrand", name: "Nordstrand" },
  { id: "sagene", name: "Sagene" },
  { id: "sentrum", name: "Sentrum" },
  { id: "st-hanshaugen", name: "St. Hanshaugen" },
  { id: "stovner", name: "Stovner" },
  { id: "sondre-nordstrand", name: "Søndre Nordstrand" },
  { id: "ullern", name: "Ullern" },
  { id: "vestre-aker", name: "Vestre Aker" },
  { id: "ostensjo", name: "Østensjø" },
] as const;

export type AreaId = (typeof OSLO_AREAS)[number]["id"];

export const AREA_IDS = OSLO_AREAS.map((a) => a.id) as [AreaId, ...AreaId[]];

export function areaName(id: AreaId): string {
  const area = OSLO_AREAS.find((a) => a.id === id);
  if (!area) throw new Error(`Ukjent område: ${id}`);
  return area.name;
}
