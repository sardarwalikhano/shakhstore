-- SHAKH STORE / M13: Align captain delivery split with the approved 80/20 policy.
-- Additive only: do not rewrite migration 0010. Existing accrued rows retain
-- their snapshotted rate; only the active default setting is changed.

begin;

alter table public.captain_commission_settings
  alter column commission_rate_bps set default 8000;

update public.captain_commission_settings
set commission_rate_bps = 8000,
    updated_at = now()
where id = 1
  and commission_rate_bps = 2000;

comment on column public.captain_commission_settings.commission_rate_bps is
  'Captain share of delivery fee in basis points; 8000 = 80% captain / 20% platform.';

commit;
