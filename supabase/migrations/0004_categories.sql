-- ============================================
-- 0004_categories.sql
-- Structured categories + product category_id
-- ============================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

insert into public.categories (name, slug) values
  ('Clothing', 'clothing'),
  ('Utensils', 'utensils'),
  ('Stationery', 'stationery')
on conflict (slug) do nothing;

alter table public.products
  add column if not exists category_id uuid references public.categories(id);

update public.products p
set category_id = c.id
from public.categories c
where p.category_id is null
  and lower(coalesce(p.category, '')) in (c.slug, lower(c.name));

alter table public.categories enable row level security;

drop policy if exists public_select_categories on public.categories;
create policy public_select_categories
  on public.categories for select
  to anon
  using (true);

drop policy if exists admin_all_categories on public.categories;
create policy admin_all_categories
  on public.categories for all
  to authenticated
  using (true)
  with check (true);
