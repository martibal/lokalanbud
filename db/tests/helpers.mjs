// Felles oppsett for databasetestene. Hver testfil får sin egen, ferske database
// med Supabase-stubben og alle migreringene, og sletter den etterpå.
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const adminUrl =
  process.env.DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";

export async function createTestDatabase() {
  const name = `lokalbud_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 10 });

  await pool.query(readFileSync(join(root, "local", "supabase_stub.sql"), "utf8"));
  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    await pool.query(readFileSync(join(root, "migrations", file), "utf8"));
  }

  async function drop() {
    await pool.end();
    const a = new pg.Client({ connectionString: adminUrl });
    await a.connect();
    await a.query(`drop database if exists ${name} with (force)`);
    await a.end();
  }

  /** Kjører fn som en innlogget bruker, med radnivåsikkerhet slik Supabase gjør. */
  async function asUser(userId, fn) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /** Kjører fn som anonym bruker. */
  async function asAnon(fn) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role anon");
      return await fn(client);
    } finally {
      await client.query("rollback").catch(() => {});
      client.release();
    }
  }

  return { pool, asUser, asAnon, drop };
}

/** Oppretter testdata som serveren ellers ville laget (brukere, verifiserte lokaler). */
export async function seed(pool) {
  const ids = {};
  const user = async (key, name) => {
    const { rows } = await pool.query("insert into auth.users default values returning id");
    ids[key] = rows[0].id;
    await pool.query(
      "insert into public.profiles (id, display_name, phone, phone_verified_at) values ($1, $2, '+4791234567', now())",
      [ids[key], name],
    );
  };
  await user("guest", "Gjest Gjestesen");
  await user("otherGuest", "Annen Gjest");
  for (const n of [1, 2, 3, 4, 5]) await user(`venueUser${n}`, `Lokalansatt ${n}`);
  await user("unverifiedUser", "Uverifisert");
  await user("accountant", "Regnskap");

  for (const n of [1, 2, 3, 4, 5]) {
    const { rows } = await pool.query(
      "insert into public.venues (org_number, name, verified_at) values ($1, $2, now()) returning id",
      [`9${String(n).padStart(8, "0")}`, `Lokale ${n}`],
    );
    ids[`venue${n}`] = rows[0].id;
    await pool.query(
      "insert into public.venue_members (venue_id, user_id, role) values ($1, $2, 'booking')",
      [ids[`venue${n}`], ids[`venueUser${n}`]],
    );
  }
  await pool.query(
    "insert into public.venue_members (venue_id, user_id, role) values ($1, $2, 'accounting')",
    [ids.venue1, ids.accountant],
  );
  const { rows } = await pool.query(
    "insert into public.venues (org_number, name) values ('987654321', 'Uverifisert lokale') returning id",
  );
  ids.unverifiedVenue = rows[0].id;
  await pool.query(
    "insert into public.venue_members (venue_id, user_id, role) values ($1, $2, 'owner')",
    [ids.unverifiedVenue, ids.unverifiedUser],
  );
  return ids;
}

/** Gjesten legger inn en forespørsel med ett må-krav og ett ønske. */
export async function createRequest(db, guestId, overrides = {}) {
  return db.asUser(guestId, async (c) => {
    const { rows } = await c.query(
      `insert into public.requests
         (guest_id, event_type, date_from, date_to, guest_count, areas, budget_nok, budget_indicative)
       values ($1, 'birthday', current_date + 30, current_date + 30, 100, '{grunerlokka}', $2, $3)
       returning id`,
      [guestId, overrides.budgetNok ?? 16200, overrides.indicative ?? false],
    );
    const requestId = rows[0].id;
    const must = await c.query(
      `insert into public.request_criteria (request_id, kind, fixed_key, importance)
       values ($1, 'fixed', 'byob', 'must') returning id`,
      [requestId],
    );
    const wish = await c.query(
      `insert into public.request_criteria (request_id, kind, custom_text, importance)
       values ($1, 'custom', 'Plass til liveband', 'wish') returning id`,
      [requestId],
    );
    return { requestId, mustId: must.rows[0].id, wishId: wish.rows[0].id };
  });
}

export function goodAnswers(req) {
  return JSON.stringify([
    { criterion_id: req.mustId, value: "meets" },
    { criterion_id: req.wishId, value: "meets_with_reservation", comment: "Bare akustisk etter kl. 23" },
  ]);
}

export async function submitOffer(db, userId, venueId, req, price = 15000, answers = goodAnswers(req)) {
  return db.asUser(userId, async (c) => {
    const { rows } = await c.query("select public.submit_offer($1, $2, $3, $4, $5::jsonb) as id", [
      req.requestId,
      venueId,
      price,
      "Leie og enkel servering",
      answers,
    ]);
    return rows[0].id;
  });
}
