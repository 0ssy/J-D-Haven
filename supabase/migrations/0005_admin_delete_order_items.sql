drop policy if exists admin_delete_order_items on public.order_items;
create policy admin_delete_order_items
  on public.order_items for delete
  to authenticated
  using (true);
