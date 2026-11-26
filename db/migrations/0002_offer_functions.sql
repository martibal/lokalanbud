-- Funksjoner som endrer tilbud, tilbudsplasser og fakturagrunnlag.
-- Alle kjører på serveren med faste regler, uansett hva klienten sender.

-- ---------------------------------------------------------------------------
-- Åpne forespørsler for lokaler, uten gjestens id eller kontaktinformasjon
-- ---------------------------------------------------------------------------

create function public.open_requests_for_venues()
returns table (
  id uuid,
  event_type text,
  date_from date,
  date_to date,
  start_time time,
  end_time time,
  guest_count integer,
  areas text[],
  budget_nok integer,
  budget_indicative boolean,
  urgent boolean,
  description text,
  round integer,
  active_offers integer,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.event_type, r.date_from, r.date_to, r.start_time, r.end_time,
         r.guest_count, r.areas, r.budget_nok, r.budget_indicative,
         r.marked_urgent or (r.date_from - current_date between 0 and 14) as urgent,
         r.description, r.round,
         (select count(*)::integer from public.offers o
           where o.request_id = r.id and o.round = r.round and o.status = 'active'),
         r.created_at
  from public.requests r
  where r.status = 'open'
    and r.date_to >= current_date
    and public.is_member_of_verified_venue()
  order by urgent desc, r.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- Felles kontroll av svar på krav (samme regel som packages/core/src/criteria.ts)
-- ---------------------------------------------------------------------------

-- p_answers: [{"criterion_id": "...", "value": "meets", "comment": "..."}]
create function public.check_offer_answers(p_request_id uuid, p_answers jsonb)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_criterion record;
  v_answer jsonb;
  v_value text;
  v_comment text;
  v_count integer;
begin
  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Svarene må være en liste' using errcode = 'check_violation';
  end if;

  -- Ingen ukjente eller doble svar.
  select count(*) into v_count
  from jsonb_array_elements(p_answers) a
  where not exists (
    select 1 from public.request_criteria c
    where c.request_id = p_request_id and c.id::text = a ->> 'criterion_id'
  );
  if v_count > 0 then
    raise exception 'Svar på ukjent krav' using errcode = 'check_violation';
  end if;

  select count(*) - count(distinct a ->> 'criterion_id') into v_count
  from jsonb_array_elements(p_answers) a;
  if v_count > 0 then
    raise exception 'Samme krav er besvart flere ganger' using errcode = 'check_violation';
  end if;

  for v_criterion in
    select c.id, c.importance from public.request_criteria c where c.request_id = p_request_id
  loop
    select a into v_answer from jsonb_array_elements(p_answers) a
    where a ->> 'criterion_id' = v_criterion.id::text;

    if v_answer is null then
      raise exception 'Alle krav må besvares' using errcode = 'check_violation';
    end if;

    v_value := v_answer ->> 'value';
    v_comment := btrim(coalesce(v_answer ->> 'comment', ''));

    if v_value not in ('meets', 'meets_with_reservation', 'does_not_meet') then
      raise exception 'Ugyldig svar' using errcode = 'check_violation';
    end if;
    if v_criterion.importance = 'must' and v_value <> 'meets' then
      raise exception 'Et må-krav er ikke oppfylt. Svar «Passer ikke» i stedet'
        using errcode = 'check_violation';
    end if;
    if v_value <> 'meets' and char_length(v_comment) < 5 then
      raise exception 'Avvik må forklares' using errcode = 'check_violation';
    end if;
    if char_length(v_comment) > 500 then
      raise exception 'Kommentaren er for lang' using errcode = 'check_violation';
    end if;
  end loop;
end $$;

-- Lagrer én tilbudsversjon med svar og kontrollsum.
create function public.write_offer_version(
  p_offer_id uuid, p_version integer, p_total_price_nok integer,
  p_conditions text, p_answers jsonb
) returns bytea
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash bytea;
begin
  if p_total_price_nok is null or p_total_price_nok < 1 or p_total_price_nok > 10000000 then
    raise exception 'Ugyldig totalpris' using errcode = 'check_violation';
  end if;

  -- Kontrollsummen dekker pris, vilkår og alle svar i fast rekkefølge.
  v_hash := sha256(convert_to(jsonb_build_object(
    'offer_id', p_offer_id,
    'version', p_version,
    'total_price_nok', p_total_price_nok,
    'conditions', coalesce(p_conditions, ''),
    'answers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'criterion_id', a ->> 'criterion_id',
        'value', a ->> 'value',
        'comment', btrim(coalesce(a ->> 'comment', ''))
      ) order by a ->> 'criterion_id'), '[]'::jsonb)
      from jsonb_array_elements(p_answers) a
    )
  )::text, 'UTF8'));

  insert into public.offer_versions (offer_id, version, total_price_nok, conditions, content_hash, created_by)
  values (p_offer_id, p_version, p_total_price_nok, coalesce(p_conditions, ''), v_hash, auth.uid());

  insert into public.offer_answers (offer_id, version, criterion_id, value, comment)
  select p_offer_id, p_version, (a ->> 'criterion_id')::uuid,
         (a ->> 'value')::public.answer_value,
         nullif(btrim(coalesce(a ->> 'comment', '')), '')
  from jsonb_array_elements(p_answers) a;

  return v_hash;
end $$;

-- ---------------------------------------------------------------------------
-- Send tilbud. Den siste tilbudsplassen avgjøres i én transaksjon.
-- ---------------------------------------------------------------------------

create function public.submit_offer(
  p_request_id uuid, p_venue_id uuid, p_total_price_nok integer,
  p_conditions text, p_answers jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.requests;
  v_active integer;
  v_offer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Ikke innlogget' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_venue_member(p_venue_id, array['owner', 'booking', 'staff']::public.venue_role[]) then
    raise exception 'Ingen tilgang til lokalet' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.venues v where v.id = p_venue_id and v.verified_at is not null) then
    raise exception 'Lokalet er ikke verifisert' using errcode = 'insufficient_privilege';
  end if;

  -- Låser forespørselen, slik at samtidige tilbud telles riktig.
  select * into v_request from public.requests r where r.id = p_request_id for update;
  if not found or v_request.status <> 'open' or v_request.date_to < current_date then
    raise exception 'Forespørselen er ikke åpen' using errcode = 'check_violation';
  end if;

  perform public.check_offer_answers(p_request_id, p_answers);

  select count(*) into v_active from public.offers o
  where o.request_id = p_request_id and o.round = v_request.round and o.status = 'active';
  if v_active >= 3 then
    raise exception 'Alle tilbudsplassene er tatt' using errcode = 'check_violation';
  end if;

  insert into public.offers (request_id, venue_id, round)
  values (p_request_id, p_venue_id, v_request.round)
  returning id into v_offer_id;

  perform public.write_offer_version(v_offer_id, 1, p_total_price_nok, p_conditions, p_answers);

  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (auth.uid(), 'offer.submitted', 'offer', v_offer_id,
          jsonb_build_object('request_id', p_request_id, 'venue_id', p_venue_id,
                             'total_price_nok', p_total_price_nok));
  return v_offer_id;
exception
  when unique_violation then
    raise exception 'Lokalet har allerede sendt tilbud i denne runden' using errcode = 'check_violation';
end $$;

-- ---------------------------------------------------------------------------
-- Endre tilbud: ny versjon, ingen ny fakturering.
-- ---------------------------------------------------------------------------

create function public.revise_offer(
  p_offer_id uuid, p_total_price_nok integer, p_conditions text, p_answers jsonb
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_offer public.offers;
  v_version integer;
begin
  select * into v_offer from public.offers o where o.id = p_offer_id for update;
  if not found
     or not public.is_venue_member(v_offer.venue_id, array['owner', 'booking', 'staff']::public.venue_role[]) then
    raise exception 'Ingen tilgang til tilbudet' using errcode = 'insufficient_privilege';
  end if;
  if v_offer.status <> 'active' then
    raise exception 'Tilbudet kan ikke endres' using errcode = 'check_violation';
  end if;

  perform public.check_offer_answers(v_offer.request_id, p_answers);

  v_version := v_offer.current_version + 1;
  perform public.write_offer_version(p_offer_id, v_version, p_total_price_nok, p_conditions, p_answers);
  update public.offers set current_version = v_version where id = p_offer_id;

  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (auth.uid(), 'offer.revised', 'offer', p_offer_id,
          jsonb_build_object('version', v_version, 'total_price_nok', p_total_price_nok));
  return v_version;
end $$;

-- ---------------------------------------------------------------------------
-- Gjesten åpner et tilbud. Gir høyst én faktureringshendelse per tilbud.
-- Kalles bare etter at gjesten selv har trykket på tilbudet, aldri ved
-- innlasting av siden eller forhåndsvisning av lenker.
-- ---------------------------------------------------------------------------

create function public.open_offer(p_offer_id uuid)
returns table (fee_nok integer, free_intro boolean, first_open boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_offer public.offers;
  v_request public.requests;
  v_price integer;
  v_used integer;
  v_fee integer;
  v_free boolean;
  v_existing public.billing_events;
begin
  select * into v_offer from public.offers o where o.id = p_offer_id;
  if not found then
    raise exception 'Fant ikke tilbudet' using errcode = 'no_data_found';
  end if;
  select * into v_request from public.requests r where r.id = v_offer.request_id;
  if v_request.guest_id is distinct from auth.uid() then
    raise exception 'Ingen tilgang til tilbudet' using errcode = 'insufficient_privilege';
  end if;

  -- Lås lokalet, slik at gratistilbudene telles riktig ved samtidige åpninger.
  select v.free_intro_offers_used into v_used from public.venues v
  where v.id = v_offer.venue_id for update;

  select * into v_existing from public.billing_events b where b.offer_id = p_offer_id;
  if found then
    return query select v_existing.fee_nok, v_existing.free_intro, false;
    return;
  end if;

  select ov.total_price_nok into v_price from public.offer_versions ov
  where ov.offer_id = p_offer_id and ov.version = v_offer.current_version;

  v_free := v_used < 3;
  v_fee := case when v_free then 0
           else public.offer_fee_nok(case when v_request.budget_indicative then v_price
                                          else v_request.budget_nok end) end;

  insert into public.billing_events (offer_id, venue_id, fee_nok, free_intro, opened_by)
  values (p_offer_id, v_offer.venue_id, v_fee, v_free, auth.uid());

  if v_free then
    update public.venues set free_intro_offers_used = free_intro_offers_used + 1
    where id = v_offer.venue_id;
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (auth.uid(), 'offer.opened', 'offer', p_offer_id,
          jsonb_build_object('fee_nok', v_fee, 'free_intro', v_free));

  return query select v_fee, v_free, true;
end $$;

-- Bare innloggede brukere kan kalle funksjonene. Hjelpefunksjonene er interne.
grant execute on function public.open_requests_for_venues() to authenticated;
grant execute on function public.submit_offer(uuid, uuid, integer, text, jsonb) to authenticated;
grant execute on function public.revise_offer(uuid, integer, text, jsonb) to authenticated;
grant execute on function public.open_offer(uuid) to authenticated;
grant execute on function public.is_venue_member(uuid, public.venue_role[]) to authenticated;
grant execute on function public.is_member_of_verified_venue() to authenticated;
grant execute on function public.owns_request(uuid) to authenticated;
grant execute on function public.is_open_request(uuid) to authenticated;
