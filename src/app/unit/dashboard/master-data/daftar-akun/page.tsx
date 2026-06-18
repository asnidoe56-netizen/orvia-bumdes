import { ResponsiveTableShell } from "@/components/ui/responsive-table-shell";
export const dynamic = "force-dynamic";

import { BookOpen, CheckCircle2, CircleSlash } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type CoaAccount = {
  id: string;
  tenant_id: string | null;
  unit_id: string | null;
  parent_id: string | null;
  kode: string;
  nama: string;
  tipe: string | null;
  account_type: string | null;
  normal_balance: string | null;
  is_postable: boolean;
  is_active: boolean;
};

function formatAccountType(value: string | null) {
  const labels: Record<string, string> = {
    ASET: "Aset",
    KEWAJIBAN: "Kewajiban",
    EKUITAS: "Ekuitas",
    PENDAPATAN: "Pendapatan",
    HPP: "Harga Pokok Penjualan",
    BEBAN: "Beban",
  };

  return labels[value ?? ""] ?? value ?? "-";
}

function formatCoaType(value: string | null) {
  const labels: Record<string, string> = {
    aset: "Aset",
    kewajiban: "Kewajiban",
    ekuitas: "Ekuitas",
    pendapatan: "Pendapatan",
    beban: "Beban",
  };

  return labels[value ?? ""] ?? value ?? "-";
}

function formatNormalBalance(value: string | null) {
  if (value === "debit") return "Debit";
  if (value === "credit") return "Kredit";
  return "-";
}

function getAccountTypeBadgeClass(value: string | null) {
  if (value === "ASET") return "bg-emerald-50 text-emerald-700";
  if (value === "KEWAJIBAN") return "bg-amber-50 text-amber-700";
  if (value === "EKUITAS") return "bg-sky-50 text-sky-700";
  if (value === "PENDAPATAN") return "bg-violet-50 text-violet-700";
  if (value === "HPP") return "bg-orange-50 text-orange-700";
  if (value === "BEBAN") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

export default async function UnitDaftarAkunPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: accounts, error } = await supabase
    .from("chart_of_accounts")
    .select(
      "id, tenant_id, unit_id, parent_id, kode, nama, tipe, account_type, normal_balance, is_postable, is_active"
    )
    .eq("tenant_id", context.tenant_id)
    .or("unit_id.is.null,unit_id.eq." + context.unit_id)
    .order("kode", { ascending: true });

  if (error) {
    throw new Error(error.message || "Daftar akun gagal dimuat.");
  }

  const accountList = (accounts ?? []) as CoaAccount[];
  const activeCount = accountList.filter((account) => account.is_active).length;
  const postableCount = accountList.filter((account) => account.is_postable).length;
  const headerCount = accountList.filter((account) => !account.is_postable).length;

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/master-data" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Master Data / Daftar Akun
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Daftar Akun</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Lihat daftar akun yang menjadi dasar pencatatan transaksi dan
              laporan unit. Halaman ini bersifat baca saja agar fondasi akun
              tetap dikendalikan oleh database.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <BookOpen className="h-4 w-4" />
                Total Akun
              </div>
              <div className="mt-1 text-xl font-black">{accountList.length}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <CheckCircle2 className="h-4 w-4" />
                Aktif
              </div>
              <div className="mt-1 text-xl font-black">{activeCount}</div>
            </div>

            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sky-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <CircleSlash className="h-4 w-4" />
                Header
              </div>
              <div className="mt-1 text-xl font-black">{headerCount}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <strong>Catatan:</strong> akun header tidak dipakai langsung untuk
          transaksi. Transaksi hanya memakai akun detail yang berstatus bisa
          posting. Total akun detail saat ini: <strong>{postableCount}</strong>.
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <BookOpen className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Daftar Akun Unit
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Akun BUMDes dan akun unit ditampilkan dalam satu daftar berdasarkan
              kode akun.
            </p>
          </div>
        </div>

        <div className="space-y-3 xl:hidden">
          {accountList.length > 0 ? (
            accountList.map((account) => (
              <article
                key={account.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      {account.kode}
                    </p>
                    <h3 className="mt-1 break-words text-base font-black text-slate-950">
                      {account.nama}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCoaType(account.tipe)} ·{" "}
                      {formatNormalBalance(account.normal_balance)}
                    </p>
                  </div>

                  <span
                    className={
                      account.is_active
                        ? "shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                        : "shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                    }
                  >
                    {account.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Kelompok
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {formatAccountType(account.account_type)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Scope
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {account.unit_id ? "Unit Usaha" : "BUMDes"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Posting
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {account.is_postable ? "Bisa dipakai transaksi" : "Header"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Saldo Normal
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {formatNormalBalance(account.normal_balance)}
                    </p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Belum ada akun yang bisa ditampilkan untuk unit ini.
            </div>
          )}
        </div>

        <ResponsiveTableShell className="hidden xl:block">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama Akun</th>
                <th className="px-4 py-3">Kelompok</th>
                <th className="px-4 py-3">Tipe DB</th>
                <th className="px-4 py-3">Saldo Normal</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Posting</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {accountList.length > 0 ? (
                accountList.map((account) => (
                  <tr key={account.id} className="align-top">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {account.kode}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {account.nama}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Parent: {account.parent_id ? "Ada" : "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "rounded-full px-3 py-1 text-xs font-bold " +
                          getAccountTypeBadgeClass(account.account_type)
                        }
                      >
                        {formatAccountType(account.account_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatCoaType(account.tipe)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatNormalBalance(account.normal_balance)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {account.unit_id ? "Unit Usaha" : "BUMDes"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          account.is_postable
                            ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                            : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                        }
                      >
                        {account.is_postable ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <CircleSlash className="h-3.5 w-3.5" />
                        )}
                        {account.is_postable ? "Bisa" : "Header"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          account.is_active
                            ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                            : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                        }
                      >
                        {account.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Belum ada akun yang bisa ditampilkan untuk unit ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ResponsiveTableShell>
      </section>
    </div>
  );
}
