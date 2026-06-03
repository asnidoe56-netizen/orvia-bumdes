-- Grant read access for inventory item price history.
-- RLS policy tetap menjadi pengaman scope tenant/unit.
grant select on table public.inventory_item_prices to authenticated;
grant select on table public.v_inventory_item_active_prices to authenticated;
grant select on table public.v_inventory_item_stock_summary to authenticated;

notify pgrst, 'reload schema';