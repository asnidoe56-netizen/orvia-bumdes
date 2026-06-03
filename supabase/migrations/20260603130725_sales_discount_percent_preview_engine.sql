create or replace function public.preview_sales_line_discount_percent(
  p_item_id uuid,
  p_quantity numeric,
  p_discount_percent numeric default 0,
  p_tax_amount numeric default 0,
  p_invoice_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_price numeric(18,2);
  v_unit_cost numeric(18,2);
  v_gross_amount numeric(18,2);
  v_discount_amount numeric(18,2);
  v_line_total numeric(18,2);
  v_gross_profit numeric(18,2);
begin
  if p_item_id is null then
    raise exception 'Barang wajib dipilih.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Jumlah harus lebih dari 0.';
  end if;

  if p_discount_percent is null then
    p_discount_percent := 0;
  end if;

  if p_tax_amount is null then
    p_tax_amount := 0;
  end if;

  if p_discount_percent < 0 or p_discount_percent > 100 then
    raise exception 'Diskon persen harus berada di antara 0 sampai 100.';
  end if;

  if p_tax_amount < 0 then
    raise exception 'Pajak tidak boleh negatif.';
  end if;

  v_unit_price := public.get_active_item_sales_price(
    p_item_id,
    'retail',
    coalesce(p_invoice_date, current_date)
  );

  if v_unit_price is null or v_unit_price <= 0 then
    raise exception 'Harga jual aktif barang belum tersedia atau masih 0.';
  end if;

  v_unit_cost := public.get_inventory_unit_cost(p_item_id);

  if v_unit_cost is null or v_unit_cost <= 0 then
    raise exception 'Harga pokok barang belum tersedia atau tidak valid.';
  end if;

  v_gross_amount := round(p_quantity * v_unit_price, 2);
  v_discount_amount := round(v_gross_amount * (p_discount_percent / 100), 2);
  v_line_total := round(v_gross_amount - v_discount_amount + p_tax_amount, 2);
  v_gross_profit := round(v_line_total - (p_quantity * v_unit_cost), 2);

  return jsonb_build_object(
    'unit_price', v_unit_price,
    'unit_cost', v_unit_cost,
    'quantity', p_quantity,
    'discount_percent', p_discount_percent,
    'discount_amount', v_discount_amount,
    'tax_amount', p_tax_amount,
    'gross_amount', v_gross_amount,
    'line_total', v_line_total,
    'gross_profit', v_gross_profit
  );
end;
$$;

grant execute on function public.preview_sales_line_discount_percent(
  uuid,
  numeric,
  numeric,
  numeric,
  date
) to authenticated;

notify pgrst, 'reload schema';