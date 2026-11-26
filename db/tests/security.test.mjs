// Tester tilgangsstyring, tilbudsregler og fakturering mot en ekte Postgres.
// Kjør med: pnpm test:db
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createRequest, createTestDatabase, goodAnswers, seed, submitOffer } from "./helpers.mjs";

let db;
let ids;

before(async () => {
  db = await createTestDatabase();
  ids = await seed(db.pool);
});

after(async () => {
  await db?.drop();
});

describe("tilgang til data", () => {
  it("alle tabeller har radnivåsikkerhet slått på", async () => {
    const { rows } = await db.pool.query(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
    );
    assert.deepEqual(rows, [], "tabeller uten radnivåsikkerhet: " + rows.map((r) => r.tablename).join(", "));
  });

  it("anonyme brukere får ikke lese noe", async () => {
    await db.asAnon(async (c) => {
      await assert.rejects(c.query("select * from public.requests"), /permission denied/);
    });
    await db.asAnon(async (c) => {
      await assert.rejects(c.query("select * from public.profiles"), /permission denied/);
    });
  });

  it("en gjest ser bare sin egen profil og sine egne forespørsler", async () => {
    await createRequest(db, ids.guest);
    const profiles = await db.asUser(ids.otherGuest, (c) => c.query("select id from public.profiles"));
    assert.deepEqual(profiles.rows.map((r) => r.id), [ids.otherGuest]);
    const requests = await db.asUser(ids.otherGuest, (c) => c.query("select id from public.requests"));
    assert.equal(requests.rowCount, 0);
  });

  it("lokaler ser åpne forespørsler, men aldri gjestens id eller kontaktinformasjon", async () => {
    const req = await createRequest(db, ids.guest);
    const listed = await db.asUser(ids.venueUser1, (c) =>
      c.query("select * from public.open_requests_for_venues()"),
    );
    const row = listed.rows.find((r) => r.id === req.requestId);
    assert.ok(row, "forespørselen skal være synlig for lokalet");
    assert.equal("guest_id" in row, false);

    const direct = await db.asUser(ids.venueUser1, (c) => c.query("select * from public.requests"));
    assert.equal(direct.rowCount, 0, "lokaler skal ikke kunne lese tabellen direkte");

    const profiles = await db.asUser(ids.venueUser1, (c) =>
      c.query("select * from public.profiles where id = $1", [ids.guest]),
    );
    assert.equal(profiles.rowCount, 0);

    const criteria = await db.asUser(ids.venueUser1, (c) =>
      c.query("select id from public.request_criteria where request_id = $1", [req.requestId]),
    );
    assert.equal(criteria.rowCount, 2, "lokalet skal se kravene det må svare på");
  });

  it("uverifiserte lokaler ser ingen forespørsler og kan ikke sende tilbud", async () => {
    const req = await createRequest(db, ids.guest);
    const listed = await db.asUser(ids.unverifiedUser, (c) =>
      c.query("select * from public.open_requests_for_venues()"),
    );
    assert.equal(listed.rowCount, 0);
    await assert.rejects(submitOffer(db, ids.unverifiedUser, ids.unverifiedVenue, req), /ikke verifisert/);
  });

  it("et lokale ser ikke andre lokalers tilbud eller priser", async () => {
    const req = await createRequest(db, ids.guest);
    await submitOffer(db, ids.venueUser1, ids.venue1, req, 14000);
    const offerId2 = await submitOffer(db, ids.venueUser2, ids.venue2, req, 13000);

    const seen = await db.asUser(ids.venueUser1, (c) =>
      c.query("select o.id, v.total_price_nok from public.offers o join public.offer_versions v on v.offer_id = o.id"),
    );
    assert.ok(seen.rows.every((r) => r.id !== offerId2), "konkurrentens tilbud skal ikke vises");

    const prices = await db.asUser(ids.venueUser1, (c) =>
      c.query("select * from public.offer_versions where offer_id = $1", [offerId2]),
    );
    assert.equal(prices.rowCount, 0);
  });

  it("en ansatt kan ikke sende tilbud på vegne av et annet lokale", async () => {
    const req = await createRequest(db, ids.guest);
    await assert.rejects(submitOffer(db, ids.venueUser1, ids.venue2, req), /Ingen tilgang/);
  });

  it("en gjest kan ikke opprette forespørsel i en annens navn eller med annen status", async () => {
    await assert.rejects(
      db.asUser(ids.otherGuest, (c) =>
        c.query(
          `insert into public.requests (guest_id, event_type, date_from, date_to, guest_count, areas, budget_nok)
           values ($1, 'birthday', current_date + 5, current_date + 5, 50, '{sagene}', 5000)`,
          [ids.guest],
        ),
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.asUser(ids.guest, (c) =>
        c.query(
          `insert into public.requests (guest_id, event_type, date_from, date_to, guest_count, areas, budget_nok, status)
           values ($1, 'birthday', current_date + 5, current_date + 5, 50, '{sagene}', 5000, 'booked')`,
          [ids.guest],
        ),
      ),
      /row-level security/,
    );
  });

  it("en bruker kan ikke sette sitt eget telefonnummer som verifisert", async () => {
    await assert.rejects(
      db.asUser(ids.guest, (c) =>
        c.query("update public.profiles set phone_verified_at = now() where id = $1", [ids.guest]),
      ),
      /permission denied/,
    );
  });

  it("revisjonsloggen er ikke lesbar for brukere", async () => {
    await assert.rejects(
      db.asUser(ids.venueUser1, (c) => c.query("select * from public.audit_log")),
      /permission denied/,
    );
  });
});

describe("regler for tilbud", () => {
  it("et lokale som ikke oppfyller et må-krav, kan ikke sende tilbud", async () => {
    const req = await createRequest(db, ids.guest);
    const answers = JSON.stringify([
      { criterion_id: req.mustId, value: "meets_with_reservation", comment: "Bare vin og øl" },
      { criterion_id: req.wishId, value: "meets" },
    ]);
    await assert.rejects(submitOffer(db, ids.venueUser1, ids.venue1, req, 15000, answers), /må-krav/);
  });

  it("alle krav må besvares, og avvik fra ønsker må forklares", async () => {
    const req = await createRequest(db, ids.guest);
    await assert.rejects(
      submitOffer(db, ids.venueUser1, ids.venue1, req, 15000,
        JSON.stringify([{ criterion_id: req.mustId, value: "meets" }])),
      /Alle krav/,
    );
    await assert.rejects(
      submitOffer(db, ids.venueUser1, ids.venue1, req, 15000,
        JSON.stringify([
          { criterion_id: req.mustId, value: "meets" },
          { criterion_id: req.wishId, value: "does_not_meet" },
        ])),
      /forklares/,
    );
  });

  it("bare tre tilbud kommer gjennom, også når fem lokaler sender samtidig", async () => {
    const req = await createRequest(db, ids.guest);
    const attempts = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((n) => submitOffer(db, ids[`venueUser${n}`], ids[`venue${n}`], req)),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled");
    const rejected = attempts.filter((a) => a.status === "rejected");
    assert.equal(ok.length, 3);
    assert.equal(rejected.length, 2);
    for (const r of rejected) assert.match(String(r.reason), /tilbudsplassene/);
  });

  it("et lokale kan bare sende ett tilbud per forespørsel og runde", async () => {
    const req = await createRequest(db, ids.guest);
    await submitOffer(db, ids.venueUser1, ids.venue1, req);
    await assert.rejects(submitOffer(db, ids.venueUser1, ids.venue1, req), /allerede sendt/);
  });

  it("tilbudsversjoner kan ikke endres i ettertid, og har kontrollsum", async () => {
    const req = await createRequest(db, ids.guest);
    const offerId = await submitOffer(db, ids.venueUser1, ids.venue1, req);
    await assert.rejects(
      db.pool.query("update public.offer_versions set total_price_nok = 1 where offer_id = $1", [offerId]),
      /kan ikke endres/,
    );
    const { rows } = await db.pool.query(
      "select length(content_hash) as len from public.offer_versions where offer_id = $1",
      [offerId],
    );
    assert.equal(rows[0].len, 32);
  });
});

describe("fakturering", () => {
  it("bare gjesten som eier forespørselen kan åpne tilbudet", async () => {
    const req = await createRequest(db, ids.guest);
    const offerId = await submitOffer(db, ids.venueUser1, ids.venue1, req);
    await assert.rejects(
      db.asUser(ids.otherGuest, (c) => c.query("select * from public.open_offer($1)", [offerId])),
      /Ingen tilgang/,
    );
    await assert.rejects(
      db.asUser(ids.venueUser1, (c) => c.query("select * from public.open_offer($1)", [offerId])),
      /Ingen tilgang/,
    );
  });

  it("de tre første åpnede tilbudene er gratis, deretter 0,75 % av budsjettet", async () => {
    const fees = [];
    for (let i = 0; i < 4; i++) {
      const req = await createRequest(db, ids.guest, { budgetNok: 20000 });
      const offerId = await submitOffer(db, ids.venueUser3, ids.venue3, req);
      const { rows } = await db.asUser(ids.guest, (c) => c.query("select * from public.open_offer($1)", [offerId]));
      fees.push(rows[0]);
    }
    assert.deepEqual(fees.map((f) => f.free_intro), [true, true, true, false]);
    assert.deepEqual(fees.map((f) => f.fee_nok), [0, 0, 0, 150]);
  });

  it("samme tilbud faktureres bare én gang, også ved gjentatte og samtidige åpninger", async () => {
    const req = await createRequest(db, ids.guest);
    const offerId = await submitOffer(db, ids.venueUser4, ids.venue4, req);
    await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        db.asUser(ids.guest, (c) => c.query("select * from public.open_offer($1)", [offerId])),
      ),
    );
    const { rows } = await db.pool.query("select count(*)::int as n from public.billing_events where offer_id = $1", [offerId]);
    assert.equal(rows[0].n, 1);
  });

  it("en endring av tilbudet gir ingen ny fakturering", async () => {
    const req = await createRequest(db, ids.guest);
    const offerId = await submitOffer(db, ids.venueUser5, ids.venue5, req);
    await db.asUser(ids.guest, (c) => c.query("select * from public.open_offer($1)", [offerId]));
    const version = await db.asUser(ids.venueUser5, (c) =>
      c.query("select public.revise_offer($1, 14000, 'Ny pris', $2::jsonb) as v", [offerId, goodAnswers(req)]),
    );
    assert.equal(version.rows[0].v, 2);
    const again = await db.asUser(ids.guest, (c) => c.query("select * from public.open_offer($1)", [offerId]));
    assert.equal(again.rows[0].first_open, false);
    const { rows } = await db.pool.query("select count(*)::int as n from public.billing_events where offer_id = $1", [offerId]);
    assert.equal(rows[0].n, 1);
  });

  it("ved veiledende budsjett regnes gebyret av lokalets totalpris", async () => {
    // Gratistilbudene er brukt opp, slik at gebyret faktisk beregnes.
    await db.pool.query("update public.venues set free_intro_offers_used = 3 where id = $1", [ids.venue2]);
    const req = await createRequest(db, ids.guest, { budgetNok: 50000, indicative: true });
    const offerId = await submitOffer(db, ids.venueUser2, ids.venue2, req, 30000);
    const { rows } = await db.asUser(ids.guest, (c) => c.query("select * from public.open_offer($1)", [offerId]));
    assert.equal(rows[0].fee_nok, 225); // 0,75 % av 30 000
  });

  it("fakturagrunnlaget er synlig for regnskap, men ikke for vanlige ansatte i andre lokaler", async () => {
    const accountant = await db.asUser(ids.accountant, (c) => c.query("select * from public.billing_events"));
    assert.ok(accountant.rows.every((r) => r.venue_id === ids.venue1));
    const other = await db.asUser(ids.venueUser2, (c) =>
      c.query("select * from public.billing_events where venue_id = $1", [ids.venue1]),
    );
    assert.equal(other.rowCount, 0);
  });

  it("faktureringshendelser kan ikke endres eller slettes", async () => {
    await assert.rejects(db.pool.query("update public.billing_events set fee_nok = 0"), /kan ikke endres/);
    await assert.rejects(db.pool.query("delete from public.billing_events"), /kan ikke endres/);
  });

  it("gebyrformelen i databasen er lik den i appen", async () => {
    const cases = [[1000, 19], [16200, 122], [20000, 150], [66533, 499], [1000000, 499], [2600, 20]];
    for (const [basis, expected] of cases) {
      const { rows } = await db.pool.query("select public.offer_fee_nok($1) as fee", [basis]);
      assert.equal(rows[0].fee, expected, `grunnlag ${basis}`);
    }
  });
});
