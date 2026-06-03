"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  KeyRound,
  PlusCircle,
  ShieldCheck,
  Store,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { createBusinessUnitWithAccess } from "./actions";
import { UnitAccessPasswordFields } from "./unit-access-password-fields";
import type { BusinessUnit, UnitAccessCredential, UnitTemplate } from "./page";

type UnitsClientProps = {
  templates: UnitTemplate[];
  units: BusinessUnit[];
  credentials: UnitAccessCredential[];
  errorMessage: string | null;
};

function roleLabel(role: string) {
  if (role === "manager_unit") return "Manager Unit";
  if (role === "operator_unit") return "Operator Unit";
  return role;
}

function statusLabel(status: string) {
  if (status === "aktif" || status === "active") return "Aktif";
  return status;
}

function MiniSparkline({ variant = "emerald" }: { variant?: "emerald" | "blue" | "orange" | "violet" }) {
  const strokeClass =
    variant === "blue"
      ? "stroke-blue-500"
      : variant === "orange"
        ? "stroke-orange-500"
        : variant === "violet"
          ? "stroke-violet-500"
          : "stroke-emerald-500";

  const fillClass =
    variant === "blue"
      ? "fill-blue-100"
      : variant === "orange"
        ? "fill-orange-100"
        : variant === "violet"
          ? "fill-violet-100"
          : "fill-emerald-100";

  return (
    <svg viewBox="0 0 180 48" className="h-10 w-full" aria-hidden="true">
      <path
        d="M4 42 L22 41 L40 40 L58 38 L76 39 L94 34 L112 36 L130 28 L148 32 L176 22 L176 48 L4 48 Z"
        className={`${fillClass} opacity-70`}
      />
      <path
        d="M4 42 L22 41 L40 40 L58 38 L76 39 L94 34 L112 36 L130 28 L148 32 L176 22"
        className={`${strokeClass} fill-none`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  variant,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  variant: "emerald" | "blue" | "orange" | "violet";
}) {
  const iconClass =
    variant === "blue"
      ? "bg-blue-50 text-blue-700"
      : variant === "orange"
        ? "bg-orange-50 text-orange-700"
        : variant === "violet"
          ? "bg-violet-50 text-violet-700"
          : "bg-emerald-50 text-emerald-700";

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>

        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
          {icon}
        </div>
      </div>

      <div className="mt-4">
        <MiniSparkline variant={variant} />
      </div>
    </article>
  );
}

function CreateUnitForm({ templates }: { templates: UnitTemplate[] }) {
  return (
    <form action={createBusinessUnitWithAccess} className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
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
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Pilih template</option>
              {templates.map((template) => (
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
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm uppercase outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
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
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
        </div>

        <UnitAccessPasswordFields
          className="mt-4"
          passwordName="manager_password"
          confirmPasswordName="manager_confirm_password"
          passwordLabel="Password Manager *"
          confirmPasswordLabel="Konfirmasi Password Manager *"
          required
        />
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
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
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
        </div>

        <UnitAccessPasswordFields
          className="mt-4"
          passwordName="operator_password"
          confirmPasswordName="operator_confirm_password"
          passwordLabel="Password Operator"
          confirmPasswordLabel="Konfirmasi Password Operator"
        />

        <p className="mt-2 text-xs font-medium text-slate-500">
          Password operator hanya wajib jika opsi “Buat operator sekarang” dicentang.
        </p>
      </div>

      <div className="sticky bottom-0 -mx-1 border-t border-slate-200 bg-white/95 px-1 pt-4 backdrop-blur">
        <button
          type="submit"
          className="w-full rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800 md:w-auto"
        >
          Simpan Unit & Generate Akses
        </button>
      </div>
    </form>
  );
}

export function UnitsClient({
  templates,
  units,
  credentials,
  errorMessage,
}: UnitsClientProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const credentialsByUnit = useMemo(
    () =>
      credentials.reduce<Record<string, UnitAccessCredential[]>>((acc, credential) => {
        if (!acc[credential.unit_id]) {
          acc[credential.unit_id] = [];
        }

        acc[credential.unit_id].push(credential);
        return acc;
      }, {}),
    [credentials]
  );

  const activeUnits = units.filter(
    (unit) => unit.status === "aktif" || unit.status === "active"
  ).length;

  const managerCredentials = credentials.filter(
    (credential) => credential.role === "manager_unit"
  ).length;

  const activeCredentials = credentials.filter(
    (credential) => credential.access_status === "active"
  ).length;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm shadow-slate-200/70 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(16,185,129,0.18),transparent_32%),linear-gradient(120deg,rgba(236,253,245,0.88),rgba(255,255,255,0.94)_42%,rgba(240,253,250,0.88))]" />
        <div className="absolute right-8 top-8 hidden h-36 w-64 rounded-[2rem] bg-emerald-100/70 blur-3xl lg:block" />
        <div className="absolute bottom-0 right-0 hidden h-40 w-[34rem] rounded-tl-[6rem] bg-gradient-to-r from-emerald-50 via-teal-50 to-orange-50 lg:block" />

        <div className="relative">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
              Direktur BUMDes / Unit Usaha
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Kelola Unit Usaha
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              Pantau unit usaha yang sudah terdaftar, kelola akses Manager Unit,
              dan buat unit baru melalui dialog kerja yang lebih ringkas.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setIsCreateDialogOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                <PlusCircle className="h-4 w-4" />
                Buat Unit
              </button>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                Akses unit dibuat dengan kredensial terkontrol
              </div>
            </div>
          </div>


        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Unit"
          value={units.length}
          description="Seluruh unit usaha dalam tenant BUMDes."
          icon={<Store className="h-6 w-6" />}
          variant="emerald"
        />
        <StatCard
          title="Unit Aktif"
          value={activeUnits}
          description="Unit yang siap digunakan untuk operasional."
          icon={<CheckCircle2 className="h-6 w-6" />}
          variant="blue"
        />
        <StatCard
          title="Manager Unit"
          value={managerCredentials}
          description="Akun pengelola utama untuk setiap unit."
          icon={<UserRound className="h-6 w-6" />}
          variant="violet"
        />
        <StatCard
          title="Akses Aktif"
          value={activeCredentials}
          description="Kredensial unit yang masih aktif."
          icon={<KeyRound className="h-6 w-6" />}
          variant="orange"
        />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Daftar Unit Usaha
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Data dibaca dari unit usaha dan kredensial akses unit aktif.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Database Aktif
          </span>
        </div>

        {units.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-50 text-slate-400">
              <Store className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-base font-black text-slate-900">
              Belum ada unit usaha
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Klik tombol Buat Unit untuk membuat unit usaha pertama dan membuat
              akses Manager Unit.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateDialogOpen(true)}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              <PlusCircle className="h-4 w-4" />
              Buat Unit
            </button>
          </div>
        ) : (
          <div className="p-4 md:p-6">
            <div className="space-y-4">
              {units.map((unit) => {
                const unitCredentials = credentialsByUnit[unit.id] ?? [];

                return (
                  <article
                    key={unit.id}
                    className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/80"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-950">
                            {unit.nama_unit}
                          </h3>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            {unit.kode_unit} · {unit.jenis_unit}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                        {statusLabel(unit.status)}
                      </span>
                    </div>

                    <div className="mt-4 rounded-[1.25rem] bg-slate-50/80 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
                        <KeyRound className="h-4 w-4 text-emerald-700" />
                        Kredensial Akses Unit
                      </h4>

                      {unitCredentials.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                          Belum ada kredensial akses untuk unit ini.
                        </p>
                      ) : (
                        <div className="grid gap-3">
                          {unitCredentials.map((credential) => (
                            <div
                              key={credential.id}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-sm font-black text-slate-950">
                                    {roleLabel(credential.role)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Dibuat{" "}
                                    {new Date(credential.generated_at).toLocaleString(
                                      "id-ID",
                                      {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      }
                                    )}
                                  </p>
                                </div>

                                <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                                  {credential.access_status}
                                </span>
                              </div>

                              <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                                <div>
                                  <p className="font-bold text-slate-500">
                                    Email Login
                                  </p>
                                  <p className="mt-1 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-slate-800">
                                    {credential.email_virtual}
                                  </p>
                                </div>

                                <div>
                                  <p className="font-bold text-slate-500">
                                    Login Code
                                  </p>
                                  <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 font-mono text-slate-800">
                                    {credential.login_code}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                                <Activity className="h-3.5 w-3.5 text-emerald-700" />
                                Login tetap memakai email dan password, bukan login code.
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {isCreateDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm md:p-6">
          <div className="min-h-full w-full max-w-5xl py-6">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-950">
                      Tambah Unit Usaha
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Manager Unit wajib dibuat. Operator dapat dibuat sekarang atau menyusul.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  aria-label="Tutup dialog tambah unit"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 md:p-6">
                <CreateUnitForm templates={templates} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

