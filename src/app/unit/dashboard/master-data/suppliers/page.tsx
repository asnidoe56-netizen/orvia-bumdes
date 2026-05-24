import { PlusCircle, Truck } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createMasterSupplier } from "../actions";

type Supplier = {
  id: string;
  supplier_code: string;
  supplier_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
};

export default async function UnitMasterSuppliersPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, supplier_code, supplier_name, phone, email, address, is_active")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const supplierList = (suppliers ?? []) as Supplier[];

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/master-data" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Master Data / Supplier
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Supplier
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Kelola data pemasok sebagai referensi transaksi pembelian unit usaha.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800">
            <Truck className="h-4 w-4" />
            {supplierList.length} Supplier
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <form action={createMasterSupplier} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Form Supplier
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Simpan master supplier ke tabel suppliers melalui RPC.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Kode Supplier
              </span>
              <input
                name="supplier_code"
                required
                placeholder="Contoh: SUP-001"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nama Supplier
              </span>
              <input
                name="supplier_name"
                required
                placeholder="Contoh: Toko Sumber Makmur"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nomor Telepon
              </span>
              <input
                name="phone"
                placeholder="Contoh: 0812xxxx"
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
                placeholder="supplier@email.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Alamat
              </span>
              <textarea
                name="address"
                rows={3}
                placeholder="Alamat lengkap supplier"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end border-t border-slate-200 pt-5">
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              Simpan Supplier
            </button>
          </div>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Truck className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Daftar Supplier
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Tabel master supplier unit.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Supplier</th>
                  <th className="px-4 py-3">Kontak</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {supplierList.length > 0 ? (
                  supplierList.map((supplier) => (
                    <tr key={supplier.id}>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {supplier.supplier_code}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-semibold">{supplier.supplier_name}</div>
                        <div className="text-xs text-slate-500">
                          {supplier.address || "Alamat belum diisi"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{supplier.phone || "-"}</div>
                        <div className="text-xs text-slate-500">
                          {supplier.email || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {supplier.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Belum ada supplier. Tambahkan supplier pertama dari form di samping.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
