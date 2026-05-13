-- Monthly Equipment Audit Log
-- Run this in the Supabase SQL editor to enable the monthly audit feature.

create table if not exists monthly_audit_log (
  id                uuid         primary key default gen_random_uuid(),
  personnel_id      integer      not null references personnel(id) on delete cascade,
  audit_month       varchar(7)   not null,  -- format: 'YYYY-MM'  e.g. '2026-05'
  acknowledged_at   timestamptz  not null default now(),
  items_confirmed   integer      not null default 0,
  items_returned    integer      not null default 0,
  had_no_checkouts  boolean      not null default false,
  constraint monthly_audit_log_personnel_month_unique unique (personnel_id, audit_month)
);

alter table monthly_audit_log enable row level security;

create policy "allow all monthly_audit_log"
  on monthly_audit_log for all
  using (true)
  with check (true);
