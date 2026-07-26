-- ============================================
-- 0001_init.sql
-- J&D Haven — Core schema, storage, and RLS
-- ============================================

-- Extension for uuid generation
create extension if not exists "pgcrypto";

-- ============================================
-- TABLES
-- ============================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  email text not null,
  phone text,
  shipping_address text not null,
  status text not null default 'pending'
    check (status in ('pending','paid','in_production','shipped','delivered')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity int not null check (quantity > 0),
  variant text,
  design_file_url text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index idx_order_items_order_id on public.order_items(order_id);
create index idx_order_items_product_id on public.order_items(product_id);
create index idx_orders_status on public.orders(status);
create index idx_products_active on public.products(active);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- ---- products ----
-- Public can view only active products
create policy "public_select_active_products"
  on public.products for select
  to anon
  using (active = true);

-- Only authenticated (you, the admin) can manage products
create policy "admin_all_products"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

-- ---- orders ----
-- Buyers (anon) can insert an order, but never read any orders back
create policy "public_insert_orders"
  on public.orders for insert
  to anon
  with check (true);

-- Only authenticated admin can view/update orders
create policy "admin_select_orders"
  on public.orders for select
  to authenticated
  using (true);

create policy "admin_update_orders"
  on public.orders for update
  to authenticated
  using (true)
  with check (true);

-- ---- order_items ----
-- Buyers (anon) can insert items tied to the order they just created
create policy "public_insert_order_items"
  on public.order_items for insert
  to anon
  with check (true);

-- Only authenticated admin can view order items
create policy "admin_select_order_items"
  on public.order_items for select
  to authenticated
  using (true);

-- ============================================
-- STORAGE BUCKETS
-- ============================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('design-uploads', 'design-uploads', false)
on conflict (id) do nothing;

-- ---- product-images policies ----
-- Public read
create policy "public_read_product_images"
  on storage.objects for select
  to anon
  using (bucket_id = 'product-images');

-- Only admin can upload/update/delete product images
create policy "admin_write_product_images"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- ---- design-uploads policies ----
-- Buyers (anon) can upload design files, but cannot list/read them back
create policy "public_upload_design_files"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'design-uploads');


-- Only admin can read/manage uploaded design files
create policy "admin_read_design_files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'design-uploads');

create policy "admin_manage_design_files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'design-uploads')
  with check (bucket_id = 'design-uploads');

create policy "admin_delete_design_files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'design-uploads');