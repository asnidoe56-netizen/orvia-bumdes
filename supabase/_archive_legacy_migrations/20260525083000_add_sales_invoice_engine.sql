-- Sales Invoice Engine
-- Validated manually in Supabase SQL Editor on 2026-05-25.
-- Scope:
-- 1. Global negative inventory protection
-- 2. Sales invoice creation
-- 3. Cash sales posting
-- 4. Frontend wrapper create_and_post_sales_invoice

create or replace function public.prevent_negative_inventory_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_current_stock numeric(18,2);
  v_stock_without_current_row numeric(18,2);
  v_new_stock numeric(18,2);
  v_item_code text;
  v_item_name text;
begin
  if new.quantity_in < 0 then
    raise exception 'Quantity masuk tidak boleh negatif';
  end if;

  if new.quantity_out < 0 then
    raise exception 'Quantity keluar tidak boleh negatif';
  end if;

  if new.quantity_in > 0 and new.quantity_out > 0 then
    raise exception 'Satu mutasi persediaan tidak boleh sekaligus masuk dan keluar';
  end if;

  if new.quantity_out <= 0 then
    return new;
  end if;

  select
    ii.item_code,
    ii.item_name
  into
    v_item_code,
    v_item_name
  from public.inventory_items ii
  where ii.id = new.item_id;

  if tg_op = 'UPDATE' then
    select
      coalesce(sum(im.quantity_in - im.quantity_out), 0)
    into v_stock_without_current_row
    from public.inventory_movements im
    where im.item_id = new.item_id
      and im.id <> old.id;
  else
    select
      coalesce(sum(im.quantity_in - im.quantity_out), 0)
    into v_stock_without_current_row
    from public.inventory_movements im
    where im.item_id = new.item_id;
  end if;

  v_current_stock := coalesce(v_stock_without_current_row, 0);
  v_new_stock := v_current_stock + coalesce(new.quantity_in, 0) - coalesce(new.quantity_out, 0);

  if v_new_stock < 0 then
    raise exception 'Stok tidak mencukupi untuk item % - %. Stok tersedia: %, keluar: %, sisa menjadi: %',
      coalesce(v_item_code, new.item_id::text),
      coalesce(v_item_name, '-'),
      v_current_stock,
      new.quantity_out,
      v_new_stock
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_prevent_negative_inventory_stock_insert
on public.inventory_movements;

drop trigger if exists trg_prevent_negative_inventory_stock_update
on public.inventory_movements;

create trigger trg_prevent_negative_inventory_stock_insert
before insert on public.inventory_movements
for each row
execute function public.prevent_negative_inventory_stock();

create trigger trg_prevent_negative_inventory_stock_update
before update on public.inventory_movements
for each row
execute function public.prevent_negative_inventory_stock();


create or replace function public.create_sales_invoice(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_customer_id uuid,
  p_invoice_no text,
  p_invoice_date date,
  p_due_date date default null::date,
  p_payment_type text default 'cash'::text,
  p_notes text default null::text,
  p_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invoice_id uuid;
  v_actor_role public.app_role;
  v_line jsonb;
  v_line_no integer := 1;
  v_item_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_discount_amount numeric;
  v_tax_amount numeric;
  v_unit_cost numeric;
  v_description text;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  if not public.can_access_unit(p_unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  perform public.assert_user_has_permission(
    'sales.manage',
    auth.uid(),
    p_tenant_id,
    p_unit_id
  );

  if nullif(trim(p_invoice_no), '') is null then
    raise exception 'Nomor invoice penjualan wajib diisi';
  end if;

  if p_invoice_date is null then
    raise exception 'Tanggal invoice penjualan wajib diisi';
  end if;

  if p_payment_type not in ('cash', 'credit') then
    raise exception 'Tipe pembayaran harus cash atau credit';
  end if;

  if p_payment_type = 'credit' and p_due_date is null then
    raise exception 'Tanggal jatuh tempo wajib diisi untuk penjualan kredit';
  end if;

  if p_customer_id is not null and not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.tenant_id = p_tenant_id
      and (c.unit_id = p_unit_id or c.unit_id is null)
      and c.is_active = true
  ) then
    raise exception 'Customer tidak valid atau tidak aktif';
  end if;

  if exists (
    select 1
    from public.sales_invoices si
    where si.tenant_id = p_tenant_id
      and si.unit_id = p_unit_id
      and si.invoice_no = upper(trim(p_invoice_no))
  ) then
    raise exception 'Nomor invoice penjualan sudah digunakan dalam unit ini';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Detail penjualan harus berupa array';
  end if;

  if jsonb_array_length(p_lines) = 0 then
    raise exception 'Detail item penjualan wajib diisi minimal 1 baris';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = p_unit_id
      or ur.tenant_id = p_tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'manager_unit' then 1
      when ur.role = 'operator_unit' then 2
      when ur.role = 'direktur_bumdes' then 3
      when ur.role = 'admin_bumdes' then 4
      when ur.role = 'super_admin_platform' then 5
      else 6
    end
  limit 1;

  insert into public.sales_invoices (
    tenant_id,
    unit_id,
    customer_id,
    invoice_no,
    invoice_date,
    due_date,
    payment_type,
    status,
    notes,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_customer_id,
    upper(trim(p_invoice_no)),
    p_invoice_date,
    p_due_date,
    p_payment_type,
    'draft',
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_invoice_id;

  for v_line in
    select value
    from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line->>'item_id', '')::uuid;
    v_quantity := coalesce(nullif(v_line->>'quantity', '')::numeric, 0);
    v_unit_price := coalesce(nullif(v_line->>'unit_price', '')::numeric, 0);
    v_discount_amount := coalesce(nullif(v_line->>'discount_amount', '')::numeric, 0);
    v_tax_amount := coalesce(nullif(v_line->>'tax_amount', '')::numeric, 0);
    v_unit_cost := coalesce(nullif(v_line->>'unit_cost', '')::numeric, 0);
    v_description := nullif(trim(coalesce(v_line->>'description', '')), '');

    if v_item_id is null then
      raise exception 'Item pada baris % wajib diisi', v_line_no;
    end if;

    if not exists (
      select 1
      from public.inventory_items ii
      where ii.id = v_item_id
        and ii.tenant_id = p_tenant_id
        and ii.unit_id = p_unit_id
        and ii.is_active = true
    ) then
      raise exception 'Item pada baris % tidak valid atau tidak aktif', v_line_no;
    end if;

    if exists (
      select 1
      from public.inventory_items ii
      where ii.id = v_item_id
        and ii.item_type <> 'stock'
    ) then
      raise exception 'Penjualan saat ini hanya mendukung item bertipe stock. Baris: %', v_line_no;
    end if;

    if v_quantity <= 0 then
      raise exception 'Quantity pada baris % harus lebih dari 0', v_line_no;
    end if;

    if v_unit_price < 0 then
      raise exception 'Harga jual pada baris % tidak boleh negatif', v_line_no;
    end if;

    if v_discount_amount < 0 then
      raise exception 'Diskon pada baris % tidak boleh negatif', v_line_no;
    end if;

    if v_tax_amount < 0 then
      raise exception 'Pajak pada baris % tidak boleh negatif', v_line_no;
    end if;

    if v_unit_cost < 0 then
      raise exception 'Harga pokok pada baris % tidak boleh negatif', v_line_no;
    end if;

    if v_unit_cost = 0 then
      select
        case
          when coalesce(sum(im.quantity_in - im.quantity_out), 0) > 0
            then round(
              coalesce(sum(
                case
                  when im.quantity_in > 0 then im.total_cost
                  when im.quantity_out > 0 then -im.total_cost
                  else 0
                end
              ), 0)
              /
              coalesce(nullif(sum(im.quantity_in - im.quantity_out), 0), 1),
              2
            )
          else 0
        end
      into v_unit_cost
      from public.inventory_movements im
      where im.tenant_id = p_tenant_id
        and im.unit_id = p_unit_id
        and im.item_id = v_item_id;
    end if;

    if v_unit_cost <= 0 then
      raise exception 'Harga pokok item pada baris % belum tersedia. Pastikan stok berasal dari pembelian yang sudah diposting.', v_line_no;
    end if;

    insert into public.sales_invoice_lines (
      sales_invoice_id,
      item_id,
      line_no,
      description,
      quantity,
      unit_price,
      discount_amount,
      tax_amount,
      unit_cost
    )
    values (
      v_invoice_id,
      v_item_id,
      v_line_no,
      v_description,
      v_quantity,
      v_unit_price,
      v_discount_amount,
      v_tax_amount,
      v_unit_cost
    );

    v_line_no := v_line_no + 1;
  end loop;

  perform public.log_audit_event(
    p_tenant_id,
    p_unit_id,
    auth.uid(),
    v_actor_role,
    'sales_invoice_created'::text,
    'sales_invoices'::text,
    v_invoice_id,
    'unit_dashboard'::text,
    v_invoice_id,
    'Draft penjualan dibuat.'::text,
    jsonb_build_object(
      'sales_invoice_id', v_invoice_id,
      'invoice_no', upper(trim(p_invoice_no)),
      'invoice_date', p_invoice_date,
      'payment_type', p_payment_type,
      'line_count', jsonb_array_length(p_lines)
    )
  );

  return v_invoice_id;
end;
$function$;

grant execute on function public.create_sales_invoice(
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


create or replace function public.post_sales_invoice(
  p_sales_invoice_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invoice record;
  v_period_id uuid;
  v_journal_entry_id uuid;
  v_cash_account_id uuid;
  v_sales_account_id uuid;
  v_inventory_account_id uuid;
  v_cogs_account_id uuid;
  v_cash_bank_account_id uuid;
  v_actor_role public.app_role;
  v_journal_no text;
  v_cash_transaction_no text;
  v_total_cogs numeric(18,2);
  v_line record;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  select si.*
  into v_invoice
  from public.sales_invoices si
  where si.id = p_sales_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Invoice penjualan tidak ditemukan';
  end if;

  if not public.can_access_unit(v_invoice.unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  if public.unit_tenant_id(v_invoice.unit_id) is distinct from v_invoice.tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  perform public.assert_user_has_permission(
    'sales.manage',
    auth.uid(),
    v_invoice.tenant_id,
    v_invoice.unit_id
  );

  if v_invoice.status <> 'draft' then
    raise exception 'Hanya invoice penjualan berstatus draft yang dapat diposting. Status saat ini: %', v_invoice.status;
  end if;

  if v_invoice.payment_type <> 'cash' then
    raise exception 'Posting tahap ini hanya mendukung penjualan tunai';
  end if;

  if v_invoice.total_amount <= 0 then
    raise exception 'Total invoice penjualan harus lebih dari 0';
  end if;

  if not exists (
    select 1
    from public.sales_invoice_lines sil
    where sil.sales_invoice_id = v_invoice.id
  ) then
    raise exception 'Invoice penjualan belum memiliki detail item';
  end if;

  if exists (
    select 1
    from public.sales_invoice_lines sil
    join public.inventory_items ii on ii.id = sil.item_id
    where sil.sales_invoice_id = v_invoice.id
      and ii.item_type <> 'stock'
  ) then
    raise exception 'Posting penjualan saat ini hanya mendukung item bertipe stock';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_invoice.tenant_id
    and ap.unit_id = v_invoice.unit_id
    and v_invoice.invoice_date between ap.period_start and ap.period_end
  limit 1;

  perform public.assert_period_open(v_period_id);

  select coa.id
  into v_cash_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = v_invoice.tenant_id
    and coa.unit_id = v_invoice.unit_id
    and coa.kode = '1110'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_cash_account_id is null then
    raise exception 'Akun Kas kode 1110 tidak ditemukan atau tidak aktif';
  end if;

  select coa.id
  into v_sales_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = v_invoice.tenant_id
    and coa.unit_id = v_invoice.unit_id
    and coa.kode = '4100'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_sales_account_id is null then
    raise exception 'Akun Pendapatan Penjualan kode 4100 tidak ditemukan atau tidak aktif';
  end if;

  select coa.id
  into v_inventory_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = v_invoice.tenant_id
    and coa.unit_id = v_invoice.unit_id
    and coa.kode = '1300'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_inventory_account_id is null then
    raise exception 'Akun Persediaan kode 1300 tidak ditemukan atau tidak aktif';
  end if;

  select coa.id
  into v_cogs_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = v_invoice.tenant_id
    and coa.unit_id = v_invoice.unit_id
    and coa.kode = '5100'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_cogs_account_id is null then
    raise exception 'Akun HPP kode 5100 tidak ditemukan atau tidak aktif';
  end if;

  select cba.id
  into v_cash_bank_account_id
  from public.cash_bank_accounts cba
  where cba.tenant_id = v_invoice.tenant_id
    and cba.unit_id = v_invoice.unit_id
    and cba.account_id = v_cash_account_id
    and cba.is_active = true
  order by cba.account_code
  limit 1;

  if v_cash_bank_account_id is null then
    raise exception 'Akun kas/bank aktif untuk penerimaan tunai belum dibuat';
  end if;

  if exists (
    select 1
    from public.inventory_movements im
    where im.source_type = 'sales_invoice'
      and im.source_id = v_invoice.id
  ) then
    raise exception 'Invoice penjualan ini sudah memiliki mutasi persediaan';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.source_type = 'sales_invoice'
      and je.source_id = v_invoice.id
  ) then
    raise exception 'Invoice penjualan ini sudah memiliki jurnal';
  end if;

  if exists (
    select 1
    from public.cash_bank_transactions cbt
    where cbt.source_type = 'sales_invoice'
      and cbt.source_id = v_invoice.id
  ) then
    raise exception 'Invoice penjualan ini sudah memiliki transaksi kas/bank';
  end if;

  for v_line in
    select
      sil.id as line_id,
      sil.item_id,
      sil.quantity,
      sil.unit_price,
      sil.line_total,
      sil.unit_cost,
      ii.item_code,
      ii.item_name
    from public.sales_invoice_lines sil
    join public.inventory_items ii on ii.id = sil.item_id
    where sil.sales_invoice_id = v_invoice.id
    order by sil.line_no
  loop
    if public.get_inventory_stock(v_line.item_id) < v_line.quantity then
      raise exception 'Stok item % tidak mencukupi. Stok tersedia: %, diminta: %',
        v_line.item_code,
        public.get_inventory_stock(v_line.item_id),
        v_line.quantity;
    end if;

    if v_line.unit_cost <= 0 then
      raise exception 'Harga pokok item % belum tersedia', v_line.item_code;
    end if;
  end loop;

  select coalesce(sum(sil.quantity * sil.unit_cost), 0)
  into v_total_cogs
  from public.sales_invoice_lines sil
  where sil.sales_invoice_id = v_invoice.id;

  if v_total_cogs <= 0 then
    raise exception 'Total HPP penjualan harus lebih dari 0';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = v_invoice.unit_id
      or ur.tenant_id = v_invoice.tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'manager_unit' then 1
      when ur.role = 'operator_unit' then 2
      when ur.role = 'direktur_bumdes' then 3
      when ur.role = 'admin_bumdes' then 4
      when ur.role = 'super_admin_platform' then 5
      else 6
    end
  limit 1;

  v_journal_no := 'JPN-' || v_invoice.invoice_no;
  v_cash_transaction_no := 'CBS-' || v_invoice.invoice_no;

  insert into public.journal_entries (
    tenant_id,
    unit_id,
    period_id,
    journal_no,
    journal_date,
    source_type,
    source_id,
    description,
    status,
    created_by
  )
  values (
    v_invoice.tenant_id,
    v_invoice.unit_id,
    v_period_id,
    v_journal_no,
    v_invoice.invoice_date,
    'sales_invoice',
    v_invoice.id,
    'Posting penjualan tunai ' || v_invoice.invoice_no,
    'draft',
    auth.uid()
  )
  returning id into v_journal_entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    line_no,
    description,
    debit,
    credit
  )
  values
  (
    v_journal_entry_id,
    v_cash_account_id,
    1,
    'Kas masuk dari penjualan ' || v_invoice.invoice_no,
    v_invoice.total_amount,
    0
  ),
  (
    v_journal_entry_id,
    v_sales_account_id,
    2,
    'Pendapatan penjualan ' || v_invoice.invoice_no,
    0,
    v_invoice.total_amount
  ),
  (
    v_journal_entry_id,
    v_cogs_account_id,
    3,
    'HPP penjualan ' || v_invoice.invoice_no,
    v_total_cogs,
    0
  ),
  (
    v_journal_entry_id,
    v_inventory_account_id,
    4,
    'Persediaan keluar dari penjualan ' || v_invoice.invoice_no,
    0,
    v_total_cogs
  );

  perform public.assert_journal_balanced(v_journal_entry_id);

  for v_line in
    select
      sil.id as line_id,
      sil.item_id,
      sil.quantity,
      sil.unit_price,
      sil.line_total,
      sil.unit_cost,
      ii.item_code,
      ii.item_name
    from public.sales_invoice_lines sil
    join public.inventory_items ii on ii.id = sil.item_id
    where sil.sales_invoice_id = v_invoice.id
    order by sil.line_no
  loop
    insert into public.inventory_movements (
      tenant_id,
      unit_id,
      item_id,
      movement_date,
      movement_type,
      source_type,
      source_id,
      quantity_in,
      quantity_out,
      unit_cost,
      total_cost,
      description,
      created_by
    )
    values (
      v_invoice.tenant_id,
      v_invoice.unit_id,
      v_line.item_id,
      v_invoice.invoice_date,
      'sales_delivery',
      'sales_invoice',
      v_invoice.id,
      0,
      v_line.quantity,
      v_line.unit_cost,
      v_line.quantity * v_line.unit_cost,
      'Pengeluaran penjualan ' || v_invoice.invoice_no || ' - ' || v_line.item_code || ' ' || v_line.item_name,
      auth.uid()
    );
  end loop;

  update public.journal_entries
  set
    status = 'posted',
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now()
  where id = v_journal_entry_id;

  insert into public.cash_bank_transactions (
    tenant_id,
    unit_id,
    cash_bank_account_id,
    transaction_no,
    transaction_date,
    transaction_type,
    source_type,
    source_id,
    description,
    amount,
    status,
    journal_entry_id,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_invoice.tenant_id,
    v_invoice.unit_id,
    v_cash_bank_account_id,
    v_cash_transaction_no,
    v_invoice.invoice_date,
    'receipt',
    'sales_invoice',
    v_invoice.id,
    'Penerimaan tunai penjualan ' || v_invoice.invoice_no,
    v_invoice.total_amount,
    'posted',
    v_journal_entry_id,
    now(),
    auth.uid(),
    auth.uid()
  );

  update public.sales_invoices
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    posted_at = now(),
    posted_by = auth.uid(),
    paid_amount = total_amount,
    updated_at = now()
  where id = v_invoice.id;

  perform public.log_audit_event(
    v_invoice.tenant_id,
    v_invoice.unit_id,
    auth.uid(),
    v_actor_role,
    'sales_invoice_posted'::text,
    'sales_invoices'::text,
    v_invoice.id,
    'unit_dashboard'::text,
    v_invoice.id,
    'Invoice penjualan tunai diposting.'::text,
    jsonb_build_object(
      'sales_invoice_id', v_invoice.id,
      'invoice_no', v_invoice.invoice_no,
      'journal_entry_id', v_journal_entry_id,
      'payment_type', v_invoice.payment_type,
      'total_amount', v_invoice.total_amount,
      'total_cogs', v_total_cogs
    )
  );

  return v_journal_entry_id;
end;
$function$;

grant execute on function public.post_sales_invoice(uuid) to authenticated;


create or replace function public.create_and_post_sales_invoice(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_customer_id uuid,
  p_invoice_no text,
  p_invoice_date date,
  p_due_date date default null::date,
  p_payment_type text default 'cash'::text,
  p_notes text default null::text,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sales_invoice_id uuid;
  v_journal_entry_id uuid;
begin
  v_sales_invoice_id := public.create_sales_invoice(
    p_tenant_id,
    p_unit_id,
    p_customer_id,
    p_invoice_no,
    p_invoice_date,
    p_due_date,
    p_payment_type,
    p_notes,
    p_lines
  );

  v_journal_entry_id := public.post_sales_invoice(v_sales_invoice_id);

  return jsonb_build_object(
    'sales_invoice_id', v_sales_invoice_id,
    'journal_entry_id', v_journal_entry_id,
    'payment_type', p_payment_type,
    'status', 'posted'
  );
end;
$function$;

grant execute on function public.create_and_post_sales_invoice(
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


create or replace view public.v_sales_invoice_flow_audit as
with line_sum as (
  select
    sil.sales_invoice_id,
    count(*) as line_count,
    sum(sil.quantity) as total_quantity,
    sum(sil.line_total) as total_line_amount,
    sum(sil.quantity * sil.unit_cost) as total_cogs,
    bool_and(ii.item_type = 'stock') as all_stock_items
  from public.sales_invoice_lines sil
  join public.inventory_items ii
    on ii.id = sil.item_id
  group by sil.sales_invoice_id
),
inventory_sum as (
  select
    im.source_id as sales_invoice_id,
    count(*) as movement_count,
    sum(im.quantity_in) as total_qty_in,
    sum(im.quantity_out) as total_qty_out,
    sum(im.total_cost) as total_inventory_cost,
    bool_and(im.movement_type = 'sales_delivery') as all_sales_delivery
  from public.inventory_movements im
  where im.source_type = 'sales_invoice'
  group by im.source_id
),
journal_sum as (
  select
    je.source_id as sales_invoice_id,
    je.id as journal_entry_id,
    je.status as journal_status,
    je.journal_no,
    sum(jl.debit) as total_debit,
    sum(jl.credit) as total_credit,
    sum(jl.debit) - sum(jl.credit) as journal_diff
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  where je.source_type = 'sales_invoice'
  group by
    je.source_id,
    je.id,
    je.status,
    je.journal_no
),
journal_accounts as (
  select
    je.source_id as sales_invoice_id,
    bool_or(coa.kode = '1110' and jl.debit > 0) as has_cash_debit,
    bool_or(coa.kode = '4100' and jl.credit > 0) as has_sales_credit,
    bool_or(coa.kode = '5100' and jl.debit > 0) as has_cogs_debit,
    bool_or(coa.kode = '1300' and jl.credit > 0) as has_inventory_credit
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  join public.chart_of_accounts coa
    on coa.id = jl.account_id
  where je.source_type = 'sales_invoice'
  group by je.source_id
),
cash_sum as (
  select
    cbt.source_id as sales_invoice_id,
    count(*) as cash_tx_count,
    max(cbt.transaction_type) as transaction_type,
    max(cbt.status) as cash_tx_status,
    sum(cbt.amount) as total_cash_amount
  from public.cash_bank_transactions cbt
  where cbt.source_type = 'sales_invoice'
  group by cbt.source_id
)
select
  si.id as sales_invoice_id,
  si.tenant_id,
  si.unit_id,
  bu.nama_unit,
  si.customer_id,
  c.customer_code,
  c.customer_name,
  si.invoice_no,
  si.invoice_date,
  si.due_date,
  si.payment_type,
  si.status as invoice_status,
  si.subtotal,
  si.discount_amount,
  si.tax_amount,
  si.total_amount,
  si.paid_amount,
  si.journal_entry_id as invoice_journal_entry_id,
  si.posted_at,
  si.posted_by,
  si.created_by,
  si.created_at,

  coalesce(ls.line_count, 0) as line_count,
  coalesce(ls.total_quantity, 0) as total_quantity,
  coalesce(ls.total_line_amount, 0) as total_line_amount,
  coalesce(ls.total_cogs, 0) as total_cogs,
  coalesce(ls.all_stock_items, false) as all_stock_items,

  coalesce(inv.movement_count, 0) as movement_count,
  coalesce(inv.total_qty_in, 0) as total_qty_in,
  coalesce(inv.total_qty_out, 0) as total_qty_out,
  coalesce(inv.total_inventory_cost, 0) as total_inventory_cost,
  coalesce(inv.all_sales_delivery, false) as all_sales_delivery,

  js.journal_entry_id,
  js.journal_no,
  js.journal_status,
  coalesce(js.total_debit, 0) as total_debit,
  coalesce(js.total_credit, 0) as total_credit,
  coalesce(js.journal_diff, 0) as journal_diff,

  coalesce(ja.has_cash_debit, false) as has_cash_debit,
  coalesce(ja.has_sales_credit, false) as has_sales_credit,
  coalesce(ja.has_cogs_debit, false) as has_cogs_debit,
  coalesce(ja.has_inventory_credit, false) as has_inventory_credit,

  coalesce(cs.cash_tx_count, 0) as cash_tx_count,
  cs.transaction_type as cash_transaction_type,
  cs.cash_tx_status,
  coalesce(cs.total_cash_amount, 0) as total_cash_amount,

  case
    when si.status <> 'posted'
      then 'CHECK'
    when si.payment_type = 'cash'
      and si.paid_amount = si.total_amount
      and coalesce(ls.total_line_amount, 0) = si.total_amount
      and coalesce(ls.total_cogs, 0) > 0
      and coalesce(ls.all_stock_items, false) = true
      and coalesce(inv.movement_count, 0) > 0
      and coalesce(inv.all_sales_delivery, false) = true
      and coalesce(inv.total_inventory_cost, 0) = coalesce(ls.total_cogs, 0)
      and coalesce(inv.total_qty_out, 0) = coalesce(ls.total_quantity, 0)
      and coalesce(inv.total_qty_in, 0) = 0
      and js.journal_status = 'posted'
      and coalesce(js.total_debit, 0) = coalesce(js.total_credit, 0)
      and coalesce(js.journal_diff, 0) = 0
      and coalesce(ja.has_cash_debit, false) = true
      and coalesce(ja.has_sales_credit, false) = true
      and coalesce(ja.has_cogs_debit, false) = true
      and coalesce(ja.has_inventory_credit, false) = true
      and coalesce(cs.cash_tx_count, 0) = 1
      and cs.transaction_type = 'receipt'
      and cs.cash_tx_status = 'posted'
      and coalesce(cs.total_cash_amount, 0) = si.total_amount
      then 'PASS'
    else 'CHECK'
  end as audit_result,

  array_remove(array[
    case when si.status <> 'posted' then 'Invoice penjualan belum posted' end,
    case when coalesce(ls.line_count, 0) = 0 then 'Detail barang belum ada' end,
    case when coalesce(ls.total_line_amount, 0) <> si.total_amount then 'Total detail tidak sama dengan total invoice' end,
    case when coalesce(ls.total_cogs, 0) <= 0 then 'HPP penjualan belum terbentuk' end,
    case when coalesce(ls.all_stock_items, false) = false then 'Ada item yang bukan tipe stock' end,
    case when coalesce(inv.movement_count, 0) = 0 then 'Mutasi stok keluar belum ada' end,
    case when coalesce(inv.all_sales_delivery, false) = false then 'Movement type stok keluar bukan sales_delivery' end,
    case when coalesce(inv.total_inventory_cost, 0) <> coalesce(ls.total_cogs, 0) then 'Nilai mutasi stok tidak sama dengan total HPP' end,
    case when coalesce(inv.total_qty_out, 0) <> coalesce(ls.total_quantity, 0) then 'Jumlah stok keluar tidak sama dengan jumlah barang terjual' end,
    case when js.journal_entry_id is null then 'Jurnal belum ada' end,
    case when js.journal_status is distinct from 'posted' then 'Jurnal belum posted' end,
    case when coalesce(js.journal_diff, 0) <> 0 then 'Jurnal tidak balance' end,
    case when coalesce(ja.has_cash_debit, false) = false then 'Debit kas belum ada untuk penjualan tunai' end,
    case when coalesce(ja.has_sales_credit, false) = false then 'Kredit pendapatan penjualan belum ada' end,
    case when coalesce(ja.has_cogs_debit, false) = false then 'Debit HPP belum ada' end,
    case when coalesce(ja.has_inventory_credit, false) = false then 'Kredit persediaan belum ada' end,
    case when si.payment_type = 'cash' and coalesce(cs.cash_tx_count, 0) = 0 then 'Transaksi kas-bank receipt belum ada untuk penjualan tunai' end,
    case when si.payment_type = 'cash' and cs.transaction_type is distinct from 'receipt' then 'Jenis transaksi kas-bank bukan receipt' end,
    case when si.payment_type = 'cash' and cs.cash_tx_status is distinct from 'posted' then 'Transaksi kas-bank belum posted' end,
    case when si.payment_type = 'cash' and coalesce(cs.total_cash_amount, 0) <> si.total_amount then 'Nominal kas masuk tidak sama dengan total invoice' end,
    case when si.payment_type = 'credit' then 'Audit penjualan kredit belum diaktifkan pada engine posting saat ini' end
  ], null) as audit_notes
from public.sales_invoices si
left join public.business_units bu
  on bu.id = si.unit_id
left join public.customers c
  on c.id = si.customer_id
left join line_sum ls
  on ls.sales_invoice_id = si.id
left join inventory_sum inv
  on inv.sales_invoice_id = si.id
left join journal_sum js
  on js.sales_invoice_id = si.id
left join journal_accounts ja
  on ja.sales_invoice_id = si.id
left join cash_sum cs
  on cs.sales_invoice_id = si.id;

grant select on public.v_sales_invoice_flow_audit to authenticated;

