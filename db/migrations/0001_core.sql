-- Lokalbud: kjerneskjema med radnivåsikkerhet.
--
-- Prinsipper (se docs/SECURITY.md):
-- * Ingen tabell er åpen uten en eksplisitt policy. RLS er slått på for alle.
-- * Kontaktinformasjon om gjester ligger bare i profiles, som lokaler aldri kan lese.
-- * Tilbud, tilbudsversjoner, svar, faktureringshendelser og revisjonslogg
--   kan ikke endres eller slettes etter at de er skrevet.
-- * Alt som påvirker penger eller tilbudsplasser skjer i funksjoner på serveren
--   (security definer), aldri ved direkte skriving fra klienten.

-- ---------------------------------------------------------------------------
-- Typer
-- ---------------------------------------------------------------------------

create type public.venue_role as enum ('owner', 'booking', 'staff', 'accounting');
create type public.importance as enum ('must', 'wish');
create type public.answer_value as enum ('meets', 'meets_with_reservation', 'does_not_meet');
create type public.request_status as enum ('open', 'booked', 'closed', 'withdrawn');
create type public.offer_status as enum ('active', 'withdrawn', 'accepted', 'declined');

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  phone text check (phone ~ '^\+47[49][0-9]{7}$'),
  phone_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  org_number text not null unique check (org_number ~ '^[0-9]{9}$'),
  name text not null check (char_length(name) between 2 and 120),
  -- Satt når organisasjonsnummer og representasjonsrett er kontrollert.
  verified_at timestamptz,
  free_intro_offers_used integer not null default 0 check (free_intro_offers_used between 0 and 3),
  created_at timestamptz not null default now()
);

create table public.venue_members (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.venue_role not null,
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (event_type in (
    'birthday', 'anniversary', 'wedding', 'confirmation', 'company',
    'christmas', 'memorial', 'association', 'other')),
  date_from date not null,
  date_to date not null,
  start_time time,
  end_time time,
  guest_count integer not null check (guest_count between 5 and 1000),
  areas text[] not null check (cardinality(areas) >= 1),
  budget_nok integer not null check (budget_nok between 1000 and 2000000),
  budget_indicative boolean not null default false,
  marked_urgent boolean not null default false,
  description text check (char_length(description) <= 1000),
  status public.request_status not null default 'open',
  round integer not null default 1 check (round >= 1),
  created_at timestamptz not null default now(),
  check (date_to >= date_from and date_to - date_from <= 60)
);

create table public.request_criteria (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  kind text not null check (kind in ('fixed', 'custom')),
  fixed_key text,
  custom_text text,
  importance public.importance not null,
  check (
    (kind = 'fixed' and fixed_key is not null and custom_text is null)
    or (kind = 'custom' and fixed_key is null
        and char_length(custom_text) between 3 and 200)
  )
);
create index on public.request_criteria (request_id);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  round integer not null,
  status public.offer_status not null default 'active',
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (request_id, venue_id, round)
);
create index on public.offers (request_id, round);

create table public.offer_versions (
  offer_id uuid not null references public.offers (id) on delete cascade,
  version integer not null check (version >= 1),
  total_price_nok integer not null check (total_price_nok between 1 and 10000000),
  conditions text not null default '' check (char_length(conditions) <= 2000),
  -- SHA-256 av versjonens innhold, slik at en akseptert versjon kan bevises uendret.
  content_hash bytea not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (offer_id, version)
);

create table public.offer_answers (
  offer_id uuid not null,
  version integer not null,
  criterion_id uuid not null references public.request_criteria (id) on delete cascade,
  value public.answer_value not null,
  comment text check (char_length(comment) <= 500),
  primary key (offer_id, version, criterion_id),
  foreign key (offer_id, version) references public.offer_versions (offer_id, version) on delete cascade
);

-- Én faktureringshendelse per tilbud, uansett hvor mange ganger det åpnes eller endres.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers (id),
  venue_id uuid not null references public.venues (id),
  fee_nok integer not null check (fee_nok between 0 and 499),
  free_intro boolean not null,
  opened_by uuid not null references auth.users (id),
  opened_at timestamptz not null default now()
);
create index on public.billing_events (venue_id, opened_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Uforanderlige tabeller
-- ---------------------------------------------------------------------------

create function public.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception 'Raden i % kan ikke endres eller slettes', tg_table_name
    using errcode = 'insufficient_privilege';
end $$;

create trigger offer_versions_immutable before update or delete on public.offer_versions
  for each row execute function public.forbid_change();
create trigger offer_answers_immutable before update or delete on public.offer_answers
  for each row execute function public.forbid_change();
create trigger billing_events_immutable before update or delete on public.billing_events
  for each row execute function public.forbid_change();
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------------
-- Hjelpefunksjoner
-- ---------------------------------------------------------------------------

create function public.is_venue_member(p_venue_id uuid, p_roles public.venue_role[] default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.venue_members m
    where m.venue_id = p_venue_id
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any (p_roles))
  )
$$;

-- Er innlogget bruker medlem av minst ett verifisert lokale?
create function public.is_member_of_verified_venue()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.venue_members m
    join public.venues v on v.id = m.venue_id
    where m.user_id = auth.uid() and v.verified_at is not null
  )
$$;

create function public.owns_request(p_request_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.requests r where r.id = p_request_id and r.guest_id = auth.uid()
  )
$$;

create function public.is_open_request(p_request_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.requests r where r.id = p_request_id and r.status = 'open'
  )
$$;

-- Samme formel som packages/core/src/pricing.ts: 0,75 %, halve kroner opp, 19–499 kr.
create function public.offer_fee_nok(p_basis_nok integer)
returns integer
language sql immutable
as $$
  select least(499, greatest(19, (p_basis_nok::bigint * 75 + 5000) / 10000))::integer
$$;

-- ---------------------------------------------------------------------------
-- Radnivåsikkerhet
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.venue_members enable row level security;
alter table public.requests enable row level security;
alter table public.request_criteria enable row level security;
alter table public.offers enable row level security;
alter table public.offer_versions enable row level security;
alter table public.offer_answers enable row level security;
alter table public.billing_events enable row level security;
alter table public.audit_log enable row level security;

-- Profiler: bare sin egen. Lokaler kan aldri lese gjestenes kontaktinformasjon herfra.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());

-- Lokaler: medlemmer ser sitt eget lokale. Gjester ser lokaler som har gitt dem tilbud.
create policy venues_select_member on public.venues
  for select to authenticated using (public.is_venue_member(id));
create policy venues_select_offering on public.venues
  for select to authenticated using (
    exists (
      select 1 from public.offers o
      join public.requests r on r.id = o.request_id
      where o.venue_id = venues.id and r.guest_id = auth.uid()
    )
  );

create policy venue_members_select on public.venue_members
  for select to authenticated using (public.is_venue_member(venue_id));

-- Forespørsler: gjesten ser sine egne direkte. Lokaler leser åpne forespørsler
-- bare gjennom open_requests_for_venues(), som ikke gir ut gjestens id.
create policy requests_select_own on public.requests
  for select to authenticated using (guest_id = auth.uid());
create policy requests_insert_own on public.requests
  for insert to authenticated with check (
    guest_id = auth.uid() and status = 'open' and round = 1
  );

create policy request_criteria_select on public.request_criteria
  for select to authenticated using (
    public.owns_request(request_id)
    or (public.is_member_of_verified_venue() and public.is_open_request(request_id))
  );
create policy request_criteria_insert_own on public.request_criteria
  for insert to authenticated with check (public.owns_request(request_id));

-- Tilbud: lokalets medlemmer og gjesten som eier forespørselen.
create policy offers_select on public.offers
  for select to authenticated using (
    public.is_venue_member(venue_id) or public.owns_request(request_id)
  );
create policy offer_versions_select on public.offer_versions
  for select to authenticated using (
    exists (select 1 from public.offers o where o.id = offer_id)
  );
create policy offer_answers_select on public.offer_answers
  for select to authenticated using (
    exists (select 1 from public.offers o where o.id = offer_id)
  );

-- Fakturagrunnlag: bare eier og regnskap i lokalet.
create policy billing_events_select on public.billing_events
  for select to authenticated using (
    public.is_venue_member(venue_id, array['owner', 'accounting']::public.venue_role[])
  );

-- audit_log har ingen policy: ingen vanlige brukere kan lese eller skrive den direkte.

-- ---------------------------------------------------------------------------
-- Rettigheter. Anonyme brukere får ingenting.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant select on public.venues, public.venue_members to authenticated;
grant select, insert on public.requests, public.request_criteria to authenticated;
grant select on public.offers, public.offer_versions, public.offer_answers to authenticated;
grant select on public.billing_events to authenticated;

-- Profiler: brukeren kan bare endre visningsnavnet sitt. Telefon og verifisering
-- settes av serveren etter SMS-bekreftelse.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
