import { ResponsiveTableShell } from "@/components/ui/responsive-table-shell";
export const dynamic = "force-dynamic";

import { PlusCircle, Search, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createCustomerAction } from "./actions";

type Customer = {
  id: string;
  customer_code: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
};

export default async function MasterDataCustomersPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, customer_name, phone, email, address, is_active")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("customer_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const customers = (data ?? []) as Customer[];

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/master-data" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Master Data / Customer
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Customer
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Kelola data pelanggan sebagai referensi transaksi penjualan unit usaha.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <form
          action={createCustomerAction}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Form Customer
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Simpan data pelanggan unit. Data ini akan dipakai pada transaksi penjualan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Kode Customer
              </span>
              <input
                name="customer_code"
                required
                placeholder="Contoh: CUS-001"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nama Customer
              </span>
              <input
                name="customer_name"
                required
                placeholder="Nama pelanggan"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nomor Telepon
              </span>
              <input
                name="phone"
                placeholder="Nomor telepon"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Email
              </span>
              <input
                name="email"
                type="email"
                placeholder="email@contoh.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2 col-span-full">
              <span className="text-sm font-semibold text-slate-700">
                Alamat
              </span>
              <textarea
                name="address"
                rows={4}
                placeholder="Alamat customer"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end border-t border-slate-200 pt-5">
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              Simpan Customer
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Users className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Daftar Customer
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Total {customers.length} customer unit.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              Data aktif
            </div>
          </div>
          <div className="space-y-3 xl:hidden">
            {customers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Belum ada customer. Simpan customer pertama dari form di sebelah kiri.
              </div>
            ) : (
              customers.map((customer) => (
                <article
                  key={customer.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        {customer.customer_code}
                      </p>
                      <h3 className="mt-1 break-words text-base font-black text-slate-950">
                        {customer.customer_name}
                      </h3>
                    </div>

                    <span
                      className={
                        customer.is_active
                          ? "shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                          : "shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500"
                      }
                    >
                      {customer.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Kontak
                      </p>
                      <p className="mt-1 break-words text-slate-700">
                        {customer.phone || "-"}
                      </p>
                      <p className="mt-1 break-words text-xs text-slate-500">
                        {customer.email || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Alamat
                      </p>
                      <p className="mt-1 break-words text-slate-600">
                        {customer.address || "Alamat belum diisi"}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <ResponsiveTableShell className="hidden xl:block">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Customer</th>
                  <th className="px-4 py-3">Kontak</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Belum ada customer. Simpan customer pertama dari form di sebelah kiri.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="align-top">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {customer.customer_code}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {customer.customer_name}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {customer.address || "Alamat belum diisi"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{customer.phone || "-"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {customer.email || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            customer.is_active
                              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                              : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500"
                          }
                        >
                          {customer.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ResponsiveTableShell>
        </section>
      </section>
    </div>
  );
}




