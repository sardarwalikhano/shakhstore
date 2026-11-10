-- SHAKH STORE / M03: merchant store profiles and admin onboarding review.
-- Additive migration. No existing wallet/auth migrations are modified.

begin;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  store_type text not null check (store_type in ('restaurant','supermarket','produce_vendor','meat_seafood_vendor')),
  description text,
  phone text,
  address text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_review_state check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index if not exists stores_one_active_application_per_owner
  on public.stores(owner_id)
  where status in ('pending','approved');

create index if not exists stores_status_created_idx
  on public.stores(status, created_at desc);

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

alter table public.stores enable row level security;

drop policy if exists stores_read_approved on public.stores;
create policy stores_read_approved
on public.stores for select to anon, authenticated
using (status = 'approved');

drop policy if exists stores_read_own on public.stores;
create policy stores_read_own
on public.stores for select to authenticated
using (owner_id = (select auth.uid()));

revoke all on public.stores from anon, authenticated;
grant select on public.stores to anon, authenticated;

comment on table public.stores is
  'Merchant store onboarding records. Mutations are performed only by trusted server-side APIs.';
commit;
