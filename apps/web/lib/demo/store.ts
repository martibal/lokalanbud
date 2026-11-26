/**
 * Demolager i minnet. Brukes bare i demoversjonen, slik at hele flyten for
 * gjest og lokale kan prøves lokalt uten database. Alt nullstilles når
 * serveren startes på nytt.
 *
 * Reglene er de samme som i den ekte løsningen, fordi de kommer fra
 * @lokalbud/core: må-krav, tre tilbudsplasser, gebyr og gratistilbud.
 * I produksjon gjøres det samme av funksjonene i db/migrations.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  MAX_OFFER_SLOTS,
  chargeForOpenedOffer,
  checkOfferAnswers,
  isUrgent,
  todayInOslo,
  type AreaId,
  type Criterion,
  type CriterionAnswer,
  type FixedCriterionKey,
  type Importance,
  type RequestInput,
} from "@lokalbud/core";

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

export type VenueRole = "owner" | "booking" | "staff" | "accounting";

export type DemoUser =
  | { id: string; kind: "guest"; name: string; phone: string; email?: string }
  | {
      id: string;
      kind: "venue";
      name: string;
      venueId: string;
      role: VenueRole;
      /** Kontaktinformasjon gjesten ser i tilbud denne personen har sendt. */
      phone: string;
      email: string;
    };

export type Venue = {
  id: string;
  name: string;
  area: AreaId;
  address: string;
  capacity: number;
  description: string;
  orgNumber: string;
  freeIntroOffersUsed: number;
  /** Bilder av lokalet. I demoen er dette illustrasjoner. */
  images: string[];
  /** Kort om lokalet slik gjesten ser det når tilbudet åpnes. */
  highlights: string[];
};

export type RequestStatus = "open" | "booked" | "closed";

export type DemoRequest = {
  id: string;
  guestId: string;
  createdAt: string;
  input: RequestInput;
  criteria: Criterion[];
  status: RequestStatus;
  round: number;
};

/**
 * active: sendt og gyldig. confirmed: godtatt av gjesten, bindende for begge.
 * declined: ikke valgt. withdrawn: trukket av lokalet. superseded: gjesten startet ny runde.
 */
export type OfferStatus = "active" | "confirmed" | "declined" | "withdrawn" | "superseded";

export type OfferVersion = {
  version: number;
  totalPriceNok: number;
  conditions: string;
  cancellationTerms: string;
  /** Siste dag gjesten kan godta tilbudet. Lokalet holder datoen av til da. */
  validUntil: string;
  answers: CriterionAnswer[];
  contentHash: string;
  createdAt: string;
  createdBy: string;
};

export type DemoOffer = {
  id: string;
  requestId: string;
  venueId: string;
  round: number;
  status: OfferStatus;
  versions: OfferVersion[];
  createdAt: string;
  acceptedAt?: string;
  acceptedVersion?: number;
  reference?: string;
};

/** Kopi av bestillingen som sendes på e-post. I demoen lagres den bare her. */
export type OutboxMessage = {
  id: string;
  to: string;
  toName: string;
  subject: string;
  body: string;
  offerId: string;
  sentAt: string;
};

export type BillingEvent = {
  id: string;
  offerId: string;
  venueId: string;
  requestId: string;
  feeNok: number;
  freeIntro: boolean;
  openedAt: string;
};

export type SavedSearch = {
  id: string;
  venueId: string;
  createdBy: string;
  name: string;
  /** Filteret som spørrestreng, samme format som adressefeltet på oversikten. */
  query: string;
  notify: boolean;
  createdAt: string;
  lastSeenAt: string;
};

/** Lokaler som har svart «Passer ikke». Gratis, og forespørselen skjules for dem. */
export type Decline = { requestId: string; venueId: string; reason: string; at: string };

type Store = {
  outbox: OutboxMessage[];
  savedSearches: SavedSearch[];
  users: DemoUser[];
  venues: Venue[];
  requests: DemoRequest[];
  offers: DemoOffer[];
  billing: BillingEvent[];
  declines: Decline[];
  referenceCounter: number;
};

export class DemoRuleError extends Error {}

// ---------------------------------------------------------------------------
// Startdata. Alle navn er oppdiktet.
// ---------------------------------------------------------------------------

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function criteriaFrom(input: RequestInput): Criterion[] {
  const fixed = Object.entries(input.fixedCriteria) as [FixedCriterionKey, Importance][];
  return [
    ...fixed.map(([key, importance]) => ({ id: randomUUID(), kind: "fixed" as const, key, importance })),
    ...input.customCriteria.map((c) => ({
      id: randomUUID(),
      kind: "custom" as const,
      text: c.text,
      importance: c.importance,
    })),
  ];
}

function hashVersion(offerId: string, v: Omit<OfferVersion, "contentHash" | "createdAt" | "createdBy">): string {
  const canonical = JSON.stringify({
    offerId,
    version: v.version,
    totalPriceNok: v.totalPriceNok,
    conditions: v.conditions,
    cancellationTerms: v.cancellationTerms,
    validUntil: v.validUntil,
    answers: [...v.answers]
      .sort((a, b) => a.criterionId.localeCompare(b.criterionId))
      .map((a) => ({ criterionId: a.criterionId, value: a.value, comment: a.comment?.trim() ?? "" })),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function seed(): Store {
  const today = todayInOslo();
  const venues: Venue[] = [
    {
      id: "v-bryggeloftet",
      name: "Bryggeloftet",
      area: "grunerlokka",
      address: "Elvegata 12 (oppdiktet)",
      capacity: 120,
      description: "Loft med langbord, egen bar og plass til band. Medbrakt drikke etter avtale.",
      orgNumber: "900000001",
      freeIntroOffersUsed: 0,
      images: ["/demo/venues/bryggeloftet-1.svg", "/demo/venues/bryggeloftet-2.svg", "/demo/venues/bryggeloftet-3.svg"],
      highlights: [
        "Egen bar med skjenkebevilling",
        "Langbord til 120 eller stående til 180",
        "Lydanlegg og plass til band",
        "Åpent til kl. 02",
      ],
    },
    {
      id: "v-sagahuset",
      name: "Sagahuset",
      area: "sagene",
      address: "Mølleveien 3 (oppdiktet)",
      capacity: 80,
      description: "Grendehus med fullt kjøkken. Rimelig leie, gjestene ordner mat selv.",
      orgNumber: "900000002",
      freeIntroOffersUsed: 3,
      images: ["/demo/venues/sagahuset-1.svg", "/demo/venues/sagahuset-2.svg", "/demo/venues/sagahuset-3.svg"],
      highlights: [
        "Fullt utstyrt kjøkken",
        "Bord og stoler til 80",
        "Gjestene ordner mat og drikke selv",
        "Parkering ved huset",
      ],
    },
    {
      id: "v-fjordsalen",
      name: "Fjordsalen",
      area: "frogner",
      address: "Kaiveien 40 (oppdiktet)",
      capacity: 200,
      description: "Selskapslokale med catering fra eget kjøkken og skjenkebevilling.",
      orgNumber: "900000003",
      freeIntroOffersUsed: 1,
      images: ["/demo/venues/fjordsalen-1.svg", "/demo/venues/fjordsalen-2.svg", "/demo/venues/fjordsalen-3.svg"],
      highlights: [
        "Catering fra eget kjøkken",
        "Skjenkebevilling",
        "Scene, prosjektor og lydanlegg",
        "Garderobe og heis",
      ],
    },
    {
      id: "v-lindekroa",
      name: "Lindekroa",
      area: "nordre-aker",
      address: "Lindealleen 7 (oppdiktet)",
      capacity: 60,
      description: "Kro med peisestue og tre-retters meny. Fast pris per gjest.",
      orgNumber: "900000004",
      freeIntroOffersUsed: 0,
      images: ["/demo/venues/lindekroa-1.svg", "/demo/venues/lindekroa-2.svg", "/demo/venues/lindekroa-3.svg"],
      highlights: [
        "Tre-retters meny til fast pris",
        "Peisestue til 60",
        "Vinkart og alkoholfritt alternativ",
        "Trinnfri inngang",
      ],
    },
  ];

  const users: DemoUser[] = [
    { id: "u-kari", kind: "guest", name: "Kari Nordmann", phone: "+4791234567", email: "kari@eksempel.demo" },
    { id: "u-ola", kind: "guest", name: "Ola Hansen", phone: "+4741234567", email: "ola@eksempel.demo" },
    { id: "u-ingrid", kind: "guest", name: "Ingrid Berg", phone: "+4790000001", email: "ingrid@eksempel.demo" },
    {
      id: "u-bryggeloftet",
      kind: "venue",
      name: "Siri (booking)",
      venueId: "v-bryggeloftet",
      role: "booking",
      phone: "+4798765001",
      email: "siri@bryggeloftet.demo",
    },
    {
      id: "u-bryggeloftet-regnskap",
      kind: "venue",
      name: "Jonas (regnskap)",
      venueId: "v-bryggeloftet",
      role: "accounting",
      phone: "+4798765002",
      email: "jonas@bryggeloftet.demo",
    },
    {
      id: "u-sagahuset",
      kind: "venue",
      name: "Per (eier)",
      venueId: "v-sagahuset",
      role: "owner",
      phone: "+4798765003",
      email: "per@sagahuset.demo",
    },
    {
      id: "u-fjordsalen",
      kind: "venue",
      name: "Amir (booking)",
      venueId: "v-fjordsalen",
      role: "booking",
      phone: "+4798765004",
      email: "amir@fjordsalen.demo",
    },
    {
      id: "u-lindekroa",
      kind: "venue",
      name: "Lise (eier)",
      venueId: "v-lindekroa",
      role: "owner",
      phone: "+4798765005",
      email: "lise@lindekroa.demo",
    },
  ];

  const store: Store = {
    outbox: [],
    savedSearches: [],
    users,
    venues,
    requests: [],
    offers: [],
    billing: [],
    declines: [],
    referenceCounter: 0,
  };

  const mk = (guestId: string, daysAhead: number, input: Omit<RequestInput, "date">, hoursAgo: number) => {
    const full: RequestInput = { ...input, date: { mode: "exact", date: addDays(today, daysAhead) } };
    const request: DemoRequest = {
      id: randomUUID(),
      guestId,
      createdAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
      input: full,
      criteria: criteriaFrom(full),
      status: "open",
      round: 1,
    };
    store.requests.push(request);
    return request;
  };

  // Karis forespørsel har allerede fått to tilbud, så gjestesiden har noe å vise.
  const kari = mk(
    "u-kari",
    45,
    {
      eventType: "birthday",
      guestCount: 100,
      areas: ["grunerlokka", "sagene", "gamle-oslo"],
      budget: { amountNok: 16_200, indicative: false },
      fixedCriteria: { byob: "must", wheelchair: "wish", sound_system: "wish" },
      customCriteria: [{ text: "Plass til liveband", importance: "wish" }],
      markedUrgent: false,
      description: "50-årsdag. Middag og dans, gjerne til langt på natt.",
    },
    20,
  );

  mk(
    "u-ola",
    9,
    {
      eventType: "company",
      guestCount: 45,
      areas: ["frogner", "sentrum", "st-hanshaugen"],
      budget: { amountNok: 40_000, indicative: true },
      fixedCriteria: { food_served: "must", alcohol_serving: "must" },
      customCriteria: [{ text: "Prosjektor og lerret", importance: "wish" }],
      markedUrgent: false,
      description: "Julebord for et lite firma. Dobbeltbooket hos forrige lokale.",
    },
    3,
  );

  mk(
    "u-ingrid",
    60,
    {
      eventType: "confirmation",
      guestCount: 35,
      areas: ["nordre-aker", "vestre-aker", "sagene"],
      budget: { amountNok: 12_000, indicative: false },
      fixedCriteria: { kitchen: "must", external_catering: "wish" },
      customCriteria: [],
      markedUrgent: false,
    },
    30,
  );

  const answerAll = (req: DemoRequest, tweak: (c: Criterion) => CriterionAnswer | undefined) =>
    req.criteria.map((c) => tweak(c) ?? { criterionId: c.id, value: "meets" as const });

  insertOffer(store, kari, "v-bryggeloftet", "u-bryggeloftet", {
    totalPriceNok: 15_500,
    conditions: "Leie fra kl. 17 til 02, inkludert bord, stoler og lydanlegg. Vakt fra kl. 23.",
    cancellationTerms: "Gratis avbestilling inntil 30 dager før. Deretter 50 % av leien.",
    validUntil: addDays(today, 7),
    answers: answerAll(kari, (c) =>
      c.kind === "fixed" && c.key === "wheelchair"
        ? {
            criterionId: c.id,
            value: "meets_with_reservation",
            comment: "Rampe ved bakinngangen, ikke heis til loftet.",
          }
        : undefined,
    ),
  });
  insertOffer(store, kari, "v-sagahuset", "u-sagahuset", {
    totalPriceNok: 9_800,
    conditions: "Leie av hele huset fra kl. 15 til 01. Rydding og vask må gjøres av leietaker.",
    cancellationTerms: "Gratis avbestilling inntil 14 dager før.",
    validUntil: addDays(today, 5),
    answers: answerAll(kari, (c) =>
      c.kind === "fixed" && c.key === "sound_system"
        ? { criterionId: c.id, value: "does_not_meet", comment: "Ikke eget anlegg, men strøm og plass til band." }
        : undefined,
    ),
  });

  return store;
}

function insertOffer(
  store: Store,
  request: DemoRequest,
  venueId: string,
  userId: string,
  body: Omit<OfferVersion, "version" | "contentHash" | "createdAt" | "createdBy">,
): DemoOffer {
  const id = randomUUID();
  const versionBody = { ...body, version: 1 };
  const offer: DemoOffer = {
    id,
    requestId: request.id,
    venueId,
    round: request.round,
    status: "active",
    createdAt: new Date().toISOString(),
    versions: [
      {
        ...versionBody,
        contentHash: hashVersion(id, versionBody),
        createdAt: new Date().toISOString(),
        createdBy: userId,
      },
    ],
  };
  store.offers.push(offer);
  return offer;
}

// Overlever hot reload i utvikling.
const globalStore = globalThis as unknown as { __lokalbudDemo?: Store };
function db(): Store {
  globalStore.__lokalbudDemo ??= seed();
  return globalStore.__lokalbudDemo;
}

export function resetDemo(): void {
  globalStore.__lokalbudDemo = seed();
}

// ---------------------------------------------------------------------------
// Gjester i demoen (ingen bekreftelse av mobilnummer ennå)
// ---------------------------------------------------------------------------

export function createAnonymousGuest(): Extract<DemoUser, { kind: "guest" }> {
  const n = db().users.filter((u) => u.kind === "guest").length - 2;
  const guest = {
    id: `u-${randomUUID()}`,
    kind: "guest" as const,
    name: `Demogjest ${n}`,
    phone: `+479000${String(1000 + n).slice(-4)}`,
    email: `demogjest${n}@eksempel.demo`,
  };
  db().users.push(guest);
  return guest;
}

// ---------------------------------------------------------------------------
// Oppslag
// ---------------------------------------------------------------------------

export const listUsers = () => db().users;
export const getUser = (id: string | undefined) => db().users.find((u) => u.id === id);
export const getVenue = (id: string) => db().venues.find((v) => v.id === id);
export const getRequest = (id: string) => db().requests.find((r) => r.id === id);
export const getOffer = (id: string) => db().offers.find((o) => o.id === id);

export function currentVersion(offer: DemoOffer): OfferVersion {
  return offer.versions[offer.versions.length - 1]!;
}

export function earliestDate(request: DemoRequest): string {
  return request.input.date.mode === "exact" ? request.input.date.date : request.input.date.from;
}

export function requestIsUrgent(request: DemoRequest): boolean {
  return isUrgent({
    earliestDate: earliestDate(request),
    today: todayInOslo(),
    markedUrgentByGuest: request.input.markedUrgent,
  });
}

export function offersForRequest(requestId: string, round?: number): DemoOffer[] {
  return db().offers.filter((o) => o.requestId === requestId && (round === undefined || o.round === round));
}

/** Tilbud som tar en plass: aktive og aksepterte i gjeldende runde. */
export function slotsTaken(request: DemoRequest): number {
  return offersForRequest(request.id, request.round).filter((o) => o.status === "active").length;
}

export function guestRequests(guestId: string): DemoRequest[] {
  return db()
    .requests.filter((r) => r.guestId === guestId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function billingOpened(offerId: string): BillingEvent | undefined {
  return db().billing.find((b) => b.offerId === offerId);
}

// ---------------------------------------------------------------------------
// Gjesten
// ---------------------------------------------------------------------------

export function createRequest(guestId: string, input: RequestInput): DemoRequest {
  const request: DemoRequest = {
    id: randomUUID(),
    guestId,
    createdAt: new Date().toISOString(),
    input,
    criteria: criteriaFrom(input),
    status: "open",
    round: 1,
  };
  db().requests.push(request);
  return request;
}

function guestOffer(guestId: string, offerId: string): { offer: DemoOffer; request: DemoRequest } {
  const offer = getOffer(offerId);
  const request = offer && getRequest(offer.requestId);
  if (!offer || !request || request.guestId !== guestId) throw new DemoRuleError("Ingen tilgang til tilbudet");
  return { offer, request };
}

/** Gjesten trykker for å åpne tilbudet. Gir høyst én faktureringshendelse. */
export function openOffer(guestId: string, offerId: string): BillingEvent {
  const { offer, request } = guestOffer(guestId, offerId);
  const existing = billingOpened(offerId);
  if (existing) return existing;

  const venue = getVenue(offer.venueId)!;
  const budget = request.input.budget.indicative
    ? ({ kind: "indicative", amountNok: request.input.budget.amountNok } as const)
    : ({ kind: "fixed", amountNok: request.input.budget.amountNok } as const);
  const charge = chargeForOpenedOffer(budget, currentVersion(offer).totalPriceNok, venue.freeIntroOffersUsed);
  if (charge.free) venue.freeIntroOffersUsed += 1;

  const event: BillingEvent = {
    id: randomUUID(),
    offerId,
    venueId: offer.venueId,
    requestId: request.id,
    feeNok: charge.feeNok,
    freeIntro: charge.free,
    openedAt: new Date().toISOString(),
  };
  db().billing.push(event);
  return event;
}

/**
 * Gjesten godtar tilbudet. Det er bindende for begge parter med en gang:
 * lokalet har lovet å holde datoen av så lenge tilbudet er gyldig.
 * En kopi av bestillingen sendes til gjesten og til kontaktpersonen hos lokalet.
 */
export function acceptOffer(guestId: string, offerId: string): DemoOffer {
  const { offer, request } = guestOffer(guestId, offerId);
  if (request.status !== "open") throw new DemoRuleError("Forespørselen er allerede booket eller avsluttet");
  if (offer.status !== "active") throw new DemoRuleError("Tilbudet kan ikke godtas lenger");
  if (!billingOpened(offerId)) throw new DemoRuleError("Åpne tilbudet før du godtar det");
  const version = currentVersion(offer);
  if (version.validUntil < todayInOslo()) throw new DemoRuleError("Tilbudet har gått ut. Be om et nytt tilbud.");

  const store = db();
  const guest = store.users.find((u) => u.id === guestId);
  if (guest?.kind !== "guest") throw new DemoRuleError("Ingen tilgang");
  const contact = { name: guest.name, phone: guest.phone, email: guest.email ?? "" };

  store.referenceCounter += 1;
  offer.status = "confirmed";
  offer.acceptedAt = new Date().toISOString();
  offer.acceptedVersion = version.version;
  offer.reference = `LB-${new Date().getFullYear()}-${String(store.referenceCounter).padStart(5, "0")}`;
  request.status = "booked";
  for (const o of offersForRequest(request.id)) if (o.id !== offer.id && o.status === "active") o.status = "declined";

  const venue = getVenue(offer.venueId)!;
  const sender = store.users.find((u) => u.id === version.createdBy);
  const summary = [
    `Referanse: ${offer.reference}`,
    `Lokale: ${venue.name}, ${venue.address}`,
    `Gjest: ${contact.name}, ${contact.phone}, ${contact.email}`,
    `Totalpris: ${version.totalPriceNok} kr`,
    `Inkludert: ${version.conditions}`,
    `Avbestilling: ${version.cancellationTerms}`,
    `Kontrollsum: ${version.contentHash}`,
  ].join("\n");
  const sentAt = new Date().toISOString();
  store.outbox.push({
    id: randomUUID(),
    to: contact.email,
    toName: contact.name,
    subject: `Bekreftet: ${venue.name}, ${offer.reference}`,
    body: summary,
    offerId: offer.id,
    sentAt,
  });
  if (sender?.kind === "venue") {
    store.outbox.push({
      id: randomUUID(),
      to: sender.email,
      toName: `${sender.name.replace(/ \(.*\)$/, "")}, ${venue.name}`,
      subject: `Ny booking: ${offer.reference}`,
      body: summary,
      offerId: offer.id,
      sentAt,
    });
  }
  return offer;
}

export function outboxForOffer(offerId: string): OutboxMessage[] {
  return db().outbox.filter((m) => m.offerId === offerId);
}

export function allOutbox(): OutboxMessage[] {
  return [...db().outbox].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

/** Ny runde: gjeldende tilbud er fortsatt synlige, men tre nye plasser åpnes. */
export function requestNewRound(guestId: string, requestId: string): void {
  const request = getRequest(requestId);
  if (!request || request.guestId !== guestId) throw new DemoRuleError("Ingen tilgang");
  if (request.status !== "open") throw new DemoRuleError("Forespørselen er ikke åpen");
  for (const o of offersForRequest(request.id, request.round)) {
    if (o.status === "active") o.status = "superseded";
  }
  request.round += 1;
}

export function closeRequest(guestId: string, requestId: string): void {
  const request = getRequest(requestId);
  if (!request || request.guestId !== guestId) throw new DemoRuleError("Ingen tilgang");
  if (request.status !== "open") return;
  request.status = "closed";
  for (const o of offersForRequest(request.id)) if (o.status === "active") o.status = "declined";
}

// ---------------------------------------------------------------------------
// Lokalet
// ---------------------------------------------------------------------------

function venueUser(userId: string): Extract<DemoUser, { kind: "venue" }> {
  const user = getUser(userId);
  if (!user || user.kind !== "venue") throw new DemoRuleError("Ingen tilgang");
  return user;
}

export type OpenRequestView = {
  request: DemoRequest;
  urgent: boolean;
  slotsLeft: number;
  ownOffer?: DemoOffer;
  declined: boolean;
};

/** Åpne forespørsler slik et lokale ser dem: uten gjestens navn eller nummer. */
export function openRequestsForVenue(userId: string): OpenRequestView[] {
  const user = venueUser(userId);
  const today = todayInOslo();
  return db()
    .requests.filter((r) => r.status === "open")
    .filter((r) => (r.input.date.mode === "exact" ? r.input.date.date : r.input.date.to) >= today)
    .map((request) => ({
      request,
      urgent: requestIsUrgent(request),
      slotsLeft: MAX_OFFER_SLOTS - slotsTaken(request),
      ownOffer: offersForRequest(request.id, request.round).find((o) => o.venueId === user.venueId),
      declined: db().declines.some((d) => d.requestId === request.id && d.venueId === user.venueId),
    }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.request.createdAt.localeCompare(a.request.createdAt));
}

export type OfferBody = {
  totalPriceNok: number;
  conditions: string;
  cancellationTerms: string;
  validUntil: string;
  answers: CriterionAnswer[];
};

/** Tilbudet må gjelde minst til i dag, og ikke lenger enn til arrangementet. */
function checkValidUntil(request: DemoRequest, validUntil: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) throw new DemoRuleError("Velg hvor lenge tilbudet gjelder");
  if (validUntil < todayInOslo()) throw new DemoRuleError("Tilbudet må gjelde minst ut i dag");
  const last = request.input.date.mode === "exact" ? request.input.date.date : request.input.date.to;
  if (validUntil > last) throw new DemoRuleError("Tilbudet kan ikke gjelde lenger enn til arrangementet");
}

export function submitOffer(userId: string, requestId: string, body: OfferBody): DemoOffer {
  const user = venueUser(userId);
  if (user.role === "accounting") throw new DemoRuleError("Regnskap kan ikke sende tilbud");
  const request = getRequest(requestId);
  if (!request || request.status !== "open") throw new DemoRuleError("Forespørselen er ikke åpen");
  if (!Number.isSafeInteger(body.totalPriceNok) || body.totalPriceNok < 1) {
    throw new DemoRuleError("Oppgi totalpris i hele kroner");
  }
  checkValidUntil(request, body.validUntil);
  const problems = checkOfferAnswers(request.criteria, body.answers);
  if (problems.length > 0) {
    const first = problems[0]!;
    const messages: Record<string, string> = {
      missing_answer: "Alle krav må besvares",
      must_not_met: "Et må-krav er ikke oppfylt. Svar «Passer ikke» i stedet",
      comment_required: "Forklar alle avvik med en kort kommentar",
      comment_too_long: "En kommentar er for lang",
      unknown_criterion: "Ukjent krav",
      duplicate_answer: "Samme krav er besvart to ganger",
    };
    throw new DemoRuleError(messages[first.code] ?? "Tilbudet er ikke gyldig");
  }
  if (offersForRequest(request.id, request.round).some((o) => o.venueId === user.venueId)) {
    throw new DemoRuleError("Dere har allerede sendt tilbud i denne runden");
  }
  if (slotsTaken(request) >= MAX_OFFER_SLOTS) throw new DemoRuleError("Alle tilbudsplassene er tatt");
  return insertOffer(db(), request, user.venueId, userId, body);
}

/** Lokalet endrer tilbudet før aksept. Ny versjon, ingen ny fakturering. */
export function reviseOffer(userId: string, offerId: string, body: OfferBody): void {
  const user = venueUser(userId);
  const offer = getOffer(offerId);
  if (!offer || offer.venueId !== user.venueId) throw new DemoRuleError("Ingen tilgang");
  if (offer.status !== "active") throw new DemoRuleError("Tilbudet kan ikke endres nå");
  const request = getRequest(offer.requestId)!;
  checkValidUntil(request, body.validUntil);
  if (checkOfferAnswers(request.criteria, body.answers).length > 0) {
    throw new DemoRuleError("Alle krav må besvares, og må-krav må være oppfylt");
  }
  const version = currentVersion(offer).version + 1;
  const versionBody = { ...body, version };
  offer.versions.push({
    ...versionBody,
    contentHash: hashVersion(offer.id, versionBody),
    createdAt: new Date().toISOString(),
    createdBy: userId,
  });
}

export function declineRequest(userId: string, requestId: string, reason: string): void {
  const user = venueUser(userId);
  if (!db().declines.some((d) => d.requestId === requestId && d.venueId === user.venueId)) {
    db().declines.push({ requestId, venueId: user.venueId, reason, at: new Date().toISOString() });
  }
}

/** Lokalet trekker et tilbud som ikke er godtatt, for eksempel fordi datoen er booket et annet sted. */
export function withdrawOffer(userId: string, offerId: string): void {
  const user = venueUser(userId);
  if (user.role === "accounting") throw new DemoRuleError("Regnskap kan ikke trekke tilbud");
  const offer = getOffer(offerId);
  if (!offer || offer.venueId !== user.venueId) throw new DemoRuleError("Ingen tilgang");
  if (offer.status !== "active") throw new DemoRuleError("Bare tilbud som ikke er godtatt, kan trekkes");
  offer.status = "withdrawn";
}

export function venueOffers(userId: string): DemoOffer[] {
  const user = venueUser(userId);
  return db()
    .offers.filter((o) => o.venueId === user.venueId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function venueBilling(userId: string): { events: BillingEvent[]; venue: Venue } {
  const user = venueUser(userId);
  if (user.role !== "owner" && user.role !== "accounting") {
    throw new DemoRuleError("Bare eier og regnskap ser fakturagrunnlaget");
  }
  return {
    events: db()
      .billing.filter((b) => b.venueId === user.venueId)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    venue: getVenue(user.venueId)!,
  };
}

// ---------------------------------------------------------------------------
// Lagrede søk
// ---------------------------------------------------------------------------

export function saveSearch(userId: string, name: string, query: string, notify: boolean): SavedSearch {
  const user = venueUser(userId);
  const trimmed = name.trim().slice(0, 60);
  if (trimmed.length < 2) throw new DemoRuleError("Gi søket et navn");
  if (db().savedSearches.filter((s) => s.venueId === user.venueId).length >= 20) {
    throw new DemoRuleError("Dere kan ha maks 20 lagrede søk");
  }
  const now = new Date().toISOString();
  const search: SavedSearch = {
    id: randomUUID(),
    venueId: user.venueId,
    createdBy: userId,
    name: trimmed,
    query: query.slice(0, 1000),
    notify,
    createdAt: now,
    lastSeenAt: now,
  };
  db().savedSearches.push(search);
  return search;
}

export function savedSearchesForVenue(userId: string): SavedSearch[] {
  const user = venueUser(userId);
  return db().savedSearches.filter((s) => s.venueId === user.venueId);
}

export function getSavedSearch(userId: string, id: string): SavedSearch | undefined {
  return savedSearchesForVenue(userId).find((s) => s.id === id);
}

export function markSavedSearchSeen(userId: string, id: string): void {
  const search = getSavedSearch(userId, id);
  if (search) search.lastSeenAt = new Date().toISOString();
}

export function toggleSavedSearchNotify(userId: string, id: string): void {
  const search = getSavedSearch(userId, id);
  if (search) search.notify = !search.notify;
}

export function deleteSavedSearch(userId: string, id: string): void {
  const user = venueUser(userId);
  db().savedSearches = db().savedSearches.filter((s) => !(s.id === id && s.venueId === user.venueId));
}
