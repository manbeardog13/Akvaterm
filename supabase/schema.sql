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
-- The app works fully WITHOUT this schema (offline/demo mode, localStorage);
-- running it turns on shared favorites/designs, quotes and the Terma product
-- search executed by the `terma` Edge Function.
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
create table if not exists designs (
  id          uuid primary key default gen_random_uuid(),
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
create table if not exists quotes (
  id          uuid primary key default gen_random_uuid(),
  public_code text not null unique
                default ('AKV-' || to_char(current_date, 'YYYY') || '-' ||
                         lpad(nextval('quote_code_seq')::text, 4, '0')),
  user_id     uuid not null default auth.uid(),
  design_id   uuid references designs(id) on delete set null,
  items       jsonb not null default '[]'::jsonb,      -- [{productId, qty, areaM2, priceEur}]
  total_eur   numeric(12,2),
  status      text not null default 'draft',           -- draft | sent | answered | closed
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

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

-- New signups get a profile automatically; the very first user is the admin.
create or replace function akv_handle_new_user() returns trigger as $$
declare first_user boolean;
begin
  select count(*) = 0 into first_user from public.profiles;
  -- Never let a profile-write problem abort the auth-user insert (it would
  -- roll back the signup itself — ASC's "Database error saving new user" bug).
  begin
    insert into public.profiles (id, email, full_name, role)
      values (
        new.id,
        new.email,
        nullif(trim(coalesce(new.raw_user_meta_data->>'full_name',
                             new.raw_user_meta_data->>'name', '')), ''),
        case when first_user then 'admin' else 'customer' end)
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
do $$
begin
  insert into public.profiles (id, email, role)
    select id, email, 'admin' from auth.users on conflict (id) do nothing;
exception when others then raise notice 'profiles backfill skipped: %', sqlerrm;
end $$;

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
alter table products     enable row level security;
alter table favorites    enable row level security;
alter table designs      enable row level security;
alter table quotes       enable row level security;
alter table profiles     enable row level security;
alter table audit_events enable row level security;

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
create policy "quotes_owner_insert" on quotes for insert to authenticated
  with check (user_id = auth.uid());
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
-- REALTIME  (catalog and quote changes appear on every device within a second)
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

-- Done. Next steps (docs/SETUP.md): set the GEMINI_API_KEY secret (service-
-- account auth key — standard keys stop working September 2026), deploy the
-- `terma` Edge Function, then fill js/config.js.
