-- ============================================================================
-- Akvaterm Platform — database schema for Supabase (PostgreSQL)
-- ----------------------------------------------------------------------------
-- Run this ONCE (and it is safe to re-run to upgrade):
--   Supabase dashboard  ->  SQL Editor  ->  New query  ->  paste all  ->  Run
--
-- Ports the ASC scaffolding pattern: profiles + handle_new_user signup trigger,
-- role-tier RLS, an append-only audit log, soft deletes + purge, realtime
-- publication, and a storage bucket — plus the Akvaterm domain tables:
-- products (public-read demo catalog), favorites, designs (saved room designs)
-- and quotes (public_code sequence, AKV-2026-0001). Every block is idempotent.
--
-- WHAT RUNNING THIS ACTUALLY TURNS ON — be precise, the app is honest about it:
--   • the Terma Edge Function's live catalog search (needs `products` SEEDED —
--     run supabase/seed_products.sql right after this file), and
--   • the Terma Edge Function's metering: terma_usage + akv_terma_consume() and
--     terma_conversations. WITHOUT them the function refuses every request,
--     by design — an unmetered Gemini proxy is a billing incident.
-- What it does NOT turn on yet: shared favorites/designs across devices, and
-- quotes. Those tables and their owner-only RLS are ready, but the client ships
-- no sign-in UI, so every mirrored write from js/db.js runs with an anon
-- session and is correctly filtered to zero rows. localStorage stays the store.
-- They become real features the day an auth flow lands — not before.
--
-- The app works fully WITHOUT this schema (offline/demo mode, localStorage).
-- ============================================================================

create sequence if not exists quote_code_seq;

-- ----------------------------------------------------------------------------
-- Domain tables
-- ----------------------------------------------------------------------------

-- Product ids are text on purpose: they match data/catalog.seed.json ids
-- (e.g. 'ker-001') so the client cache, the seed file and this table agree.
create table if not exists products (
  id               text primary key,
  category         text not null check (category in
                     ('keramika','sanitarije','armature','grijanje','klima','namjestaj')),
  name             text not null,
  brand            text,
  texture_kind     text not null default 'ceramic',   -- matches js/texture.js fillStyles keys
  base_color_hex   text not null default '#cccccc',
  accent_color_hex text,
  tile_size_mm     int[],                             -- [w,h]; null for equipment
  glossy           boolean not null default false,
  price_m2         numeric(10,2),                     -- tiles
  price_unit       numeric(10,2),                     -- equipment
  unit             text not null default 'm2' check (unit in ('m2','kom')),
  description      text,
  color_tags       text[] not null default '{}',      -- searched by Terma's search_products
  image_path       text,
  pixels_per_mm    numeric(8,3),
  demo             boolean not null default true,     -- demo catalog until the client supplies data
  deleted_at       timestamptz,                       -- soft delete
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists favorites (
  user_id    uuid not null default auth.uid(),
  product_id text not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- Saved room designs (Stage 1 scenes + Stage 2 3D rooms) — mirrors the Design
-- shape from docs/BUILD_CONTRACTS.md; localStorage stays the offline fallback.
-- id is TEXT, not uuid, for the same reason products.id is: the client mints it
-- (js/domain.js newId('dz') → 'dz-msb1b62r01-5tg3') and a uuid column silently
-- rejected every single mirrored write.
create table if not exists designs (
  id          text primary key,
  user_id     uuid not null default auth.uid(),
  kind        text not null check (kind in ('scene','room3d')),
  ref_id      text not null,                           -- scene id or room preset id
  name        text not null default 'Moj dizajn',
  assignments jsonb not null default '{}'::jsonb,      -- {surfaceId:{productId,pattern,groutColorId,groutWidthMm}}
  room        jsonb,                                   -- {widthM,depthM,heightM,fixtures:[...]}
  saved_at    timestamptz not null default now(),
  deleted_at  timestamptz,                             -- soft delete / recycle bin
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Quote requests with human-friendly public codes (ASC's public_code trick).
-- total_eur is NEVER trusted from the client — akv_quotes_before_write()
-- recomputes it from `items` against `products` (see the trigger below).
create table if not exists quotes (
  id          uuid primary key default gen_random_uuid(),
  public_code text not null unique
                default ('AKV-' || to_char(current_date, 'YYYY') || '-' ||
                         lpad(nextval('quote_code_seq')::text, 4, '0')),
  user_id     uuid not null default auth.uid(),
  design_id   text references designs(id) on delete set null,
  items       jsonb not null default '[]'::jsonb,      -- [{productId, qty, areaM2, priceEur}]
  total_eur   numeric(12,2),
  status      text not null default 'draft'
                check (status in ('draft','sent','answered','closed')),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Upgrade path for projects created against the earlier revision of this file,
-- where designs.id was uuid (and quotes.design_id with it) and `status` carried
-- no domain constraint. Wrapped: a privilege error can never abort the run.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'designs'
                and column_name = 'id' and data_type = 'uuid') then
    alter table quotes  drop constraint if exists quotes_design_id_fkey;
    alter table designs alter column id drop default;
    alter table designs alter column id type text using id::text;
    alter table quotes  alter column design_id type text using design_id::text;
    alter table quotes  add constraint quotes_design_id_fkey
      foreign key (design_id) references designs(id) on delete set null;
    raise notice 'designs.id converted uuid -> text';
  end if;
exception when others then raise notice 'designs.id migration skipped: %', sqlerrm;
end $$;

do $$
begin
  alter table quotes add constraint quotes_status_check
    check (status in ('draft','sent','answered','closed'));
exception
  when duplicate_object then null;
  when others then raise notice 'quotes status constraint skipped: %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_deleted  on products(deleted_at);
create index if not exists idx_products_tags     on products using gin(color_tags);
create index if not exists idx_favorites_user    on favorites(user_id);
create index if not exists idx_designs_user      on designs(user_id);
create index if not exists idx_designs_deleted   on designs(deleted_at);
create index if not exists idx_quotes_user       on quotes(user_id);
create index if not exists idx_quotes_code       on quotes(public_code);

-- ----------------------------------------------------------------------------
-- updated_at freshness
-- ----------------------------------------------------------------------------
create or replace function akv_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated on products;
create trigger trg_products_updated before update on products
  for each row execute function akv_set_updated_at();
drop trigger if exists trg_designs_updated on designs;
create trigger trg_designs_updated before update on designs
  for each row execute function akv_set_updated_at();
drop trigger if exists trg_quotes_updated on quotes;
create trigger trg_quotes_updated before update on quotes
  for each row execute function akv_set_updated_at();

-- ============================================================================
-- ROLES  (admin | staff | customer)
-- One row per auth user. Customers sign up freely (favorites/designs/quotes
-- are theirs alone under RLS); staff/admin manage the catalog.
-- ============================================================================
create table if not exists profiles (
  id         uuid primary key,   -- = auth.users.id (no cross-schema FK, to avoid privilege issues)
  email      text,
  full_name  text,
  role       text not null default 'customer',
  created_at timestamptz not null default now()
);

-- New signups get a profile automatically — ALWAYS as 'customer'.
--
-- Admin is never granted by inference. The previous "first user wins" rule was
-- count-based, so two near-simultaneous signups could both read count = 0, and
-- it made the role depend on signup order rather than on anyone's decision.
-- Promotion is now an explicit act by the operator (see FIRST ADMIN below).
create or replace function akv_handle_new_user() returns trigger as $$
begin
  -- Never let a profile-write problem abort the auth-user insert (it would
  -- roll back the signup itself — ASC's "Database error saving new user" bug).
  begin
    insert into public.profiles (id, email, full_name, role)
      values (
        new.id,
        new.email,
        nullif(trim(coalesce(new.raw_user_meta_data->>'full_name',
                             new.raw_user_meta_data->>'name', '')), ''),
        'customer')
      on conflict (id) do nothing;
  exception when others then
    raise notice 'akv_handle_new_user: profile write skipped: %', sqlerrm;
  end;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Backfill existing users + attach the signup trigger. Both touch auth.users,
-- which some projects restrict — each is wrapped so a privilege error can
-- never abort the whole migration.
--
-- ⚠ THE BACKFILL GRANTS 'customer', NEVER 'admin'. This file advertises itself
-- as safe to re-run, and it also tolerates the two conditions that leave a real
-- customer without a profile row (the signup trigger failing to attach, or
-- signups that happened before the schema was applied). Backfilling those rows
-- as 'admin' — as an earlier revision did — meant a later re-run silently
-- handed catalog write, every customer's quotes and the audit log to whoever
-- had signed up in the meantime. ON CONFLICT DO NOTHING does not protect them:
-- by definition they have no row to conflict with.
do $$
begin
  insert into public.profiles (id, email, role)
    select id, email, 'customer' from auth.users on conflict (id) do nothing;
exception when others then raise notice 'profiles backfill skipped: %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- FIRST ADMIN — a deliberate, separate step you run knowingly, once, with your
-- own email. Nothing in this file grants admin on its own.
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- Check afterwards:  select email, role from public.profiles order by role;
-- Roles are admin | staff | customer; see the RLS section for what each grants.
-- ----------------------------------------------------------------------------

do $$
begin
  execute 'drop trigger if exists trg_akv_new_user on auth.users';
  execute 'create trigger trg_akv_new_user after insert on auth.users for each row execute function akv_handle_new_user()';
exception when others then raise notice 'auth.users signup trigger skipped (grant roles in the profiles table by hand): %', sqlerrm;
end $$;

-- Caller's role. Defaults to least-privilege 'customer' when no profile row
-- exists — a brand-new login can never silently gain catalog-write rights.
create or replace function akv_role() returns text as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'customer');
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function akv_is_staff() returns boolean as $$
  select akv_role() in ('admin','staff');
$$ language sql stable security definer set search_path = public, pg_temp;

-- ============================================================================
-- AUDIT LOG  (append-only — who changed the catalog/quotes, when)
-- ============================================================================
create table if not exists audit_events (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_email text,
  entity_type text not null,          -- products | quotes
  entity_id   text,
  action      text not null,          -- created | updated | deleted | restored | purged | status_changed
  summary     text,
  changes     jsonb not null default '{}'::jsonb
);
create index if not exists idx_audit_entity on audit_events(entity_type, entity_id, at desc);

create or replace function akv_audit() returns trigger as $$
declare
  v_actor uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_action text; v_summary text; v_entity text; v_changes jsonb := '{}'::jsonb;
begin
  if TG_OP = 'INSERT' then
    v_action := 'created';
    v_entity := NEW.id::text;
    v_summary := case TG_TABLE_NAME
      when 'products' then 'Proizvod dodan: ' || NEW.id::text
      when 'quotes'   then 'Upit kreiran'
      else 'Created' end;
  elsif TG_OP = 'DELETE' then
    v_action := 'purged';
    v_entity := OLD.id::text;
    v_summary := 'Trajno obrisano';
  else
    v_entity := NEW.id::text;
    if TG_TABLE_NAME = 'products' then
      if OLD.deleted_at is null and NEW.deleted_at is not null then
        v_action := 'deleted'; v_summary := 'Premješteno u koš';
      elsif OLD.deleted_at is not null and NEW.deleted_at is null then
        v_action := 'restored'; v_summary := 'Vraćeno iz koša';
      else
        v_action := 'updated'; v_summary := 'Proizvod ažuriran';
      end if;
    elsif TG_TABLE_NAME = 'quotes' then
      if OLD.status is distinct from NEW.status then
        v_action := 'status_changed'; v_summary := OLD.status || ' → ' || NEW.status;
        v_changes := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      else
        v_action := 'updated'; v_summary := 'Upit ažuriran';
      end if;
    else
      v_action := 'updated'; v_summary := 'Updated';
    end if;
  end if;

  insert into audit_events (actor, actor_email, entity_type, entity_id, action, summary, changes)
    values (v_actor, v_email, TG_TABLE_NAME, v_entity, v_action, v_summary, v_changes);

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_audit_products on products;
create trigger trg_audit_products after insert or update or delete on products
  for each row execute function akv_audit();
drop trigger if exists trg_audit_quotes on quotes;
create trigger trg_audit_quotes after insert or update or delete on quotes
  for each row execute function akv_audit();

-- ============================================================================
-- QUOTE INTEGRITY  (a customer may ask for a price; they may not set one)
-- ----------------------------------------------------------------------------
-- RLS can only say WHO may insert, not WHAT the row may contain beyond a
-- WITH CHECK expression — and every insert also burns a number from
-- quote_code_seq. This BEFORE trigger does the rest:
--   • total_eur is recomputed from `items` against `products` on insert (and
--     on any update that changes `items`), so a client-supplied total is
--     always overwritten, never trusted;
--   • a per-user hourly ceiling stops a scripted client from exhausting the
--     human-readable AKV-YYYY-NNNN space and flooding the staff queue.
-- NOTE: RLS WITH CHECK is evaluated on the row AFTER before-triggers run, so
-- the insert policy asserts `status = 'draft'` (which nothing here rewrites)
-- and deliberately does NOT assert `total_eur is null`.
-- ============================================================================
create or replace function akv_quotes_before_write() returns trigger as $$
declare
  v_total     numeric(12,2);
  v_recent    int;
  v_recompute boolean := false;
begin
  if TG_OP = 'INSERT' then
    select count(*) into v_recent
      from public.quotes
     where user_id = new.user_id
       and created_at > now() - interval '1 hour';
    if v_recent >= 10 then
      raise exception 'Previše upita u posljednjih sat vremena — pokušajte kasnije.'
        using errcode = '54000';
    end if;
    v_recompute := true;
  -- Separate branch on purpose: SQL's OR does not short-circuit, and OLD is
  -- unassigned during INSERT, so `TG_OP='INSERT' or new.items <> old.items`
  -- would error out on every insert.
  elsif new.items is distinct from old.items then
    v_recompute := true;
  end if;

  if v_recompute then
    begin
      select coalesce(sum(
               case when p.unit = 'm2'
                 then coalesce(p.price_m2, 0)   * coalesce((i->>'areaM2')::numeric, 0)
                 else coalesce(p.price_unit, 0) * coalesce((i->>'qty')::numeric, 1)
               end), 0)
        into v_total
        from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) as i
        join public.products p on p.id = i->>'productId';
    exception when others then
      v_total := null;   -- malformed items: null beats a number we can't stand behind
    end;
    new.total_eur := v_total;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_quotes_guard on quotes;
create trigger trg_quotes_guard before insert or update on quotes
  for each row execute function akv_quotes_before_write();

-- ============================================================================
-- TERMA METERING  (the Edge Function's own bookkeeping — never client-visible)
-- ----------------------------------------------------------------------------
-- supabase/functions/terma/index.ts spends the operator's Gemini budget on
-- every call and its URL is derivable from the public bundle. These two tables
-- are how it refuses to serve a caller it cannot name and count; the function
-- FAILS CLOSED when they are missing. Both have RLS on with NO policies, so
-- anon/authenticated cannot read or write them at all — only the service role
-- (which bypasses RLS) can, and only from inside the function.
-- ============================================================================
create table if not exists terma_usage (
  identity   text not null,          -- 'user:<uuid>' or 'anon:<sha256(ip|origin)>'
  action     text not null,          -- chat | chat:day | vision | …
  bucket     timestamptz not null,   -- start of the fixed window
  used       int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (identity, action, bucket)
);
create index if not exists idx_terma_usage_bucket on terma_usage(bucket);

-- Opaque conversation handles. Gemini interaction ids are shared-namespace
-- secrets — anyone holding one can resume that conversation and have the model
-- recite it — so they never reach the browser. The client gets `handle`; the
-- mapping to the real id lives here, bound to the caller's identity.
create table if not exists terma_conversations (
  handle         uuid primary key default gen_random_uuid(),
  identity       text not null,
  interaction_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_terma_conv_identity on terma_conversations(identity, updated_at desc);

-- Consume one token from a fixed window. Returns
-- {allowed, used, limit, retry_after}; `allowed` false means refuse the call.
create or replace function akv_terma_consume(
  p_identity       text,
  p_action         text,
  p_limit          int,
  p_window_seconds int
) returns jsonb as $$
declare
  v_identity text := left(coalesce(p_identity, ''), 128);
  v_bucket   timestamptz;
  v_used     int;
begin
  if v_identity = '' or coalesce(p_action, '') = ''
     or coalesce(p_limit, 0) < 1 or coalesce(p_window_seconds, 0) < 1 then
    return jsonb_build_object('allowed', false, 'used', 0,
                              'limit', coalesce(p_limit, 0), 'retry_after', 60);
  end if;

  v_bucket := to_timestamp(
    (floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)::double precision);

  insert into terma_usage (identity, action, bucket, used)
    values (v_identity, p_action, v_bucket, 1)
    on conflict (identity, action, bucket)
      do update set used = terma_usage.used + 1, updated_at = now()
    returning used into v_used;

  -- Bounded opportunistic cleanup; no cron needed for a demo-scale project.
  if random() < 0.02 then
    delete from terma_usage        where bucket     < now() - interval '2 days';
    delete from terma_conversations where updated_at < now() - interval '30 days';
  end if;

  return jsonb_build_object(
    'allowed', v_used <= p_limit,
    'used',    v_used,
    'limit',   p_limit,
    'retry_after',
      greatest(1, ceil(extract(epoch from
        (v_bucket + make_interval(secs => p_window_seconds)) - now()))::int)
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Only the service role (i.e. the Edge Function) may meter.
do $$
begin
  revoke all on function akv_terma_consume(text, text, int, int) from public;
  revoke all on function akv_terma_consume(text, text, int, int) from anon, authenticated;
  grant execute on function akv_terma_consume(text, text, int, int) to service_role;
exception when others then raise notice 'akv_terma_consume grants skipped: %', sqlerrm;
end $$;

-- ============================================================================
-- SOFT-DELETE PURGE  (recycle-bin retention — hard-delete after N days)
-- ============================================================================
create or replace function purge_deleted(older_than interval default interval '30 days')
returns int as $$
declare n int := 0; m int;
begin
  with del as (
    delete from designs
    where deleted_at is not null and deleted_at < now() - older_than
    returning 1
  ) select count(*) into m from del;
  n := n + coalesce(m, 0);
  with del as (
    delete from products
    where deleted_at is not null and deleted_at < now() - older_than
    returning 1
  ) select count(*) into m from del;
  n := n + coalesce(m, 0);
  return n;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table products           enable row level security;
alter table favorites          enable row level security;
alter table designs            enable row level security;
alter table quotes             enable row level security;
alter table profiles           enable row level security;
alter table audit_events       enable row level security;
-- No policies are defined for these two on purpose: RLS-on + zero policies =
-- deny for anon and authenticated, reachable only by the service role inside
-- the terma Edge Function.
alter table terma_usage        enable row level security;
alter table terma_conversations enable row level security;

-- Products: PUBLIC read (anon browsing needs no login); staff write.
drop policy if exists "products_public_read" on products;
drop policy if exists "products_staff_read"  on products;
drop policy if exists "products_staff_write" on products;
create policy "products_public_read" on products for select
  using (deleted_at is null);
create policy "products_staff_read" on products for select to authenticated
  using (akv_is_staff());
create policy "products_staff_write" on products for all to authenticated
  using (akv_is_staff()) with check (akv_is_staff());

-- Favorites: strictly owner-only.
drop policy if exists "favorites_owner" on favorites;
create policy "favorites_owner" on favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Designs: strictly owner-only.
drop policy if exists "designs_owner" on designs;
create policy "designs_owner" on designs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Quotes: owners create and read their own; staff read and answer all.
drop policy if exists "quotes_owner_select" on quotes;
drop policy if exists "quotes_owner_insert" on quotes;
drop policy if exists "quotes_staff_select" on quotes;
drop policy if exists "quotes_staff_update" on quotes;
create policy "quotes_owner_select" on quotes for select to authenticated
  using (user_id = auth.uid());
-- Ownership is not enough: the columns a customer may set are pinned too. A
-- quote is always born as a draft; total_eur is written by the trigger above
-- (which is why it is not asserted here — WITH CHECK sees the post-trigger
-- row); status transitions are staff-only through quotes_staff_update.
create policy "quotes_owner_insert" on quotes for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft');
create policy "quotes_staff_select" on quotes for select to authenticated
  using (akv_is_staff());
create policy "quotes_staff_update" on quotes for update to authenticated
  using (akv_is_staff()) with check (akv_is_staff());

-- Profiles: read your own row; admins manage all.
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_admin_write" on profiles;
create policy "profiles_select" on profiles for select to authenticated
  using (id = auth.uid() or akv_role() = 'admin');
create policy "profiles_admin_write" on profiles for all to authenticated
  using (akv_role() = 'admin') with check (akv_role() = 'admin');

-- Audit log: append-only. Staff read; writes happen only through the
-- SECURITY DEFINER trigger, so there are no insert/update policies.
drop policy if exists "audit_select" on audit_events;
create policy "audit_select" on audit_events for select to authenticated
  using (akv_is_staff());

-- ============================================================================
-- REALTIME  (publication enabled for future use — no client subscribes yet)
-- ----------------------------------------------------------------------------
-- Nothing in js/ opens a realtime channel today. Adding the tables to the
-- publication here is cheap and means a future live-catalog or staff-queue
-- view needs no migration; it is not a feature this file switches on.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['products','favorites','designs','quotes','audit_events'] loop
    begin
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    exception when others then raise notice 'realtime add % skipped: %', t, sqlerrm;
    end;
  end loop;
end $$;

-- ============================================================================
-- STORAGE bucket for product images (public read — the catalog is public;
-- staff-only writes). If your project restricts storage DDL, create a PUBLIC
-- bucket named 'product-images' in the dashboard instead.
-- ============================================================================
do $$
begin
  insert into storage.buckets (id, name, public)
    values ('product-images', 'product-images', true)
    on conflict (id) do update set public = true;
  execute 'drop policy if exists "product-images public read" on storage.objects';
  execute 'drop policy if exists "product-images staff write" on storage.objects';
  execute 'drop policy if exists "product-images staff update" on storage.objects';
  execute 'drop policy if exists "product-images staff delete" on storage.objects';
  execute 'create policy "product-images public read" on storage.objects for select using (bucket_id = ''product-images'')';
  execute 'create policy "product-images staff write" on storage.objects for insert to authenticated with check (bucket_id = ''product-images'' and public.akv_is_staff())';
  execute 'create policy "product-images staff update" on storage.objects for update to authenticated using (bucket_id = ''product-images'' and public.akv_is_staff())';
  execute 'create policy "product-images staff delete" on storage.objects for delete to authenticated using (bucket_id = ''product-images'' and public.akv_is_staff())';
exception when others then
  raise notice 'Storage bucket/policies skipped (%). Create a PUBLIC bucket named product-images in the dashboard.', sqlerrm;
end $$;

-- Done. Next steps (docs/SETUP.md):
--   1. run supabase/seed_products.sql so the catalog table is not empty
--      (Terma's search_products returns nothing against an empty table);
--   2. set the GEMINI_API_KEY secret (service-account auth key — standard keys
--      stop working September 2026) and the ALLOWED_ORIGINS secret;
--   3. deploy the `terma` Edge Function;
--   4. fill js/config.js.
-- Optional, only if you want a staff/admin account: run the FIRST ADMIN
-- one-liner above with your own email after signing that account up.
