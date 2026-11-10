-- SHAKH STORE / M00
-- Foundation only. No business data, demo records, or mock accounts are inserted.
-- This migration is additive and is designed to run once on a new project.

begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on schema private is
  'Internal SHAKH STORE objects. Application users must not receive direct access.';

commit;
