-- Allow storefront checkout when a browser has an authenticated Supabase session
-- (e.g. admin previously logged in on admin.html in the same origin).

drop policy if exists authenticated_insert_orders on public.orders;
create policy authenticated_insert_orders
  on public.orders for insert
  to authenticated
  with check (true);

drop policy if exists authenticated_insert_order_items on public.order_items;
create policy authenticated_insert_order_items
  on public.order_items for insert
  to authenticated
  with check (true);

drop policy if exists authenticated_upload_design_files on storage.objects;
create policy authenticated_upload_design_files
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'design-uploads');
