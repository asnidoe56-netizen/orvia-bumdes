export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import {
  submitUnitCutoffMigrationAction,
  validateUnitCutoffMigrationAction,
} from "../actions";
import { CashBankLineForm } from "./cash-bank-line-form";
import { InventoryLineForm } from "./inventory-line-form";
import { FixedAssetLineForm } from "./fixed-asset-line-form";
import { OtherAssetLineForm } from "./other-asset-line-form";
import { EquityLineForm } from "./equity-line-form";

type AnyRow = Record<string, unknown>;

function asText(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function asNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function formatDate(value: unknown) {
  if (!value) return "-";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: unknown) {
  const value = asText(status, "draft");

  const labels: Record<string, string> = {
    draft: "Draft",
    validated: "Tervalidasi",
    submitted: "Diajukan",
    under_review: "Dalam Review",
    approved: "Disetujui",
    rejected: "Ditolak",
    posted: "Posted",
    cancelled: "Dibatalkan",
  };

  return labels[value] ?? value;
}

function StatusBadge({ status }: { status: unknown }) {
  const value = asText(status, "draft");

  if (value === "validated" || value === "approved" || value === "posted") {
    return <Badge variant="success">{statusLabel(value)}</Badge>;
  }

  if (value === "submitted" || value === "under_review") {
    return <Badge variant="warning">{statusLabel(value)}</Badge>;
  }

  if (value === "rejected" || value === "cancelled") {
    return <Badge variant="danger">{statusLabel(value)}</Badge>;
  }

  return <Badge variant="neutral">{statusLabel(value)}</Badge>;
}

function safeRows(data: unknown[] | null | undefined) {
  return ((data ?? []) as unknown) as AnyRow[];
}

export default async function UnitCutoffMigrasiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: cutoffMigrationId } = await params;

  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: headerData, error: headerError } = await supabase
    .from("unit_cutoff_migrations")
    .select("*")
    .eq("id", cutoffMigrationId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  if (headerError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Gagal membaca detail cut-off migrasi: {headerError.message}
      </div>
    );
  }

  if (!headerData) {
    notFound();
  }

  const header = headerData as AnyRow;
  const status = asText(header.status, "draft");

  const { data: cashBankOptionData, error: cashBankOptionError } = await supabase
    .from("cash_bank_accounts")
    .select("id, account_code, account_name, account_id, account_kind")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("account_code", { ascending: true });

  if (cashBankOptionError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Gagal membaca daftar kas-bank ORVIA: {cashBankOptionError.message}
      </div>
    );
  }

  const cashBankOptions = (cashBankOptionData ?? []).filter(
    (option) => option.account_id
  );

  const [
    cashBankResult,
    inventoryResult,
    assetResult,
    otherAssetResult,
    liabilityResult,
    equityResult,
    reconciliationResult,
    auditNoteResult,
  ] = await Promise.all([
    supabase
      .from("unit_cutoff_migration_cash_bank_lines")
      .select("*")
      .eq("cutoff_migration_id", cutoffMigrationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("unit_cutoff_migration_inventory_lines")
      .select("*")
      .eq("cutoff_migration_id", cutoffMigrationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("unit_cutoff_migration_asset_lines")
      .select("*")
      .eq("cutoff_migration_id", cutoffMigrationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("unit_cutoff_migration_other_asset_lines")
      .select("*")
      .eq("cutoff_migration_id", cutoffMigrationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("unit_cutoff_migration_liability_lines")
      .select("*")
      .eq("cutoff_migration_id", cutoffMigrationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("unit_cutoff_migration_equity_lines")
      .select("*")
      .eq("cutoff_migration_id", cutoffMigrationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("unit_cutoff_migration_reconciliation_lines")
      .select("*")
      .eq("cutoff_migration_id", cutoffMigrationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("unit_cutoff_migration_audit_notes")
      .select("*")
      .eq("cutoff_migration_id", cutoffMigrationId)
      .order("created_at", { ascending: true }),
  ]);

  const queryError =
    cashBankResult.error ||
    inventoryResult.error ||
    assetResult.error ||
    otherAssetResult.error ||
    liabilityResult.error ||
    equityResult.error ||
    reconciliationResult.error ||
    auditNoteResult.error;

  if (queryError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Gagal membaca komponen cut-off migrasi: {queryError.message}
      </div>
    );
  }

  const cashBankRows = safeRows(cashBankResult.data);
  const inventoryRows = safeRows(inventoryResult.data);
  const assetRows = safeRows(assetResult.data);
  const otherAssetRows = safeRows(otherAssetResult.data);
  const liabilityRows = safeRows(liabilityResult.data);
  const equityRows = safeRows(equityResult.data);
  const reconciliationRows = safeRows(reconciliationResult.data);
  const auditNoteRows = safeRows(auditNoteResult.data);

  const isDraft = status === "draft";
  const isValidated = status === "validated";
  const canValidate = status === "draft" || status === "rejected";
  const canSubmit = status === "validated";

  return (
    <div className="space-y-6">
      <PageBackButton
        fallbackHref="/unit/dashboard/cutoff-migrasi"
        label="Kembali ke Daftar Cut-off"
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Unit / Cut-off Migrasi / Detail
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {asText(header.cutoff_no)}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Detail draft migrasi saldo awal. Data belum masuk laporan resmi sampai
              proses validasi, pengajuan, review Pengawas, approval, dan posting selesai.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={header.status} />
            <Badge variant="neutral">
              Cut-off {formatDate(header.cutoff_date)}
            </Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Aset</p>
          <p className="mt-2 text-xl font-bold text-slate-950">
            {formatRupiah(header.total_assets)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kas, persediaan, aset tetap, dan aset lain.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Kewajiban</p>
          <p className="mt-2 text-xl font-bold text-slate-950">
            {formatRupiah(header.total_liabilities)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Utang dan kewajiban yang masih terbuka.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Ekuitas</p>
          <p className="mt-2 text-xl font-bold text-slate-950">
            {formatRupiah(header.total_equity)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Modal awal dan saldo laba sebelum ORVIA.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Mulai ORVIA</p>
          <p className="mt-2 text-xl font-bold text-slate-950">
            {formatDate(header.orvia_start_date)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tanggal awal pencatatan resmi di ORVIA.
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
        <Card>
          <CardHeader
            title="Informasi Draft"
            description="Identitas sumber migrasi dan status governance."
            action={<StatusBadge status={header.status} />}
          />

          <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Aplikasi Sumber
              </p>
              <p className="mt-2 font-bold text-slate-950">
                {asText(header.source_application_name)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Standar Sumber
              </p>
              <p className="mt-2 font-bold text-slate-950">
                {asText(header.source_standard)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Status Bagi Hasil Sebelum ORVIA
              </p>
              <p className="mt-2 font-bold text-slate-950">
                {asText(header.pre_orvia_profit_sharing_status)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Catatan
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                {asText(header.notes)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Aksi Governance"
            description="Validasi dan pengajuan mengikuti engine database."
            action={<StatusBadge status={header.status} />}
          />

          <div className="space-y-3 px-5 pb-5">
            {canValidate ? (
              <form action={validateUnitCutoffMigrationAction}>
                <input
                  type="hidden"
                  name="cutoff_migration_id"
                  value={cutoffMigrationId}
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
                >
                  Validasi Neraca Cut-off
                </button>
              </form>
            ) : null}

            {canSubmit ? (
              <form action={submitUnitCutoffMigrationAction}>
                <input
                  type="hidden"
                  name="cutoff_migration_id"
                  value={cutoffMigrationId}
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Ajukan ke Pengawas
                </button>
              </form>
            ) : null}

            {!canValidate && !canSubmit ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Status saat ini adalah{" "}
                <span className="font-bold text-slate-950">
                  {statusLabel(header.status)}
                </span>
                . Aksi berikutnya mengikuti alur governance.
              </div>
            ) : null}

            {isDraft ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                Draft masih bisa diisi komponen saldo. Setelah diajukan, detail akan
                terkunci oleh trigger database.
              </div>
            ) : null}

            {isValidated ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900">
                Draft sudah tervalidasi. Lanjutkan dengan pengajuan ke Pengawas.
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Kas & Bank"
          description="Saldo kas tunai dan rekening bank dari aplikasi lama."
          action={<Badge variant="neutral">{cashBankRows.length} baris</Badge>}
        />

        <CashBankLineForm
          cutoffMigrationId={cutoffMigrationId}
          options={cashBankOptions}
          canEdit={isDraft || status === "rejected"}
        />

        <DataTable
          columns={["Akun Lama", "Jenis", "Bank/Sumber", "Nominal", "Catatan"]}
          emptyText="Belum ada saldo kas-bank."
        >
          {cashBankRows.map((row, index) => (
            <tr key={`${asText(row.id)}-${index}`} className="hover:bg-slate-50">
              <td className="px-4 py-4">
                <div className="font-bold text-slate-950">
                  {asText(row.old_account_code)}
                </div>
                <div className="text-xs text-slate-500">
                  {asText(row.old_account_name)}
                </div>
              </td>
              <td className="px-4 py-4 font-semibold text-slate-700">
                {asText(row.cash_bank_kind)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {asText(row.source_bank_name)}
              </td>
              <td className="px-4 py-4 font-semibold text-slate-900">
                {formatRupiah(row.amount)}
              </td>
              <td className="px-4 py-4 text-slate-600">
                {asText(row.notes)}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title="Persediaan"
          description="Barang yang akan menjadi saldo awal inventory ORVIA."
          action={<Badge variant="neutral">{inventoryRows.length} baris</Badge>}
        />

        <InventoryLineForm
          cutoffMigrationId={cutoffMigrationId}
          canEdit={isDraft || status === "rejected"}
        />

        <DataTable
          columns={["Kode Barang", "Nama", "Satuan", "Qty", "Harga", "Total"]}
          emptyText="Belum ada saldo persediaan."
        >
          {inventoryRows.map((row, index) => (
            <tr key={`${asText(row.id)}-${index}`} className="hover:bg-slate-50">
              <td className="px-4 py-4 font-bold text-slate-950">
                {asText(row.item_code)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {asText(row.item_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {asText(row.unit_of_measure)}
              </td>
              <td className="px-4 py-4 font-semibold text-slate-700">
                {asText(row.quantity)}
              </td>
              <td className="px-4 py-4 font-semibold text-slate-700">
                {formatRupiah(row.unit_cost)}
              </td>
              <td className="px-4 py-4 font-semibold text-slate-900">
                {formatRupiah(row.total_cost)}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title="Aset Tetap"
          description="Aset tetap pembukaan yang akan masuk ke engine fixed asset."
          action={<Badge variant="neutral">{assetRows.length} baris</Badge>}
        />

        <FixedAssetLineForm
          cutoffMigrationId={cutoffMigrationId}
          canEdit={isDraft || status === "rejected"}
        />

        <DataTable
          columns={["Kode Aset", "Nama", "Tanggal", "Harga Perolehan", "Akumulasi", "Nilai Buku"]}
          emptyText="Belum ada aset tetap."
        >
          {assetRows.map((row, index) => (
            <tr key={`${asText(row.id)}-${index}`} className="hover:bg-slate-50">
              <td className="px-4 py-4 font-bold text-slate-950">
                {asText(row.asset_code)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {asText(row.asset_name)}
              </td>
              <td className="px-4 py-4 text-slate-700">
                {formatDate(row.acquisition_date)}
              </td>
              <td className="px-4 py-4 font-semibold text-slate-700">
                {formatRupiah(row.acquisition_cost)}
              </td>
              <td className="px-4 py-4 font-semibold text-slate-700">
                {formatRupiah(row.accumulated_amount)}
              </td>
              <td className="px-4 py-4 font-semibold text-slate-900">
                {formatRupiah(row.book_value)}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Aset Lain"
            description="Contoh: perlengkapan/ATK atau aset lancar lain hasil cut-off."
            action={<Badge variant="neutral">{otherAssetRows.length} baris</Badge>}
          />

          <OtherAssetLineForm
            cutoffMigrationId={cutoffMigrationId}
            canEdit={isDraft || status === "rejected"}
          />

          <DataTable
            columns={["Nama", "Akun Lama", "Nominal", "Catatan"]}
            emptyText="Belum ada aset lain."
          >
            {otherAssetRows.map((row, index) => (
              <tr key={`${asText(row.id)}-${index}`} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-bold text-slate-950">
                  {asText(row.item_name)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {asText(row.old_account_code)} {asText(row.old_account_name)}
                </td>
                <td className="px-4 py-4 font-semibold text-slate-900">
                  {formatRupiah(row.amount)}
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {asText(row.notes)}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card>
          <CardHeader
            title="Kewajiban"
            description="Utang dan kewajiban yang masih terbuka saat cut-off."
            action={<Badge variant="neutral">{liabilityRows.length} baris</Badge>}
          />

          <DataTable
            columns={["Nama", "Pihak", "Nominal", "Jatuh Tempo"]}
            emptyText="Belum ada kewajiban."
          >
            {liabilityRows.map((row, index) => (
              <tr key={`${asText(row.id)}-${index}`} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-bold text-slate-950">
                  {asText(row.liability_name)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {asText(row.counterparty_name)}
                </td>
                <td className="px-4 py-4 font-semibold text-slate-900">
                  {formatRupiah(row.amount)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {formatDate(row.due_date)}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Ekuitas"
          description="Modal awal dan saldo laba sebelum ORVIA sebagai penyeimbang neraca."
          action={<Badge variant="neutral">{equityRows.length} baris</Badge>}
        />

        <EquityLineForm
          cutoffMigrationId={cutoffMigrationId}
          canEdit={isDraft || status === "rejected"}
        />

        <DataTable
          columns={["Akun Lama", "Jenis Ekuitas", "Nominal", "Catatan"]}
          emptyText="Belum ada ekuitas."
        >
          {equityRows.map((row, index) => (
            <tr key={`${asText(row.id)}-${index}`} className="hover:bg-slate-50">
              <td className="px-4 py-4">
                <div className="font-bold text-slate-950">
                  {asText(row.old_account_code)}
                </div>
                <div className="text-xs text-slate-500">
                  {asText(row.old_account_name)}
                </div>
              </td>
              <td className="px-4 py-4 font-semibold text-slate-700">
                {asText(row.equity_source_type)}
              </td>
              <td className="px-4 py-4 font-semibold text-slate-900">
                {formatRupiah(row.amount)}
              </td>
              <td className="px-4 py-4 text-slate-600">
                {asText(row.notes)}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Rekonsiliasi"
            description="Pembanding angka laporan lama dengan angka hasil perhitungan ORVIA."
            action={<Badge variant="neutral">{reconciliationRows.length} baris</Badge>}
          />

          <DataTable
            columns={["Dokumen", "Metrik", "Dilaporkan", "Dihitung", "Selisih", "Status"]}
            emptyText="Belum ada rekonsiliasi."
          >
            {reconciliationRows.map((row, index) => (
              <tr key={`${asText(row.id)}-${index}`} className="hover:bg-slate-50">
                <td className="px-4 py-4 text-slate-700">
                  {asText(row.source_document)}
                </td>
                <td className="px-4 py-4 font-bold text-slate-950">
                  {asText(row.metric_name)}
                </td>
                <td className="px-4 py-4 font-semibold text-slate-700">
                  {formatRupiah(row.reported_amount)}
                </td>
                <td className="px-4 py-4 font-semibold text-slate-700">
                  {formatRupiah(row.calculated_amount)}
                </td>
                <td className="px-4 py-4 font-semibold text-slate-900">
                  {formatRupiah(row.difference_amount)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {asText(row.status)}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card>
          <CardHeader
            title="Catatan Audit"
            description="Catatan analisis dan dokumen pendukung migrasi."
            action={<Badge variant="neutral">{auditNoteRows.length} catatan</Badge>}
          />

          <div className="space-y-3 px-5 pb-5">
            {auditNoteRows.length > 0 ? (
              auditNoteRows.map((row, index) => (
                <div
                  key={`${asText(row.id)}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    {asText(row.note_kind)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {asText(row.note_body)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                Belum ada catatan audit.
              </div>
            )}
          </div>
        </Card>
      </section>

      <div className="flex justify-end">
        <Link
          href="/unit/dashboard/cutoff-migrasi"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Kembali ke Daftar
        </Link>
      </div>
    </div>
  );
}






