export const dynamic = "force-dynamic";

import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  WalletCards,
} from "lucide-react";
import { redirect } from "next/navigation";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { ResponsiveRecordList } from "@/components/ui/responsive-record-list";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { postMonthlyFixedAssetDepreciation } from "./_actions/fixed-asset-actions";

type FixedAssetSummary = {
  fixed_asset_id: string;
  asset_code: string;
  asset_name: string;
  acquisition_date: string;
  acquisition_cost: number | string;
  residual_value: number | string;
  useful_life_months: number;
  asset_status: string;
  asset_account_code: string | null;
  asset_account_name: string | null;
  accumulated_depreciation_total: number | string;
  current_book_value: number | string;
  last_depreciation_date: string | null;
  posted_depreciation_count: number;
  posted_journal_count: number;
  current_period_year: number | null;
  current_period_month: number | null;
  current_period_status: string | null;
  depreciation_readiness_status: string;
  monthly_depreciation_estimate: number | string;
  created_at: string;
};

function formatRupiah(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPeriod(year: number | null, month: number | null) {
  if (!year || !month) return "-";
  return `${year}-${String(month).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: string }) {
  const isDone = status.startsWith("DONE");
  const isReady = status === "READY";
  const isActive = status === "active";

  if (isDone) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        Sudah disusutkan
      </span>
    );
  }

  if (isReady) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
        Siap disusutkan
      </span>
    );
  }

  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
      {status}
    </span>
  );
}

export default async function FixedAssetsPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_fixed_asset_depreciation_summary")
    .select(`
      fixed_asset_id,
      asset_code,
      asset_name,
      acquisition_date,
      acquisition_cost,
      residual_value,
      useful_life_months,
      asset_status,
      asset_account_code,
      asset_account_name,
      accumulated_depreciation_total,
      current_book_value,
      last_depreciation_date,
      posted_depreciation_count,
      posted_journal_count,
      current_period_year,
      current_period_month,
      current_period_status,
      depreciation_readiness_status,
      monthly_depreciation_estimate,
      created_at
    `)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const assets = (data ?? []) as FixedAssetSummary[];
  const totalAssets = assets.length;
  const activeAssets = assets.filter((asset) => asset.asset_status === "active").length;
  const readyAssets = assets.filter(
    (asset) => asset.depreciation_readiness_status === "READY"
  ).length;
  const doneThisPeriod = assets.filter((asset) =>
    asset.depreciation_readiness_status.startsWith("DONE")
  ).length;

  const totalAcquisitionCost = assets.reduce(
    (sum, asset) => sum + Number(asset.acquisition_cost ?? 0),
    0
  );
  const totalAccumulatedDepreciation = assets.reduce(
    (sum, asset) => sum + Number(asset.accumulated_depreciation_total ?? 0),
    0
  );
  const totalBookValue = assets.reduce(
    (sum, asset) => sum + Number(asset.current_book_value ?? 0),
    0
  );

  const firstAsset = assets[0];
  const currentPeriodLabel = firstAsset
    ? formatPeriod(firstAsset.current_period_year, firstAsset.current_period_month)
    : "-";

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Dashboard Unit / Aset Tetap
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Aset Tetap
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Daftar aset unit, nilai buku, dan status penyusutan periode
              berjalan. Data penyusutan diproses oleh engine database dan
              otomatis membentuk jurnal.
            </p>
          </div>

          <form
            action={postMonthlyFixedAssetDepreciation}
            className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"
          >
            <label
              htmlFor="depreciation_date"
              className="text-xs font-bold uppercase tracking-wide text-emerald-800"
            >
              Tanggal Penyusutan
            </label>

            <input
              id="depreciation_date"
              name="depreciation_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-emerald-500"
            />

            <button
              type="submit"
              className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
            >
              Proses Penyusutan Bulanan
            </button>

            <p className="mt-2 text-xs leading-5 text-emerald-800">
              Periode berjalan: {currentPeriodLabel}. Aset siap disusutkan:{" "}
              {readyAssets}.
            </p>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Total Aset</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {totalAssets}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Aset aktif: {activeAssets}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Nilai Perolehan
              </p>
              <p className="mt-2 text-xl font-bold text-slate-950">
                {formatRupiah(totalAcquisitionCost)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Total harga perolehan.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <WalletCards className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Akumulasi Susut
              </p>
              <p className="mt-2 text-xl font-bold text-slate-950">
                {formatRupiah(totalAccumulatedDepreciation)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Total penyusutan posted.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FileText className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Nilai Buku</p>
              <p className="mt-2 text-xl font-bold text-slate-950">
                {formatRupiah(totalBookValue)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Nilai aset saat ini.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Periode Ini
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {doneThisPeriod}/{totalAssets}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Sudah disusutkan.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Daftar Aset Unit
            </h2>
            <p className="text-sm text-slate-600">
              Menampilkan aset dari view v_fixed_asset_depreciation_summary.
            </p>
          </div>
        </div>

        <ResponsiveRecordList
          items={assets}
          getKey={(asset) => asset.fixed_asset_id}
          emptyState={
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Belum ada aset tetap.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Aset akan muncul setelah transaksi Belanja Modal berhasil diposting.
              </p>
            </div>
          }
          renderMobileCard={(asset) => (
            <MobileRecordCard
              title={asset.asset_name}
              subtitle={`${asset.asset_code} · ${formatDate(asset.acquisition_date)}`}
              badge={<StatusBadge status={asset.depreciation_readiness_status} />}
              rows={[
                {
                  label: "Kategori Akun",
                  value:
                    asset.asset_account_code && asset.asset_account_name
                      ? `${asset.asset_account_code} - ${asset.asset_account_name}`
                      : "-",
                  fullWidth: true,
                },
                {
                  label: "Nilai Perolehan",
                  value: formatRupiah(asset.acquisition_cost),
                },
                {
                  label: "Akumulasi Susut",
                  value: formatRupiah(asset.accumulated_depreciation_total),
                },
                {
                  label: "Nilai Buku",
                  value: formatRupiah(asset.current_book_value),
                },
                {
                  label: "Susut/Bulan",
                  value: formatRupiah(asset.monthly_depreciation_estimate),
                },
                {
                  label: "Terakhir Susut",
                  value: formatDate(asset.last_depreciation_date),
                  fullWidth: true,
                },
              ]}
            />
          )}
          renderDesktopTable={() => (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Kode Aset</th>
                      <th className="px-4 py-3">Nama Aset</th>
                      <th className="px-4 py-3">Kategori Akun</th>
                      <th className="px-4 py-3">Tanggal Perolehan</th>
                      <th className="px-4 py-3 text-right">Nilai Perolehan</th>
                      <th className="px-4 py-3 text-right">Akumulasi Susut</th>
                      <th className="px-4 py-3 text-right">Nilai Buku</th>
                      <th className="px-4 py-3 text-right">Susut/Bulan</th>
                      <th className="px-4 py-3">Terakhir Susut</th>
                      <th className="px-4 py-3">Status Periode</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {assets.map((asset) => (
                      <tr key={asset.fixed_asset_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {asset.asset_code}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {asset.asset_name}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {asset.asset_account_code && asset.asset_account_name
                            ? `${asset.asset_account_code} - ${asset.asset_account_name}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatDate(asset.acquisition_date)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {formatRupiah(asset.acquisition_cost)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatRupiah(asset.accumulated_depreciation_total)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {formatRupiah(asset.current_book_value)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatRupiah(asset.monthly_depreciation_estimate)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatDate(asset.last_depreciation_date)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={asset.depreciation_readiness_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        />
      </section>
    </div>
  );
}
