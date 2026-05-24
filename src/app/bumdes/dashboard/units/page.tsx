import { PlusCircle, Store, UserRound, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createBusinessUnitWithAccess } from "./actions";

type UnitTemplate = {
  id: string;
  kode_template: string;
  nama_template: string;
  deskripsi: string | null;
};

type BusinessUnit = {
  id: string;
  kode_unit: string;
  nama_unit: string;
  jenis_unit: string;
  status: string;
};

export default async function BumdesUnitsPage() {
  const context = await getLoginContext();

  if (!context || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: templates, error: templateError } = await supabase
    .from("unit_templates")
    .select("id, kode_template, nama_template, deskripsi")
    .eq("is_active", true)
    .order("kode_template", { ascending: true });

  const { data: units, error: unitError } = await supabase
    .from("business_units")
    .select("id, kode_unit, nama_unit, jenis_unit, status")
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false });

  const templateList = (templates ?? []) as UnitTemplate[];
  const unitList = (units ?? []) as BusinessUnit[];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Direktur BUMDes / Unit Usaha
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Kelola Unit Usaha
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Buat unit usaha baru, pilih template unit, lalu generate akun Manager Unit
          dan opsional akun Operator Unit.
        </p>
      </section>

      {templateError || unitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {templateError?.message || unitError?.message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Tambah Unit Usaha
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Manager Unit wajib dibuat. Operator dapat dibuat sekarang atau menyusul.
              </p>
            </div>
          </div>

          <form action={createBusinessUnitWithAccess} className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Data Unit
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Template Unit *
                  </span>
                  <select
                    name="template_id"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Pilih template</option>
                    {templateList.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.nama_template}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Jenis Unit *
                  </span>
                  <input
                    name="jenis_unit"
                    required
                    placeholder="Contoh: Perdagangan / Jasa / Wisata"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Kode Unit *
                  </span>
                  <input
                    name="kode_unit"
                    required
                    placeholder="Contoh: TOKO01"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Nama Unit *
                  </span>
                  <input
                    name="nama_unit"
                    required
                    placeholder="Contoh: Unit Toko Desa"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                <UserRound className="h-4 w-4" />
                Akun Manager Unit
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Nama Manager *
                  </span>
                  <input
                    name="manager_name"
                    required
                    placeholder="Nama lengkap manager"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Email Manager *
                  </span>
                  <input
                    name="manager_email"
                    type="email"
                    required
                    placeholder="manager@email.com"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                  <UsersRound className="h-4 w-4" />
                  Akun Operator Unit
                </h3>

                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    name="create_operator"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  Buat operator sekarang
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Nama Operator
                  </span>
                  <input
                    name="operator_name"
                    placeholder="Nama lengkap operator"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Email Operator
                  </span>
                  <input
                    name="operator_email"
                    type="email"
                    placeholder="operator@email.com"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-5">
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                Simpan Unit & Generate Akses
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Daftar Unit Usaha
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Total unit: {unitList.length}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {unitList.length > 0 ? (
              unitList.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">
                        {unit.nama_unit}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {unit.kode_unit} · {unit.jenis_unit}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      {unit.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Belum ada unit usaha. Buat unit pertama dari form di sebelah kiri.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
