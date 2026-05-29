export const dynamic = "force-dynamic";

import { ArrowLeft, CheckCircle2, PlayCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import {
  approveProfitSharingAction,
  calculateAnnualClosingAction,
  calculateProfitSharingAction,
  distributeProfitSharingAction,
  postAnnualClosingAction,
  postProfitSharingAllocationAction,
} from "./actions";

type AnnualClosingRow = {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  closing_year: number;
  status: string;
  journal_entry_id: string | null;
  surplus_deficit: number | string | null;
};

type AllocationRow = {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  annual_closing_id: string;
  allocation_no: string;
  status: string;
  journal_entry_id: string | null;
  surplus_amount: number | string | null;
};

type SummaryRow = {
  allocation_id: string;
  summary_status: string;
  total_remaining_amount: number | string | null;
};

type SchemeRow = {
  id: string;
  scheme_code: string;
  scheme_name: string;
};

type BusinessUnitRow = {
  id: string;
  kode_unit: string;
  nama_unit: string;
};
type CashBankRow = {
  id: string;
  account_code: string;
  account_name: string;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function label(status: string | null | undefined) {
  if (status === "posted") return "Posted";
  if (status === "approved") return "Disetujui";
  if (status === "calculated") return "Dihitung";
  if (status === "selesai") return "Selesai";
  if (status === "sebagian") return "Sebagian";
  if (status === "belum_distribusi") return "Belum Distribusi";
  return status ?? "-";
}

export default async function BagiHasilProsesPage({
  searchParams,
}: {
  searchParams: Promise<{ closingId?: string; allocationId?: string }>;
}) {
  const params = await searchParams;
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  let closing: AnnualClosingRow | null = null;
  let allocation: AllocationRow | null = null;
  let summary: SummaryRow | null = null;

  if (params.allocationId) {
    const { data: allocationData, error: allocationError } = await supabase
      .from("profit_sharing_allocations")
      .select(
        "id, tenant_id, unit_id, annual_closing_id, allocation_no, status, journal_entry_id, surplus_amount"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("id", params.allocationId)
      .maybeSingle();

    if (allocationError) {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          {allocationError.message}
        </div>
      );
    }

    allocation = allocationData as AllocationRow | null;

    if (allocation) {
      const { data: closingData } = await supabase
        .from("annual_closings")
        .select(
          "id, tenant_id, unit_id, closing_year, status, journal_entry_id, surplus_deficit"
        )
        .eq("tenant_id", context.tenant_id)
        .eq("id", allocation.annual_closing_id)
        .maybeSingle();

      closing = closingData as AnnualClosingRow | null;

      const { data: summaryData } = await supabase
        .from("v_profit_sharing_allocation_summary")
        .select("allocation_id, summary_status, total_remaining_amount")
        .eq("tenant_id", context.tenant_id)
        .eq("allocation_id", allocation.id)
        .maybeSingle();

      summary = summaryData as SummaryRow | null;
    }
  }

  if (!allocation && params.closingId) {
    const { data: closingData, error: closingError } = await supabase
      .from("annual_closings")
      .select(
        "id, tenant_id, unit_id, closing_year, status, journal_entry_id, surplus_deficit"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("id", params.closingId)
      .maybeSingle();

    if (closingError) {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          {closingError.message}
        </div>
      );
    }

    closing = closingData as AnnualClosingRow | null;

    if (closing) {
      const { data: allocationData } = await supabase
        .from("profit_sharing_allocations")
        .select(
          "id, tenant_id, unit_id, annual_closing_id, allocation_no, status, journal_entry_id, surplus_amount"
        )
        .eq("tenant_id", context.tenant_id)
        .eq("annual_closing_id", closing.id)
        .neq("status", "cancelled")
        .maybeSingle();

      allocation = allocationData as AllocationRow | null;
    }
  }

  if (!closing) {
    const { data: unitData, error: unitError } = await supabase
      .from("business_units")
      .select("id, kode_unit, nama_unit")
      .eq("tenant_id", context.tenant_id)
      .eq("status", "aktif")
      .order("kode_unit", { ascending: true });

    const units = (unitData ?? []) as BusinessUnitRow[];
    const defaultYear = new Date().getFullYear() - 1;

    return (
      <div>
        <PageHeader
          breadcrumb="Direktur BUMDes / Bagi Hasil / Proses"
          title="Buat Tutup Tahun"
          description="Buat annual closing dari ledger posted. Nilai pendapatan, HPP, beban, dan surplus dihitung oleh engine database."
          action={
            <Link
              href="/bumdes/dashboard/bagi-hasil"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
          }
        />

        {unitError ? (
          <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
            Gagal membaca unit usaha: {unitError.message}
          </div>
        ) : null}

        <Card>
          <CardHeader
            title="Form Tutup Tahun"
            description="Pilih unit dan tahun tutup buku. Setelah dibuat, lanjutkan ke Posting Annual Closing."
            action={<Badge variant="warning">Belum Ada Proses</Badge>}
          />

          {units.length > 0 ? (
            <form action={calculateAnnualClosingAction} className="space-y-4 px-5 pb-5">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Unit Usaha
                </span>
                <select
                  name="unit_id"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                >
                  <option value="">Pilih unit usaha</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.kode_unit} - {unit.nama_unit}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Tahun Tutup Buku
                </span>
                <input
                  type="number"
                  name="closing_year"
                  required
                  min="2000"
                  max="2100"
                  defaultValue={defaultYear}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Catatan
                </span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Opsional. Contoh: Tutup tahun operasional 2026."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                />
              </label>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                Aksi ini hanya membuat data annual closing berdasarkan ledger posted.
                Posting jurnal tutup tahun dilakukan pada langkah berikutnya.
              </div>

              <Button type="submit">
                <PlayCircle className="mr-2 h-4 w-4" />
                Buat Tutup Tahun
              </Button>
            </form>
          ) : (
            <div className="px-5 pb-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                Belum ada unit usaha aktif untuk BUMDes ini. Buat unit usaha terlebih dahulu sebelum membuat tutup tahun.
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  let schemeQuery = supabase
    .from("profit_sharing_schemes")
    .select("id, scheme_code, scheme_name")
    .eq("tenant_id", context.tenant_id)
    .eq("is_active", true)
    .order("scheme_code", { ascending: true });

  schemeQuery = closing.unit_id
    ? schemeQuery.eq("unit_id", closing.unit_id)
    : schemeQuery.is("unit_id", null);

  const { data: schemesData, error: schemesError } = await schemeQuery;
  const schemes = (schemesData ?? []) as SchemeRow[];

  let cashQuery = supabase
    .from("cash_bank_accounts")
    .select("id, account_code, account_name")
    .eq("tenant_id", context.tenant_id)
    .eq("is_active", true)
    .order("account_code", { ascending: true });

  cashQuery = closing.unit_id
    ? cashQuery.eq("unit_id", closing.unit_id)
    : cashQuery.is("unit_id", null);

  const { data: cashData, error: cashError } = await cashQuery;
  const cashAccounts = (cashData ?? []) as CashBankRow[];
  const kasAlokasiAccounts = cashAccounts.filter(
    (item) => item.account_code === "KAS-ALOKASI-BH"
  );

  const canPostClosing =
    closing.status !== "posted" || !closing.journal_entry_id;

  const canCalculate = closing.status === "posted" && !allocation;

  const canApprove = allocation?.status === "calculated";

  const canPostAllocation = allocation?.status === "approved";

  const canDistribute =
    allocation?.status === "posted" &&
    toNumber(summary?.total_remaining_amount) > 0;

  const isComplete =
    allocation?.status === "posted" &&
    summary?.summary_status === "selesai" &&
    toNumber(summary?.total_remaining_amount) === 0;

  const pageError = schemesError?.message || cashError?.message;

  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Bagi Hasil / Proses"
        title="Proses Bagi Hasil"
        description={`Tahun tutup buku ${closing.closing_year}. Tombol aksi hanya muncul sesuai status database.`}
        action={
          <Link
            href="/bumdes/dashboard/bagi-hasil"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        }
      />

      {pageError ? (
        <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          Gagal membaca data pendukung: {pageError}
        </div>
      ) : null}

      <Card className="mb-5">
        <CardHeader
          title="Status Workflow"
          description="Periksa status sebelum menjalankan aksi."
          action={
            <Badge variant={isComplete ? "success" : "warning"}>
              {isComplete ? "Selesai" : "Perlu Proses"}
            </Badge>
          }
        />

        <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Tahun
            </p>
            <p className="mt-2 text-lg font-black text-slate-950">
              {closing.closing_year}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Annual Closing
            </p>
            <p className="mt-2 font-bold text-slate-950">
              {label(closing.status)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Surplus
            </p>
            <p className="mt-2 font-bold text-slate-950">
              {rupiah(closing.surplus_deficit)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Alokasi
            </p>
            <p className="mt-2 font-bold text-slate-950">
              {allocation?.allocation_no ?? "Belum ada"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {canPostClosing ? (
          <Card>
            <CardHeader
              title="Posting Annual Closing"
              description="Menutup akun laba rugi ke Saldo Laba Ditahan."
              action={<Badge variant="warning">Aksi Tersedia</Badge>}
            />

            <form action={postAnnualClosingAction} className="px-5 pb-5">
              <input type="hidden" name="annual_closing_id" value={closing.id} />

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                Pastikan laporan laba rugi sudah benar sebelum diposting.
              </div>

              <Button type="submit" className="mt-4">
                <PlayCircle className="mr-2 h-4 w-4" />
                Posting Annual Closing
              </Button>
            </form>
          </Card>
        ) : null}

        {canCalculate ? (
          <Card>
            <CardHeader
              title="Hitung Bagi Hasil"
              description="Membuat alokasi berdasarkan skema aktif."
              action={<Badge variant="warning">Aksi Tersedia</Badge>}
            />

            <form
              action={calculateProfitSharingAction}
              className="space-y-4 px-5 pb-5"
            >
              <input type="hidden" name="annual_closing_id" value={closing.id} />

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Skema Bagi Hasil
                </span>
                <select
                  name="scheme_id"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                >
                  <option value="">Pilih skema</option>
                  {schemes.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.scheme_code} - {scheme.scheme_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Nomor Alokasi
                </span>
                <input
                  name="allocation_no"
                  placeholder={`BH-${closing.closing_year}-001`}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Tanggal Alokasi
                </span>
                <input
                  type="date"
                  name="allocation_date"
                  required
                  defaultValue={today()}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                />
              </label>

              <Button type="submit">
                <PlayCircle className="mr-2 h-4 w-4" />
                Hitung Bagi Hasil
              </Button>
            </form>
          </Card>
        ) : null}

        {canApprove && allocation ? (
          <Card>
            <CardHeader
              title="Setujui Bagi Hasil"
              description="Mengunci hasil perhitungan sebelum posting."
              action={<Badge variant="warning">Aksi Tersedia</Badge>}
            />

            <form action={approveProfitSharingAction} className="px-5 pb-5">
              <input type="hidden" name="allocation_id" value={allocation.id} />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                Alokasi {allocation.allocation_no} akan disetujui.
              </div>

              <Button type="submit" className="mt-4">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Setujui Bagi Hasil
              </Button>
            </form>
          </Card>
        ) : null}

        {canPostAllocation && allocation ? (
          <Card>
            <CardHeader
              title="Posting Bagi Hasil"
              description="Membuat jurnal alokasi Bagi Hasil."
              action={<Badge variant="warning">Aksi Tersedia</Badge>}
            />

            <form
              action={postProfitSharingAllocationAction}
              className="px-5 pb-5"
            >
              <input type="hidden" name="allocation_id" value={allocation.id} />

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                Setelah diposting, alokasi masuk jurnal dan tidak boleh diubah
                langsung.
              </div>

              <Button type="submit" className="mt-4">
                <PlayCircle className="mr-2 h-4 w-4" />
                Posting Bagi Hasil
              </Button>
            </form>
          </Card>
        ) : null}

        {canDistribute && allocation ? (
          <Card>
            <CardHeader
              title="Distribusikan Bagi Hasil"
              description="Memproses pembayaran keluar dan transfer internal cadangan modal."
              action={<Badge variant="warning">Aksi Tersedia</Badge>}
            />

            <form
              action={distributeProfitSharingAction}
              className="space-y-4 px-5 pb-5"
            >
              <input type="hidden" name="allocation_id" value={allocation.id} />

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Tanggal Distribusi
                </span>
                <input
                  type="date"
                  name="distribution_date"
                  required
                  defaultValue={today()}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Kas/Bank Sumber
                </span>
                <select
                  name="source_cash_bank_account_id"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                >
                  <option value="">Pilih kas/bank sumber</option>
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_code} - {account.account_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Kas Tujuan Cadangan Modal
                </span>
                <select
                  name="destination_cash_bank_account_id"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                >
                  <option value="">Pilih jika ada alokasi internal modal</option>
                  {kasAlokasiAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_code} - {account.account_name}
                    </option>
                  ))}
                </select>
              </label>

              <Button type="submit">
                <PlayCircle className="mr-2 h-4 w-4" />
                Distribusikan Bagi Hasil
              </Button>
            </form>
          </Card>
        ) : null}

        {isComplete ? (
          <Card>
            <CardHeader
              title="Workflow Selesai"
              description="Tidak ada aksi lanjutan untuk tahun ini."
              action={<Badge variant="success">Selesai</Badge>}
            />

            <div className="px-5 pb-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                Annual closing, alokasi, posting, dan distribusi sudah selesai.
              </div>

              {allocation ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/bumdes/dashboard/bagi-hasil/${allocation.id}`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                  >
                    Lihat Detail
                  </Link>
                  <Link
                    href={`/bumdes/dashboard/bagi-hasil/${allocation.id}?print=1`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                  >
                    Cetak
                  </Link>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

