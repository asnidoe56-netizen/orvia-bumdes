create or replace function public.create_and_post_sales_invoice_with_discount_percent(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_customer_id uuid,
  p_invoice_no text,
  p_invoice_date date,
  p_due_date date default null,
  p_payment_type text default 'cash',
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_item_id uuid;
  v_quantity numeric(18,2);
  v_discount_percent numeric(9,4);
  v_tax_amount numeric(18,2);
  v_unit_price numeric(18,2);
  v_unit_cost numeric(18,2);
  v_gross_amount numeric(18,2);
  v_discount_amount numeric(18,2);
  v_description text;
begin
  if p_tenant_id is null or p_unit_id is null then
    raise exception 'Tenant dan unit wajib diisi.';
  end if;

  if p_invoice_date is null then
    raise exception 'Tanggal penjualan wajib diisi.';
  end if;

  if p_payment_type not in ('cash', 'credit') then
    raise exception 'Jenis penjualan tidak valid.';
  end if;

  if p_payment_type = 'credit' and p_due_date is null then
    raise exception 'Tanggal jatuh tempo wajib diisi untuk penjualan kredit.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Minimal satu baris barang wajib diisi.';
  end if;

  for v_line in
    select value
    from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line->>'item_id', '')::uuid;
    v_quantity := coalesce(nullif(v_line->>'quantity', '')::numeric, 0);
    v_discount_percent := coalesce(nullif(v_line->>'discount_percent', '')::numeric, 0);
    v_tax_amount := coalesce(nullif(v_line->>'tax_amount', '')::numeric, 0);
    v_description := nullif(v_line->>'description', '');

    if v_item_id is null then
      raise exception 'Barang wajib dipilih.';
    end if;

    if v_quantity <= 0 then
      raise exception 'Jumlah harus lebih dari 0.';
    end if;

    if v_discount_percent < 0 or v_discount_percent > 100 then
      raise exception 'Diskon persen harus berada di antara 0 sampai 100.';
    end if;

    if v_tax_amount < 0 then
      raise exception 'Pajak tidak boleh negatif.';
    end if;

    v_unit_price := public.get_active_item_sales_price(
      v_item_id,
      'retail',
      p_invoice_date
    );

    if v_unit_price is null or v_unit_price <= 0 then
      raise exception 'Harga jual aktif barang belum tersedia atau masih 0.';
    end if;

    v_unit_cost := public.get_inventory_unit_cost(v_item_id);

    if v_unit_cost is null or v_unit_cost <= 0 then
      raise exception 'Harga pokok barang belum tersedia atau tidak valid.';
    end if;

    v_gross_amount := round(v_quantity * v_unit_price, 2);
    v_discount_amount := round(v_gross_amount * (v_discount_percent / 100), 2);

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id,
        'quantity', v_quantity,
        'unit_price', v_unit_price,
        'discount_amount', v_discount_amount,
        'tax_amount', v_tax_amount,
        'unit_cost', v_unit_cost,
        'description', v_description
      )
    );
  end loop;

  return public.create_and_post_sales_invoice(
    p_tenant_id,
    p_unit_id,
    p_customer_id,
    p_invoice_no,
    p_invoice_date,
    p_due_date,
    p_payment_type,
    p_notes,
    v_lines
  );
end;
$$;

grant execute on function public.create_and_post_sales_invoice_with_discount_percent(
  uuid,
  uuid,
  uuid,
  text,
  date,
  date,
  text,
  text,
  jsonb
) to authenticated;

notify pgrst, 'reload schema';