# Frontend Gap 000028 Usage Detail — ORVIA-BUMDES

Tanggal audit: 2026-06-02

Tujuan: mencatat file frontend dan potongan kode yang memakai kandidat view gap sebelum membuat migration 000028.

## `v_bupati_bumdes_priority_attention`

File: `src\app\bupati\dashboard\page.tsx`

Mulai sekitar line: 320

```tsx
  312:   ] = await Promise.all([
  313:     supabase.from("v_bupati_dashboard_summary").select("*").maybeSingle(),
  314:     supabase
  315:       .from("v_bupati_kecamatan_performance")
  316:       .select("*")
  317:       .order("skor_rata_rata", { ascending: false })
  318:       .limit(8),
  319:     supabase
  320:       .from("v_bupati_bumdes_priority_attention")
  321:       .select("*")
  322:       .order("skor_kesehatan", { ascending: true })
  323:       .limit(8),
  324:     supabase
  325:       .from("v_bupati_top_performing_bumdes")
  326:       .select("*")
  327:       .order("skor_kesehatan", { ascending: false })
  328:       .limit(6),
  329:   ]);
  330: 
  331:   const summary = summaryResult.data as DashboardSummary | null;
  332:   const kecamatanRows = (kecamatanResult.data ?? []) as KecamatanPerformance[];
  333:   const priorityRows = (priorityResult.data ?? []) as BumdesPriority[];
  334:   const topRows = (topResult.data ?? []) as TopPerformingBumdes[];
  335: 
  336:   const errors = [
  337:     summaryResult.error?.message,
  338:     kecamatanResult.error?.message,
  339:     priorityResult.error?.message,
  340:     topResult.error?.message,
  341:   ].filter(Boolean);
  342: 
  343:   const totalSehat = toNumber(summary?.total_sehat);
  344:   const totalKurangSehat = toNumber(summary?.total_kurang_sehat);
  345:   const totalTidakSehat = toNumber(summary?.total_tidak_sehat);
  346:   const score = toNumber(summary?.skor_kesehatan_rata_rata);
  347:   const maxScore = toNumber(summary?.skor_maksimal_rata_rata) || 100;
  348: 
  349:   return (
  350:     <div className="space-y-6">
  351:       {errors.length > 0 ? (
  352:         <Card className="border-red-200 bg-red-50">
  353:           <div className="flex gap-3 text-red-700">
  354:             <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
  355:             <div>
```

## `v_bupati_dashboard_summary`

File: `src\app\bupati\dashboard\page.tsx`

Mulai sekitar line: 313

```tsx
  305:   const supabase = await createClient();
  306: 
  307:   const [
  308:     summaryResult,
  309:     kecamatanResult,
  310:     priorityResult,
  311:     topResult,
  312:   ] = await Promise.all([
  313:     supabase.from("v_bupati_dashboard_summary").select("*").maybeSingle(),
  314:     supabase
  315:       .from("v_bupati_kecamatan_performance")
  316:       .select("*")
  317:       .order("skor_rata_rata", { ascending: false })
  318:       .limit(8),
  319:     supabase
  320:       .from("v_bupati_bumdes_priority_attention")
  321:       .select("*")
  322:       .order("skor_kesehatan", { ascending: true })
  323:       .limit(8),
  324:     supabase
  325:       .from("v_bupati_top_performing_bumdes")
  326:       .select("*")
  327:       .order("skor_kesehatan", { ascending: false })
  328:       .limit(6),
  329:   ]);
  330: 
  331:   const summary = summaryResult.data as DashboardSummary | null;
  332:   const kecamatanRows = (kecamatanResult.data ?? []) as KecamatanPerformance[];
  333:   const priorityRows = (priorityResult.data ?? []) as BumdesPriority[];
  334:   const topRows = (topResult.data ?? []) as TopPerformingBumdes[];
  335: 
  336:   const errors = [
  337:     summaryResult.error?.message,
  338:     kecamatanResult.error?.message,
  339:     priorityResult.error?.message,
  340:     topResult.error?.message,
  341:   ].filter(Boolean);
  342: 
  343:   const totalSehat = toNumber(summary?.total_sehat);
  344:   const totalKurangSehat = toNumber(summary?.total_kurang_sehat);
  345:   const totalTidakSehat = toNumber(summary?.total_tidak_sehat);
  346:   const score = toNumber(summary?.skor_kesehatan_rata_rata);
  347:   const maxScore = toNumber(summary?.skor_maksimal_rata_rata) || 100;
  348: 
```

## `v_bupati_kecamatan_performance`

File: `src\app\bupati\dashboard\page.tsx`

Mulai sekitar line: 315

```tsx
  307:   const [
  308:     summaryResult,
  309:     kecamatanResult,
  310:     priorityResult,
  311:     topResult,
  312:   ] = await Promise.all([
  313:     supabase.from("v_bupati_dashboard_summary").select("*").maybeSingle(),
  314:     supabase
  315:       .from("v_bupati_kecamatan_performance")
  316:       .select("*")
  317:       .order("skor_rata_rata", { ascending: false })
  318:       .limit(8),
  319:     supabase
  320:       .from("v_bupati_bumdes_priority_attention")
  321:       .select("*")
  322:       .order("skor_kesehatan", { ascending: true })
  323:       .limit(8),
  324:     supabase
  325:       .from("v_bupati_top_performing_bumdes")
  326:       .select("*")
  327:       .order("skor_kesehatan", { ascending: false })
  328:       .limit(6),
  329:   ]);
  330: 
  331:   const summary = summaryResult.data as DashboardSummary | null;
  332:   const kecamatanRows = (kecamatanResult.data ?? []) as KecamatanPerformance[];
  333:   const priorityRows = (priorityResult.data ?? []) as BumdesPriority[];
  334:   const topRows = (topResult.data ?? []) as TopPerformingBumdes[];
  335: 
  336:   const errors = [
  337:     summaryResult.error?.message,
  338:     kecamatanResult.error?.message,
  339:     priorityResult.error?.message,
  340:     topResult.error?.message,
  341:   ].filter(Boolean);
  342: 
  343:   const totalSehat = toNumber(summary?.total_sehat);
  344:   const totalKurangSehat = toNumber(summary?.total_kurang_sehat);
  345:   const totalTidakSehat = toNumber(summary?.total_tidak_sehat);
  346:   const score = toNumber(summary?.skor_kesehatan_rata_rata);
  347:   const maxScore = toNumber(summary?.skor_maksimal_rata_rata) || 100;
  348: 
  349:   return (
  350:     <div className="space-y-6">
```

## `v_bupati_top_performing_bumdes`

File: `src\app\bupati\dashboard\page.tsx`

Mulai sekitar line: 325

```tsx
  317:       .order("skor_rata_rata", { ascending: false })
  318:       .limit(8),
  319:     supabase
  320:       .from("v_bupati_bumdes_priority_attention")
  321:       .select("*")
  322:       .order("skor_kesehatan", { ascending: true })
  323:       .limit(8),
  324:     supabase
  325:       .from("v_bupati_top_performing_bumdes")
  326:       .select("*")
  327:       .order("skor_kesehatan", { ascending: false })
  328:       .limit(6),
  329:   ]);
  330: 
  331:   const summary = summaryResult.data as DashboardSummary | null;
  332:   const kecamatanRows = (kecamatanResult.data ?? []) as KecamatanPerformance[];
  333:   const priorityRows = (priorityResult.data ?? []) as BumdesPriority[];
  334:   const topRows = (topResult.data ?? []) as TopPerformingBumdes[];
  335: 
  336:   const errors = [
  337:     summaryResult.error?.message,
  338:     kecamatanResult.error?.message,
  339:     priorityResult.error?.message,
  340:     topResult.error?.message,
  341:   ].filter(Boolean);
  342: 
  343:   const totalSehat = toNumber(summary?.total_sehat);
  344:   const totalKurangSehat = toNumber(summary?.total_kurang_sehat);
  345:   const totalTidakSehat = toNumber(summary?.total_tidak_sehat);
  346:   const score = toNumber(summary?.skor_kesehatan_rata_rata);
  347:   const maxScore = toNumber(summary?.skor_maksimal_rata_rata) || 100;
  348: 
  349:   return (
  350:     <div className="space-y-6">
  351:       {errors.length > 0 ? (
  352:         <Card className="border-red-200 bg-red-50">
  353:           <div className="flex gap-3 text-red-700">
  354:             <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
  355:             <div>
  356:               <h3 className="font-bold">Sebagian data dashboard gagal dimuat</h3>
  357:               <p className="mt-1 text-sm">{errors.join(" | ")}</p>
  358:             </div>
  359:           </div>
  360:         </Card>
```

## `v_capital_expenditure_payables`

File: `src\app\unit\dashboard\catat-transaksi\_components\capital-debt-payment-entry-form.tsx`

Mulai sekitar line: 118

```tsx
  110:                 <PageHeader />
  111: 
  112:                 <ErrorState message="Konteks tenant/unit tidak ditemukan. Silakan login ulang." />
  113:             </div>
  114:         );
  115:     }
  116: 
  117:     const { data: payables, error: payablesError } = await supabase
  118:         .from("v_capital_expenditure_payables")
  119:         .select(
  120:             "capital_expenditure_id, transaction_no, supplier_name, transaction_date, due_date, total_amount, payment_amount, outstanding_amount, payable_status"
  121:         )
  122:         .eq("tenant_id", loginContext.tenant_id)
  123:         .eq("unit_id", loginContext.unit_id)
  124:         .gt("outstanding_amount", 0)
  125:         .order("transaction_date", { ascending: false });
  126: 
  127:     const { data: cashBanks, error: cashBanksError } = await supabase
  128:         .from("v_cash_bank_balance")
  129:         .select("cash_bank_account_id, account_code, account_name, current_balance")
  130:         .eq("tenant_id", loginContext.tenant_id)
  131:         .eq("unit_id", loginContext.unit_id)
  132:         .gt("current_balance", 0)
  133:         .order("account_code", { ascending: true });
  134: 
  135:     const payableRows = (payables || []) as CapitalPayable[];
  136:     const cashBankRows = (cashBanks || []) as CashBankBalance[];
  137: 
  138:     const errorMessage = payablesError?.message || cashBanksError?.message;
  139: 
  140:     return (
  141:         <div className="space-y-5">
  142:             <PageHeader />
  143: 
  144:             {errorMessage && <ErrorState message={errorMessage} />}
  145: 
  146:             <CapitalDebtPaymentFormClient
  147:                 payables={payableRows}
  148:                 cashBanks={cashBankRows}
  149:             />
  150: 
  151:             <PayableList payables={payableRows} />
  152:         </div>
  153:     );
```

## `v_fixed_asset_depreciation_flow_audit`

File: `src\app\unit\dashboard\cek-alur-transaksi\page.tsx`

Mulai sekitar line: 695

```tsx
  687:       )
  688:       .eq("tenant_id", context.tenant_id)
  689:       .eq("unit_id", context.unit_id)
  690:       .eq("status", "posted")
  691:       .order("created_at", { ascending: false })
  692:       .limit(15),
  693: 
  694:     supabase
  695:       .from("v_fixed_asset_depreciation_flow_audit")
  696:       .select(
  697:         "depreciation_id, fixed_asset_id, asset_code, asset_name, acquisition_cost, residual_value, useful_life_months, asset_status, period_year, period_month, depreciation_date, depreciation_amount, accumulated_depreciation_amount, book_value_after, depreciation_status, journal_no, journal_status, depreciation_expense_account_code, depreciation_expense_account_name, accumulated_depreciation_account_code, accumulated_depreciation_account_name, total_debit, total_credit, journal_diff, has_expense_debit, has_accumulated_credit, audit_result, audit_notes, created_at"
  698:       )
  699:       .eq("tenant_id", context.tenant_id)
  700:       .eq("unit_id", context.unit_id)
  701:       .order("created_at", { ascending: false })
  702:       .limit(15),
  703:   ]);
  704: 
  705:   if (purchaseResult.error) {
  706:     throw new Error(purchaseResult.error.message);
  707:   }
  708: 
  709:   if (salesResult.error) {
  710:     throw new Error(salesResult.error.message);
  711:   }
  712: 
  713:   if (capitalExpenditureResult.error) {
  714:     throw new Error(capitalExpenditureResult.error.message);
  715:   }
  716: 
  717:   if (depreciationResult.error) {
  718:     throw new Error(depreciationResult.error.message);
  719:   }
  720: 
  721:   const purchaseAudits = (purchaseResult.data ?? []) as PurchaseFlowAudit[];
  722:   const salesAudits = (salesResult.data ?? []) as SalesFlowAudit[];
  723:   const capitalExpenditureAudits =
  724:     (capitalExpenditureResult.data ?? []) as CapitalExpenditureFlowAudit[];
  725:   const depreciationAudits =
  726:     (depreciationResult.data ?? []) as FixedAssetDepreciationFlowAudit[];
  727: 
  728:   const allAudits = [
  729:     ...purchaseAudits,
  730:     ...salesAudits,
```

## `v_fixed_asset_depreciation_summary`

File: `src\app\unit\dashboard\aset-tetap\page.tsx`

Mulai sekitar line: 112

```tsx
  104: 
  105:   if (!context?.tenant_id || !context.unit_id) {
  106:     redirect("/login");
  107:   }
  108: 
  109:   const supabase = await createClient();
  110: 
  111:   const { data, error } = await supabase
  112:     .from("v_fixed_asset_depreciation_summary")
  113:     .select(`
  114:       fixed_asset_id,
  115:       asset_code,
  116:       asset_name,
  117:       acquisition_date,
  118:       acquisition_cost,
  119:       residual_value,
  120:       useful_life_months,
  121:       asset_status,
  122:       asset_account_code,
  123:       asset_account_name,
  124:       accumulated_depreciation_total,
  125:       current_book_value,
  126:       last_depreciation_date,
  127:       posted_depreciation_count,
  128:       posted_journal_count,
  129:       current_period_year,
  130:       current_period_month,
  131:       current_period_status,
  132:       depreciation_readiness_status,
  133:       monthly_depreciation_estimate,
  134:       created_at
  135:     `)
  136:     .eq("tenant_id", context.tenant_id)
  137:     .eq("unit_id", context.unit_id)
  138:     .order("created_at", { ascending: false });
  139: 
  140:   if (error) {
  141:     throw new Error(error.message);
  142:   }
  143: 
  144:   const assets = (data ?? []) as FixedAssetSummary[];
  145:   const totalAssets = assets.length;
  146:   const activeAssets = assets.filter((asset) => asset.asset_status === "active").length;
  147:   const readyAssets = assets.filter(
```

File: `src\app\unit\dashboard\aset-tetap\page.tsx`

Mulai sekitar line: 331

```tsx
  323:           <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
  324:             <CalendarDays className="h-5 w-5" />
  325:           </div>
  326:           <div>
  327:             <h2 className="text-lg font-bold text-slate-950">
  328:               Daftar Aset Unit
  329:             </h2>
  330:             <p className="text-sm text-slate-600">
  331:               Menampilkan aset dari view v_fixed_asset_depreciation_summary.
  332:             </p>
  333:           </div>
  334:         </div>
  335: 
  336:         {assets.length === 0 ? (
  337:           <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
  338:             <p className="text-sm font-semibold text-slate-700">
  339:               Belum ada aset tetap.
  340:             </p>
  341:             <p className="mt-1 text-sm text-slate-500">
  342:               Aset akan muncul setelah transaksi Belanja Modal berhasil diposting.
  343:             </p>
  344:           </div>
  345:         ) : (
  346:           <div className="overflow-hidden rounded-2xl border border-slate-200">
  347:             <div className="overflow-x-auto">
  348:               <table className="w-full min-w-[1280px] text-left text-sm">
  349:                 <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
  350:                   <tr>
  351:                     <th className="px-4 py-3">Kode Aset</th>
  352:                     <th className="px-4 py-3">Nama Aset</th>
  353:                     <th className="px-4 py-3">Kategori Akun</th>
  354:                     <th className="px-4 py-3">Tanggal Perolehan</th>
  355:                     <th className="px-4 py-3 text-right">Nilai Perolehan</th>
  356:                     <th className="px-4 py-3 text-right">Akumulasi Susut</th>
  357:                     <th className="px-4 py-3 text-right">Nilai Buku</th>
  358:                     <th className="px-4 py-3 text-right">Susut/Bulan</th>
  359:                     <th className="px-4 py-3">Terakhir Susut</th>
  360:                     <th className="px-4 py-3">Status Periode</th>
  361:                   </tr>
  362:                 </thead>
  363: 
  364:                 <tbody className="divide-y divide-slate-200">
  365:                   {assets.map((asset) => (
  366:                     <tr key={asset.fixed_asset_id} className="hover:bg-slate-50">
```

## `v_journal_correction_eligible_entries`

File: `src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\new\page.tsx`

Mulai sekitar line: 103

```tsx
   95: 
   96:   if (!journalEntryId) {
   97:     redirect("/unit/dashboard/catat-transaksi/koreksi-transaksi");
   98:   }
   99: 
  100:   const supabase = await createClient();
  101: 
  102:   const { data: entryData, error: entryError } = await supabase
  103:     .from("v_journal_correction_eligible_entries")
  104:     .select("*")
  105:     .eq("journal_entry_id", journalEntryId)
  106:     .eq("tenant_id", context.tenant_id)
  107:     .eq("unit_id", context.unit_id)
  108:     .maybeSingle();
  109: 
  110:   if (entryError) {
  111:     return (
  112:       <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
  113:         Gagal membaca transaksi lama: {entryError.message}
  114:       </div>
  115:     );
  116:   }
  117: 
  118:   if (!entryData) {
  119:     notFound();
  120:   }
  121: 
  122:   const entry = entryData as unknown as EligibleEntry;
  123: 
  124:   const { data: lineData } = await supabase
  125:     .from("v_journal_correction_eligible_entry_lines")
  126:     .select("*")
  127:     .eq("journal_entry_id", journalEntryId)
  128:     .eq("tenant_id", context.tenant_id)
  129:     .eq("unit_id", context.unit_id)
  130:     .order("line_no", { ascending: true });
  131: 
  132:   const { data: accountData } = await supabase
  133:     .from("v_journal_correction_account_options")
  134:     .select("*")
  135:     .eq("tenant_id", context.tenant_id)
  136:     .or(`unit_id.eq.${context.unit_id},unit_id.is.null`)
  137:     .order("account_code", { ascending: true });
  138: 
```

File: `src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\page.tsx`

Mulai sekitar line: 151

```tsx
  143: 
  144:   if (!context?.user_id || !context.tenant_id || !context.unit_id) {
  145:     redirect("/login");
  146:   }
  147: 
  148:   const supabase = await createClient();
  149: 
  150:   const { data, error } = await supabase
  151:     .from("v_journal_correction_eligible_entries")
  152:     .select("*")
  153:     .eq("tenant_id", context.tenant_id)
  154:     .eq("unit_id", context.unit_id)
  155:     .order("journal_date", { ascending: false })
  156:     .order("created_at", { ascending: false });
  157: 
  158:   const { data: correctionData, error: correctionError } = await supabase
  159:     .from("v_journal_correction_flow")
  160:     .select(
  161:       [
  162:         "correction_id",
  163:         "correction_no",
  164:         "correction_date",
  165:         "correction_status",
  166:         "flow_status",
  167:         "audit_result",
  168:         "original_journal_no",
  169:         "original_source_type",
  170:         "original_total_debit",
  171:         "corrected_journal_no",
  172:         "corrected_total_debit",
  173:         "requested_by",
  174:         "requested_by_name",
  175:         "requested_at",
  176:         "approved_by_name",
  177:         "approved_at",
  178:         "posted_by_name",
  179:         "posted_at",
  180:         "reason",
  181:         "created_at",
  182:       ].join(", ")
  183:     )
  184:     .eq("tenant_id", context.tenant_id)
  185:     .eq("unit_id", context.unit_id)
  186:     .eq("requested_by", context.user_id)
```

## `v_journal_correction_eligible_entry_lines`

File: `src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\new\page.tsx`

Mulai sekitar line: 125

```tsx
  117: 
  118:   if (!entryData) {
  119:     notFound();
  120:   }
  121: 
  122:   const entry = entryData as unknown as EligibleEntry;
  123: 
  124:   const { data: lineData } = await supabase
  125:     .from("v_journal_correction_eligible_entry_lines")
  126:     .select("*")
  127:     .eq("journal_entry_id", journalEntryId)
  128:     .eq("tenant_id", context.tenant_id)
  129:     .eq("unit_id", context.unit_id)
  130:     .order("line_no", { ascending: true });
  131: 
  132:   const { data: accountData } = await supabase
  133:     .from("v_journal_correction_account_options")
  134:     .select("*")
  135:     .eq("tenant_id", context.tenant_id)
  136:     .or(`unit_id.eq.${context.unit_id},unit_id.is.null`)
  137:     .order("account_code", { ascending: true });
  138: 
  139:   const originalLines = ((lineData ?? []) as unknown) as EntryLine[];
  140:   const rawAccounts = ((accountData ?? []) as unknown) as AccountOption[];
  141:   const accountOptions = dedupeAccountOptions(rawAccounts, context.unit_id);
  142: 
  143:   return (
  144:     <div className="space-y-5">
  145:       <div>
  146:         <Link
  147:           href="/unit/dashboard/catat-transaksi/koreksi-transaksi"
  148:           className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
  149:         >
  150:           <ArrowLeft className="h-4 w-4" />
  151:           Kembali ke daftar transaksi
  152:         </Link>
  153:       </div>
  154: 
  155:       <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  156:         <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
  157:           Admin Unit / Pengajuan Koreksi
  158:         </p>
  159: 
  160:         <h1 className="mt-2 text-2xl font-bold text-slate-950">
```

## `v_journal_correction_flow`

File: `src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx`

Mulai sekitar line: 115

```tsx
  107: 
  108:   if (!context?.user_id || !context.tenant_id) {
  109:     redirect("/login");
  110:   }
  111: 
  112:   const supabase = await createClient();
  113: 
  114:   const { data: correctionData, error: correctionError } = await supabase
  115:     .from("v_journal_correction_flow")
  116:     .select("*")
  117:     .eq("correction_id", correctionId)
  118:     .eq("tenant_id", context.tenant_id)
  119:     .maybeSingle();
  120: 
  121:   if (correctionError) {
  122:     return (
  123:       <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
  124:         Gagal membaca detail koreksi transaksi: {correctionError.message}
  125:       </div>
  126:     );
  127:   }
  128: 
  129:   if (!correctionData) {
  130:     notFound();
  131:   }
  132: 
  133:   const correction = correctionData as unknown as AnyRow;
  134: 
  135:   const { data: lineData } = await supabase
  136:     .from("v_journal_correction_line_comparison")
  137:     .select("*")
  138:     .eq("correction_id", correctionId)
  139:     .order("journal_role_order", { ascending: true })
  140:     .order("line_no", { ascending: true });
  141: 
  142:   const { data: timelineData } = await supabase
  143:     .from("v_journal_correction_governance_timeline")
  144:     .select("*")
  145:     .eq("correction_id", correctionId)
  146:     .order("timeline_order", { ascending: true })
  147:     .order("event_at", { ascending: true });
  148: 
  149:   const lineRows = ((lineData ?? []) as unknown) as AnyRow[];
  150:   const timelineRows = ((timelineData ?? []) as unknown) as AnyRow[];
```

File: `src\app\bumdes\dashboard\koreksi-transaksi\page.tsx`

Mulai sekitar line: 115

```tsx
  107: 
  108:   if (!context?.user_id || !context.tenant_id) {
  109:     redirect("/login");
  110:   }
  111: 
  112:   const supabase = await createClient();
  113: 
  114:   const { data, error } = await supabase
  115:     .from("v_journal_correction_flow")
  116:     .select(
  117:       [
  118:         "correction_id",
  119:         "tenant_id",
  120:         "kode_bumdes",
  121:         "nama_bumdes",
  122:         "unit_id",
  123:         "kode_unit",
  124:         "nama_unit",
  125:         "correction_no",
  126:         "correction_date",
  127:         "reason",
  128:         "correction_status",
  129:         "original_journal_no",
  130:         "original_source_type",
  131:         "original_total_debit",
  132:         "corrected_journal_no",
  133:         "flow_status",
  134:         "audit_result",
  135:         "requested_by_name",
  136:         "requested_at",
  137:         "approved_by_name",
  138:         "approved_at",
  139:         "posted_by_name",
  140:         "posted_at",
  141:         "created_at",
  142:       ].join(", ")
  143:     )
  144:     .eq("tenant_id", context.tenant_id)
  145:     .in("correction_status", ["pending_approval", "approved", "rejected", "posted"])
  146:     .order("created_at", { ascending: false });
  147: 
  148:   const rows = ((data ?? []) as unknown) as CorrectionFlowRow[];
  149: 
  150:   const readyToPostRows = rows.filter((item) => item.correction_status === "approved");
```

File: `src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx`

Mulai sekitar line: 114

```tsx
  106: 
  107:   if (!context?.user_id || !context.tenant_id) {
  108:     redirect("/login");
  109:   }
  110: 
  111:   const supabase = await createClient();
  112: 
  113:   const { data: correctionData, error: correctionError } = await supabase
  114:     .from("v_journal_correction_flow")
  115:     .select("*")
  116:     .eq("correction_id", correctionId)
  117:     .eq("tenant_id", context.tenant_id)
  118:     .maybeSingle();
  119: 
  120:   if (correctionError) {
  121:     return (
  122:       <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
  123:         Gagal membaca detail koreksi transaksi: {correctionError.message}
  124:       </div>
  125:     );
  126:   }
  127: 
  128:   if (!correctionData) {
  129:     notFound();
  130:   }
  131: 
  132:   const correction = correctionData as unknown as AnyRow;
  133: 
  134:   const { data: lineData } = await supabase
  135:     .from("v_journal_correction_line_comparison")
  136:     .select("*")
  137:     .eq("correction_id", correctionId)
  138:     .order("journal_role_order", { ascending: true })
  139:     .order("line_no", { ascending: true });
  140: 
  141:   const { data: timelineData } = await supabase
  142:     .from("v_journal_correction_governance_timeline")
  143:     .select("*")
  144:     .eq("correction_id", correctionId)
  145:     .order("timeline_order", { ascending: true })
  146:     .order("event_at", { ascending: true });
  147: 
  148:   const lineRows = ((lineData ?? []) as unknown) as AnyRow[];
  149:   const timelineRows = ((timelineData ?? []) as unknown) as AnyRow[];
```

File: `src\app\pengawas\dashboard\koreksi-transaksi\page.tsx`

Mulai sekitar line: 107

```tsx
   99: 
  100:   if (!context?.user_id || !context.tenant_id) {
  101:     redirect("/login");
  102:   }
  103: 
  104:   const supabase = await createClient();
  105: 
  106:   const { data, error } = await supabase
  107:     .from("v_journal_correction_flow")
  108:     .select(
  109:       [
  110:         "correction_id",
  111:         "tenant_id",
  112:         "kode_bumdes",
  113:         "nama_bumdes",
  114:         "unit_id",
  115:         "kode_unit",
  116:         "nama_unit",
  117:         "correction_no",
  118:         "correction_date",
  119:         "reason",
  120:         "correction_status",
  121:         "original_journal_no",
  122:         "original_source_type",
  123:         "original_description",
  124:         "original_total_debit",
  125:         "corrected_journal_no",
  126:         "flow_status",
  127:         "audit_result",
  128:         "requested_by_name",
  129:         "requested_at",
  130:         "approved_by_name",
  131:         "approved_at",
  132:         "rejected_by_name",
  133:         "rejected_at",
  134:         "posted_by_name",
  135:         "posted_at",
  136:       ].join(", ")
  137:     )
  138:     .eq("tenant_id", context.tenant_id)
  139:     .order("created_at", { ascending: false });
  140: 
  141:   const rows = ((data ?? []) as unknown) as CorrectionFlowRow[];
  142: 
```

File: `src\app\pengawas\dashboard\koreksi-transaksi\page.tsx`

Mulai sekitar line: 227

```tsx
  219:           description="Koreksi final dan masuk audit trail."
  220:           icon={<FileCheck2 className="h-5 w-5" />}
  221:         />
  222:       </section>
  223: 
  224:       <Card>
  225:         <CardHeader
  226:           title="Daftar Koreksi Menunggu Persetujuan"
  227:           description="Data ini bersumber dari v_journal_correction_flow dan dibatasi sesuai tenant pengawas."
  228:           action={<Badge variant="warning">Perlu Review</Badge>}
  229:         />
  230: 
  231:         <DataTable
  232:           columns={[
  233:             "Nomor Koreksi",
  234:             "Unit",
  235:             "Transaksi Asal",
  236:             "Nilai",
  237:             "Alasan",
  238:             "Diajukan",
  239:             "Status",
  240:             "Aksi",
  241:           ]}
  242:           emptyText="Belum ada koreksi transaksi yang menunggu persetujuan."
  243:         >
  244:           {waitingRows.length > 0
  245:             ? waitingRows.map((item) => (
  246:                 <tr key={item.correction_id} className="hover:bg-slate-50">
  247:                   <td className="px-4 py-4">
  248:                     <div className="font-bold text-slate-950">
  249:                       {item.correction_no}
  250:                     </div>
  251:                     <div className="mt-1 text-xs text-slate-500">
  252:                       {item.correction_date}
  253:                     </div>
  254:                   </td>
  255: 
  256:                   <td className="px-4 py-4">
  257:                     <div className="font-semibold text-slate-800">
  258:                       {item.nama_unit ?? "-"}
  259:                     </div>
  260:                     <div className="mt-1 text-xs font-medium text-slate-500">
  261:                       {item.kode_unit ?? "-"}
  262:                     </div>
```

File: `src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\page.tsx`

Mulai sekitar line: 159

```tsx
  151:     .from("v_journal_correction_eligible_entries")
  152:     .select("*")
  153:     .eq("tenant_id", context.tenant_id)
  154:     .eq("unit_id", context.unit_id)
  155:     .order("journal_date", { ascending: false })
  156:     .order("created_at", { ascending: false });
  157: 
  158:   const { data: correctionData, error: correctionError } = await supabase
  159:     .from("v_journal_correction_flow")
  160:     .select(
  161:       [
  162:         "correction_id",
  163:         "correction_no",
  164:         "correction_date",
  165:         "correction_status",
  166:         "flow_status",
  167:         "audit_result",
  168:         "original_journal_no",
  169:         "original_source_type",
  170:         "original_total_debit",
  171:         "corrected_journal_no",
  172:         "corrected_total_debit",
  173:         "requested_by",
  174:         "requested_by_name",
  175:         "requested_at",
  176:         "approved_by_name",
  177:         "approved_at",
  178:         "posted_by_name",
  179:         "posted_at",
  180:         "reason",
  181:         "created_at",
  182:       ].join(", ")
  183:     )
  184:     .eq("tenant_id", context.tenant_id)
  185:     .eq("unit_id", context.unit_id)
  186:     .eq("requested_by", context.user_id)
  187:     .in("correction_status", ["pending_approval", "approved", "posted", "rejected"])
  188:     .order("created_at", { ascending: false });
  189: 
  190:   const rows = ((data ?? []) as unknown) as EligibleEntryRow[];
  191:   const correctionRows = ((correctionData ?? []) as unknown) as CorrectionFlowRow[];
  192:   const readyToPostRows = correctionRows.filter(
  193:     (item) =>
  194:       item.correction_status === "approved" &&
```

## `v_journal_correction_governance_timeline`

File: `src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx`

Mulai sekitar line: 143

```tsx
  135:   const { data: lineData } = await supabase
  136:     .from("v_journal_correction_line_comparison")
  137:     .select("*")
  138:     .eq("correction_id", correctionId)
  139:     .order("journal_role_order", { ascending: true })
  140:     .order("line_no", { ascending: true });
  141: 
  142:   const { data: timelineData } = await supabase
  143:     .from("v_journal_correction_governance_timeline")
  144:     .select("*")
  145:     .eq("correction_id", correctionId)
  146:     .order("timeline_order", { ascending: true })
  147:     .order("event_at", { ascending: true });
  148: 
  149:   const lineRows = ((lineData ?? []) as unknown) as AnyRow[];
  150:   const timelineRows = ((timelineData ?? []) as unknown) as AnyRow[];
  151: 
  152:   const isReadyToPost =
  153:     asText(correction.correction_status) === "approved" &&
  154:     asText(correction.flow_status) === "READY_TO_POST";
  155: 
  156:   const canPost = context.role === "admin_bumdes" && isReadyToPost;
  157: 
  158:   return (
  159:     <div className="space-y-5">
  160:       <div>
  161:         <Link
  162:           href="/bumdes/dashboard/koreksi-transaksi"
  163:           className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
  164:         >
  165:           <ArrowLeft className="h-4 w-4" />
  166:           Kembali ke daftar koreksi
  167:         </Link>
  168:       </div>
  169: 
  170:       <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  171:         <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
  172:           <div>
  173:             <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
  174:               Admin BUMDes / Detail Koreksi Transaksi
  175:             </p>
  176: 
  177:             <h1 className="mt-2 text-2xl font-bold text-slate-950">
  178:               {asText(correction.correction_no)}
```

File: `src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx`

Mulai sekitar line: 142

```tsx
  134:   const { data: lineData } = await supabase
  135:     .from("v_journal_correction_line_comparison")
  136:     .select("*")
  137:     .eq("correction_id", correctionId)
  138:     .order("journal_role_order", { ascending: true })
  139:     .order("line_no", { ascending: true });
  140: 
  141:   const { data: timelineData } = await supabase
  142:     .from("v_journal_correction_governance_timeline")
  143:     .select("*")
  144:     .eq("correction_id", correctionId)
  145:     .order("timeline_order", { ascending: true })
  146:     .order("event_at", { ascending: true });
  147: 
  148:   const lineRows = ((lineData ?? []) as unknown) as AnyRow[];
  149:   const timelineRows = ((timelineData ?? []) as unknown) as AnyRow[];
  150: 
  151:   const isPendingApproval =
  152:     asText(correction.correction_status) === "pending_approval";
  153: 
  154:   return (
  155:     <div className="space-y-5">
  156:       <div>
  157:         <Link
  158:           href="/pengawas/dashboard/koreksi-transaksi"
  159:           className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
  160:         >
  161:           <ArrowLeft className="h-4 w-4" />
  162:           Kembali ke daftar koreksi
  163:         </Link>
  164:       </div>
  165: 
  166:       <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  167:         <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
  168:           <div>
  169:             <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
  170:               Pengawas / Detail Koreksi Transaksi
  171:             </p>
  172: 
  173:             <h1 className="mt-2 text-2xl font-bold text-slate-950">
  174:               {asText(correction.correction_no)}
  175:             </h1>
  176: 
  177:             <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
```

## `v_journal_correction_line_comparison`

File: `src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx`

Mulai sekitar line: 136

```tsx
  128: 
  129:   if (!correctionData) {
  130:     notFound();
  131:   }
  132: 
  133:   const correction = correctionData as unknown as AnyRow;
  134: 
  135:   const { data: lineData } = await supabase
  136:     .from("v_journal_correction_line_comparison")
  137:     .select("*")
  138:     .eq("correction_id", correctionId)
  139:     .order("journal_role_order", { ascending: true })
  140:     .order("line_no", { ascending: true });
  141: 
  142:   const { data: timelineData } = await supabase
  143:     .from("v_journal_correction_governance_timeline")
  144:     .select("*")
  145:     .eq("correction_id", correctionId)
  146:     .order("timeline_order", { ascending: true })
  147:     .order("event_at", { ascending: true });
  148: 
  149:   const lineRows = ((lineData ?? []) as unknown) as AnyRow[];
  150:   const timelineRows = ((timelineData ?? []) as unknown) as AnyRow[];
  151: 
  152:   const isReadyToPost =
  153:     asText(correction.correction_status) === "approved" &&
  154:     asText(correction.flow_status) === "READY_TO_POST";
  155: 
  156:   const canPost = context.role === "admin_bumdes" && isReadyToPost;
  157: 
  158:   return (
  159:     <div className="space-y-5">
  160:       <div>
  161:         <Link
  162:           href="/bumdes/dashboard/koreksi-transaksi"
  163:           className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
  164:         >
  165:           <ArrowLeft className="h-4 w-4" />
  166:           Kembali ke daftar koreksi
  167:         </Link>
  168:       </div>
  169: 
  170:       <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  171:         <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
```

File: `src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx`

Mulai sekitar line: 135

```tsx
  127: 
  128:   if (!correctionData) {
  129:     notFound();
  130:   }
  131: 
  132:   const correction = correctionData as unknown as AnyRow;
  133: 
  134:   const { data: lineData } = await supabase
  135:     .from("v_journal_correction_line_comparison")
  136:     .select("*")
  137:     .eq("correction_id", correctionId)
  138:     .order("journal_role_order", { ascending: true })
  139:     .order("line_no", { ascending: true });
  140: 
  141:   const { data: timelineData } = await supabase
  142:     .from("v_journal_correction_governance_timeline")
  143:     .select("*")
  144:     .eq("correction_id", correctionId)
  145:     .order("timeline_order", { ascending: true })
  146:     .order("event_at", { ascending: true });
  147: 
  148:   const lineRows = ((lineData ?? []) as unknown) as AnyRow[];
  149:   const timelineRows = ((timelineData ?? []) as unknown) as AnyRow[];
  150: 
  151:   const isPendingApproval =
  152:     asText(correction.correction_status) === "pending_approval";
  153: 
  154:   return (
  155:     <div className="space-y-5">
  156:       <div>
  157:         <Link
  158:           href="/pengawas/dashboard/koreksi-transaksi"
  159:           className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
  160:         >
  161:           <ArrowLeft className="h-4 w-4" />
  162:           Kembali ke daftar koreksi
  163:         </Link>
  164:       </div>
  165: 
  166:       <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  167:         <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
  168:           <div>
  169:             <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
  170:               Pengawas / Detail Koreksi Transaksi
```

## `v_purchase_invoice_payables`

File: `src\app\unit\dashboard\catat-transaksi\_components\supplier-payment-entry-form.tsx`

Mulai sekitar line: 53

```tsx
   45:   if (!context?.tenant_id || !context.unit_id) {
   46:     redirect("/login");
   47:   }
   48: 
   49:   const supabase = await createClient();
   50: 
   51:   const [payableResult, cashBankResult, balanceResult] = await Promise.all([
   52:     supabase
   53:       .from("v_purchase_invoice_payables")
   54:       .select(
   55:         "purchase_invoice_id, supplier_name, invoice_no, invoice_date, due_date, total_amount, payment_amount, outstanding_amount, payable_status"
   56:       )
   57:       .eq("tenant_id", context.tenant_id)
   58:       .eq("unit_id", context.unit_id)
   59:       .gt("outstanding_amount", 0)
   60:       .order("invoice_date", { ascending: true })
   61:       .order("invoice_no", { ascending: true }),
   62: 
   63:     supabase
   64:       .from("cash_bank_accounts")
   65:       .select("id, account_code, account_name, account_kind")
   66:       .eq("tenant_id", context.tenant_id)
   67:       .eq("unit_id", context.unit_id)
   68:       .eq("is_active", true)
   69:       .order("account_code", { ascending: true }),
   70: 
   71:     supabase
   72:       .from("v_cash_bank_balance")
   73:       .select("cash_bank_account_id, current_balance")
   74:       .eq("tenant_id", context.tenant_id)
   75:       .eq("unit_id", context.unit_id),
   76:   ]);
   77: 
   78:   if (payableResult.error) throw new Error(payableResult.error.message);
   79:   if (cashBankResult.error) throw new Error(cashBankResult.error.message);
   80:   if (balanceResult.error) throw new Error(balanceResult.error.message);
   81: 
   82:   const payables = (payableResult.data ?? []) as PayableInvoice[];
   83:   const cashBankAccounts = (cashBankResult.data ?? []) as CashBankAccount[];
   84:   const balances = (balanceResult.data ?? []) as CashBankBalance[];
   85: 
   86:   const balanceByAccount = new Map(
   87:     balances.map((balance) => [
   88:       balance.cash_bank_account_id,
```

## `v_unit_financial_health_scoring`

File: `src\app\unit\dashboard\reports\skoring\page.tsx`

Mulai sekitar line: 368

```tsx
  360:   }
  361: 
  362:   const params = searchParams ? await searchParams : {};
  363:   const selectedYear = getYearParam(params);
  364: 
  365:   const supabase = await createClient();
  366: 
  367:   const { data, error } = await supabase
  368:     .from("v_unit_financial_health_scoring")
  369:     .select(
  370:       "kode_bumdes, nama_bumdes, nama_desa, nama_kecamatan, kode_unit, nama_unit, report_year, total_pendapatan, total_hpp, laba_kotor, total_beban, laba_rugi_bersih, total_aset, total_kewajiban, total_ekuitas, kas_setara_kas, piutang_usaha, persediaan, aset_lancar, kewajiban_lancar, total_penjualan_kredit, roe_percent, roi_percent, rasio_kas_percent, rasio_lancar_percent, collection_period_days, inventory_turnover_days, total_asset_turnover_percent, owner_equity_to_asset_percent, roe_max_score, roe_score, roi_max_score, roi_score, rasio_kas_max_score, rasio_kas_score, rasio_lancar_max_score, rasio_lancar_score, collection_period_max_score, collection_period_score, inventory_turnover_max_score, inventory_turnover_score, total_asset_turnover_max_score, total_asset_turnover_score, owner_equity_to_asset_max_score, owner_equity_to_asset_score, total_score, max_score, health_status, accounting_consistency_status"
  371:     )
  372:     .eq("tenant_id", context.tenant_id)
  373:     .eq("unit_id", context.unit_id)
  374:     .eq("report_year", selectedYear)
  375:     .maybeSingle();
  376: 
  377:   const scoring = data as HealthScoringRow | null;
  378: 
  379:   const totalScore = scoring?.total_score ?? 0;
  380:   const maxScore = scoring?.max_score ?? 100;
  381:   const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  382:   const healthStatus = scoring?.health_status ?? "Belum Ada Data";
  383:   const statusTheme = getStatusTheme(healthStatus);
  384:   const StatusIcon = statusTheme.icon;
  385: 
  386:   const indicators: IndicatorRow[] = scoring
  387:     ? [
  388:         {
  389:           no: 1,
  390:           name: "Imbalan kepada Pemilik / ROE",
  391:           value: formatPercent(scoring.roe_percent),
  392:           score: scoring.roe_score ?? 0,
  393:           maxScore: scoring.roe_max_score ?? 29,
  394:           note: "Laba bersih dibandingkan total ekuitas/modal pemilik.",
  395:         },
  396:         {
  397:           no: 2,
  398:           name: "Imbalan Investasi / ROI",
  399:           value: formatPercent(scoring.roi_percent),
  400:           score: scoring.roi_score ?? 0,
  401:           maxScore: scoring.roi_max_score ?? 22,
  402:           note: "Laba bersih dibandingkan total aset.",
  403:         },
```

File: `src\app\unit\dashboard\reports\skoring\page.tsx`

Mulai sekitar line: 712

```tsx
  704:                       </p>
  705:                       <p className="mt-1 text-sm leading-6 text-emerald-800">
  706:                         Status neraca:{" "}
  707:                         <span className="font-bold">
  708:                           {scoring.accounting_consistency_status ?? "-"}
  709:                         </span>
  710:                         . Dashboard ini membaca view{" "}
  711:                         <span className="font-bold">
  712:                           v_unit_financial_health_scoring
  713:                         </span>
  714:                         , sehingga rumus tetap berada di database.
  715:                       </p>
  716:                     </div>
  717:                   </div>
  718:                 </div>
  719:               </div>
  720:             </Card>
  721:           </section>
  722: 
  723:           <Card className="border-blue-100 bg-blue-50">
  724:             <div className="flex items-start gap-3">
  725:               <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700">
  726:                 <Gauge className="h-5 w-5" />
  727:               </div>
  728: 
  729:               <div>
  730:                 <p className="text-sm font-bold text-blue-900">
  731:                   Visual baru skoring
  732:                 </p>
  733:                 <p className="mt-2 text-sm leading-6 text-blue-800">
  734:                   Kartu gauge kini memakai jarum animatif yang bergerak sesuai
  735:                   skor. Kotak visual kanan kini memakai line chart untuk
  736:                   memperjelas pola capaian skor per indikator. Jika nanti ingin
  737:                   line chart bulanan real, kita bisa lanjutkan dari view bulanan.
  738:                 </p>
  739:               </div>
  740:             </div>
  741:           </Card>
  742:         </>
  743:       ) : null}
  744:     </div>
  745:   );
  746: }
  747: 
```

