alter table public.products
  add column if not exists in_stock boolean not null default true,
  add column if not exists lead_time_days int;

alter table public.products
  drop constraint if exists products_lead_time_days_check;

alter table public.products
  add constraint products_lead_time_days_check
  check (lead_time_days is null or lead_time_days > 0);
