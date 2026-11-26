import { describe, expect, it } from "vitest";
import {
  AREA_IDS,
  chargeForOpenedOffer,
  checkOfferAnswers,
  feeBasisNok,
  isUrgent,
  mustRequirementsBlocking,
  norwegianMobile,
  offerFeeNok,
  requestInputSchema,
  type Criterion,
} from "./index";

describe("offerFeeNok", () => {
  it("tar 0,75 % av grunnlaget og runder halve kroner opp", () => {
    expect(offerFeeNok(16_200)).toBe(122); // 121,5
    expect(offerFeeNok(20_000)).toBe(150);
    expect(offerFeeNok(10_000)).toBe(75);
  });

  it("bruker minsteprisen 19 kr", () => {
    expect(offerFeeNok(1_000)).toBe(19);
    expect(offerFeeNok(2_533)).toBe(19);
    expect(offerFeeNok(2_534)).toBe(19); // 19,005
    expect(offerFeeNok(2_600)).toBe(20); // 19,5
  });

  it("bruker maksprisen 499 kr", () => {
    expect(offerFeeNok(66_533)).toBe(499); // 498,9975
    expect(offerFeeNok(1_000_000)).toBe(499);
  });

  it("avviser grunnlag som ikke er positive heltall", () => {
    for (const bad of [0, -100, 100.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => offerFeeNok(bad)).toThrow(RangeError);
    }
  });
});

describe("feeBasisNok", () => {
  it("bruker gjestens budsjett når det er fast", () => {
    expect(feeBasisNok({ kind: "fixed", amountNok: 16_200 }, 14_000)).toBe(16_200);
  });

  it("bruker lokalets totalpris når budsjettet er veiledende", () => {
    expect(feeBasisNok({ kind: "indicative", amountNok: 16_200 }, 14_000)).toBe(14_000);
  });
});

describe("chargeForOpenedOffer", () => {
  const budget = { kind: "fixed", amountNok: 20_000 } as const;

  it("gir de tre første åpnede tilbudene gratis", () => {
    expect(chargeForOpenedOffer(budget, 18_000, 0)).toEqual({ feeNok: 0, free: true });
    expect(chargeForOpenedOffer(budget, 18_000, 2)).toEqual({ feeNok: 0, free: true });
  });

  it("fakturerer fra det fjerde", () => {
    expect(chargeForOpenedOffer(budget, 18_000, 3)).toEqual({ feeNok: 150, free: false });
  });
});

describe("checkOfferAnswers", () => {
  const criteria: Criterion[] = [
    { id: "c1", kind: "fixed", key: "byob", importance: "must" },
    { id: "c2", kind: "fixed", key: "cloakroom", importance: "wish" },
    { id: "c3", kind: "custom", text: "Plass til dansegulv", importance: "wish" },
  ];

  it("godtar et tilbud der alle må-krav er oppfylt", () => {
    expect(
      checkOfferAnswers(criteria, [
        { criterionId: "c1", value: "meets" },
        { criterionId: "c2", value: "does_not_meet", comment: "Vi har stativ i gangen" },
        { criterionId: "c3", value: "meets" },
      ]),
    ).toEqual([]);
  });

  it("stopper tilbud som ikke oppfyller et må-krav, også med forbehold", () => {
    const problems = checkOfferAnswers(criteria, [
      { criterionId: "c1", value: "meets_with_reservation", comment: "Bare vin, ikke brennevin" },
      { criterionId: "c2", value: "meets" },
      { criterionId: "c3", value: "meets" },
    ]);
    expect(problems).toContainEqual({ code: "must_not_met", criterionId: "c1" });
  });

  it("krever kommentar ved avvik fra et ønske", () => {
    const problems = checkOfferAnswers(criteria, [
      { criterionId: "c1", value: "meets" },
      { criterionId: "c2", value: "does_not_meet", comment: "  " },
      { criterionId: "c3", value: "meets" },
    ]);
    expect(problems).toEqual([{ code: "comment_required", criterionId: "c2" }]);
  });

  it("krever svar på alle krav og avviser ukjente og doble svar", () => {
    const problems = checkOfferAnswers(criteria, [
      { criterionId: "c1", value: "meets" },
      { criterionId: "c1", value: "meets" },
      { criterionId: "x", value: "meets" },
    ]);
    expect(problems).toEqual(
      expect.arrayContaining([
        { code: "duplicate_answer", criterionId: "c1" },
        { code: "unknown_criterion", criterionId: "x" },
        { code: "missing_answer", criterionId: "c2" },
        { code: "missing_answer", criterionId: "c3" },
      ]),
    );
  });

  it("finner må-krav som gjør at lokalet bare kan svare «Passer ikke»", () => {
    expect(
      mustRequirementsBlocking(criteria, [{ criterionId: "c1", value: "does_not_meet" }]),
    ).toEqual(["c1"]);
  });
});

describe("isUrgent", () => {
  it("merker forespørsler innen 14 dager automatisk", () => {
    expect(isUrgent({ today: "2026-12-01", earliestDate: "2026-12-15", markedUrgentByGuest: false })).toBe(true);
    expect(isUrgent({ today: "2026-12-01", earliestDate: "2026-12-16", markedUrgentByGuest: false })).toBe(false);
  });

  it("lar gjesten merke forespørselen selv, for eksempel tre uker før", () => {
    expect(isUrgent({ today: "2026-12-01", earliestDate: "2026-12-22", markedUrgentByGuest: true })).toBe(true);
  });
});

describe("requestInputSchema", () => {
  const today = "2026-12-01";
  const valid = {
    eventType: "birthday",
    date: { mode: "exact", date: "2027-01-16" },
    guestCount: 100,
    areas: ["grunerlokka", "sagene"],
    budget: { amountNok: 16_200, indicative: false },
    fixedCriteria: { byob: "must", wheelchair: "wish" },
    customCriteria: [{ text: "  Plass til liveband  ", importance: "wish" }],
    markedUrgent: false,
  };

  it("godtar en gyldig forespørsel og vasker fritekst", () => {
    const parsed = requestInputSchema(today).parse(valid);
    expect(parsed.customCriteria[0]?.text).toBe("Plass til liveband");
  });

  it("godtar alle områdene samtidig", () => {
    expect(requestInputSchema(today).safeParse({ ...valid, areas: [...AREA_IDS] }).success).toBe(true);
  });

  it("avviser datoer som har vært, og fleksible perioder over 60 dager", () => {
    const schema = requestInputSchema(today);
    expect(schema.safeParse({ ...valid, date: { mode: "exact", date: "2026-11-30" } }).success).toBe(false);
    expect(
      schema.safeParse({ ...valid, date: { mode: "flexible", from: "2027-01-01", to: "2027-03-15" } }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...valid, date: { mode: "flexible", from: "2027-01-01", to: "2027-02-15" } }).success,
    ).toBe(true);
  });

  it("avviser ukjente felt, ukjente områder og doble områder", () => {
    const schema = requestInputSchema(today);
    expect(schema.safeParse({ ...valid, feeNok: 0 }).success).toBe(false);
    expect(schema.safeParse({ ...valid, areas: ["bergen"] }).success).toBe(false);
    expect(schema.safeParse({ ...valid, areas: ["sagene", "sagene"] }).success).toBe(false);
  });

  it("avviser for mange egne krav", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ text: `Krav nummer ${i}`, importance: "wish" }));
    expect(requestInputSchema(today).safeParse({ ...valid, customCriteria: many }).success).toBe(false);
  });
});

describe("norwegianMobile", () => {
  it("normaliserer vanlige skrivemåter", () => {
    expect(norwegianMobile.parse("912 34 567")).toBe("+4791234567");
    expect(norwegianMobile.parse("0047 41234567")).toBe("+4741234567");
    expect(norwegianMobile.parse("+47 912-34-567")).toBe("+4791234567");
  });

  it("avviser fasttelefon og utenlandske numre", () => {
    expect(norwegianMobile.safeParse("22 12 34 56").success).toBe(false);
    expect(norwegianMobile.safeParse("+46701234567").success).toBe(false);
  });
});

describe("todayInOslo", () => {
  it("bruker norsk tid, også rett etter midnatt", async () => {
    const { todayInOslo } = await import("./urgency");
    // 23:30 UTC 31. desember er 00:30 1. januar i Oslo.
    expect(todayInOslo(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(todayInOslo(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
  });
});

describe("formatNok", () => {
  it("bruker mellomrom som tusenskille", async () => {
    const { formatNok } = await import("./format");
    expect(formatNok(16200)).toBe("16 200 kr");
    expect(formatNok(1000000)).toBe("1 000 000 kr");
    expect(formatNok(19)).toBe("19 kr");
  });
});
