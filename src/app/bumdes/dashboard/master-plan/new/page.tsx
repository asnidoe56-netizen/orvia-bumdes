export const dynamic = "force-dynamic";

import {
  ArrowLeft,
  Banknote,
  ClipboardList,
  FilePlus2,
  Leaf,
  Lightbulb,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createBusinessPlanAction } from "./actions";

type BusinessUnit = {
  id: string;
  kode_unit: string;
  nama_unit: string;
  jenis_unit: string;
  status: string;
};

function generatePlanNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `BP-${year}${month}-${String(now.getTime()).slice(-5)}`;
}

export default async function NewBumdesMasterPlanPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: units, error: unitError } = await supabase
    .from("business_units")
    .select("id, kode_unit, nama_unit, jenis_unit, status")
    .eq("tenant_id", context.tenant_id)
    .eq("status", "aktif")
    .order("created_at", { ascending: false });

  const unitRows = (units ?? []) as BusinessUnit[];

  if (unitError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        Gagal membaca unit tujuan: {unitError.message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <Link
              href="/bumdes/dashboard/master-plan"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Master Plan
            </Link>

            <Badge variant="info">Draft Baru</Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                <Sparkles className="h-3.5 w-3.5" />
                Mulai Rencana yang Terang
              </div>

              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Buat Proposal Modal
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Susun master plan dengan bahasa kerja yang jelas: apa usahanya,
                mengapa perlu modal, bagaimana dijalankan, risiko apa yang dijaga,
                dan manfaat apa yang ingin ditumbuhkan.
              </p>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-amber-950">
                <Lightbulb className="h-6 w-6" />
              </div>

              <p className="text-lg font-black text-slate-950">
                Filosofi Proposal
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Proposal yang baik bukan yang paling panjang, tetapi yang paling
                jernih: angkanya masuk akal, alurnya bisa dijalankan, dan manfaatnya
                dapat dirasakan.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form action={createBusinessPlanAction} className="space-y-5">
        <Card>
          <CardHeader
            title="Identitas Proposal"
            description="Bagian ini menjadi pintu masuk governance. Nomor proposal akan disimpan dalam huruf besar oleh engine."
            action={<Badge variant="success">Step 1</Badge>}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Unit Tujuan
              </span>
              <select
                name="proposed_unit_id"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              >
                <option value="">Pilih unit usaha</option>
                {unitRows.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.nama_unit} - {unit.jenis_unit} ({unit.kode_unit})
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Nomor Proposal"
              name="plan_no"
              defaultValue={generatePlanNo()}
              required
              placeholder="BP-202605-00001"
            />

            <Input
              label="Judul Proposal"
              name="title"
              required
              placeholder="Contoh: Penguatan Modal Unit Dagang Saparas"
              className="md:col-span-2"
            />

            <Input
              label="Jenis Usaha"
              name="business_type"
              required
              placeholder="Contoh: Perdagangan sembako, simpan pinjam, jasa sewa"
              className="md:col-span-2"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Narasi Master Plan"
            description="Tulis singkat, jernih, dan bisa dipertanggungjawabkan. Ini akan menjadi bahan review Pendamping Kecamatan."
            action={<Badge variant="info">Step 2</Badge>}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              {
                label: "Latar Belakang",
                name: "background",
                placeholder: "Mengapa unit/usaha ini membutuhkan penguatan modal?",
              },
              {
                label: "Tujuan",
                name: "objectives",
                placeholder: "Apa tujuan utama proposal ini?",
              },
              {
                label: "Analisis Pasar",
                name: "market_analysis",
                placeholder: "Siapa pembeli/pengguna, kebutuhan pasar, dan peluangnya?",
              },
              {
                label: "Rencana Operasional",
                name: "operational_plan",
                placeholder: "Bagaimana usaha dijalankan setelah modal diterima?",
              },
              {
                label: "Analisis Risiko",
                name: "risk_analysis",
                placeholder: "Apa risiko utama dan bagaimana mitigasinya?",
              },
              {
                label: "Manfaat yang Diharapkan",
                name: "expected_benefits",
                placeholder: "Apa manfaat untuk unit, BUMDes, desa, dan warga?",
              },
            ].map((field) => (
              <label key={field.name} className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  {field.label}
                </span>
                <textarea
                  name={field.name}
                  rows={5}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="RAB / Rencana Anggaran Biaya"
            description="Isi minimal satu baris RAB. Total akan dihitung dan divalidasi oleh alur backend dari jumlah dan harga satuan."
            action={<Badge variant="warning">Step 3</Badge>}
          />

          <div className="mb-4 rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-black">
              <Banknote className="h-4 w-4" />
              RAB adalah kompas modal
            </div>
            Semakin rinci kebutuhan modal, semakin mudah proposal direview,
            disetujui, dicairkan, dan dipertanggungjawabkan.
          </div>

          <div className="space-y-4">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-black text-slate-950">Baris RAB {row}</p>
                  {row === 1 ? (
                    <Badge variant="success">Wajib</Badge>
                  ) : (
                    <Badge variant="neutral">Opsional</Badge>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <Input
                    label="Kategori"
                    name="budget_category"
                    required={row === 1}
                    placeholder="Barang / Peralatan / Operasional"
                    className="xl:col-span-2"
                  />

                  <Input
                    label="Uraian"
                    name="budget_description"
                    required={row === 1}
                    placeholder="Contoh: Stok awal beras 5 kg"
                    className="xl:col-span-2"
                  />

                  <Input
                    label="Jumlah"
                    name="budget_quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    required={row === 1}
                    defaultValue={row === 1 ? "1" : ""}
                  />

                  <Input
                    label="Satuan"
                    name="budget_unit_of_measure"
                    defaultValue={row === 1 ? "unit" : ""}
                    placeholder="unit / paket / kg"
                  />

                  <Input
                    label="Harga Satuan"
                    name="budget_unit_cost"
                    type="number"
                    min="0"
                    step="1"
                    required={row === 1}
                    placeholder="0"
                    className="xl:col-span-2"
                  />

                  <Input
                    label="Catatan"
                    name="budget_notes"
                    placeholder="Opsional"
                    className="xl:col-span-4"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader
              title="Energi Kerja"
              description="Pengingat kecil sebelum menyimpan draft."
              action={<Leaf className="h-5 w-5 text-emerald-700" />}
            />

            <div className="space-y-3">
              {[
                "Mulai dari data yang jujur.",
                "Tulis rencana yang bisa dijalankan.",
                "Jaga uang publik dengan jejak yang terang.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900"
                >
                  <Target className="h-4 w-4" />
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500">
              <FilePlus2 className="h-6 w-6" />
            </div>

            <p className="text-xl font-black">Simpan sebagai Draft</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Draft akan masuk ke engine governance. Setelah tersimpan, proposal
              dapat dilanjutkan ke proses review Pendamping Kecamatan.
            </p>

            <button
              type="submit"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-400"
            >
              <ClipboardList className="h-4 w-4" />
              Simpan Draft Proposal
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
