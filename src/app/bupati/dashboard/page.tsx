import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  LineChart,
  MapPinned,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type DashboardSummary = {
  report_year: number | null;
  total_bumdes_terpantau: number | null;
  total_unit_terpantau: number | null;
  total_dana_tersalur: number | null;
  total_aset: number | null;
  total_pendapatan: number | null;
  laba_rugi_bersih: number | null;
  skor_kesehatan_rata_rata: number | null;
  skor_maksimal_rata_rata: number | null;
  total_sehat: number | null;
  total_kurang_sehat: number | null;
  total_tidak_sehat: number | null;
  status_kesehatan_kabupaten: string | null;
  aset_terhadap_dana_tersalur_percent: number | null;
  produktivitas_dana_percent: number | null;
};

type KecamatanPerformance = {
  nama_kecamatan: string | null;
  total_bumdes: number | null;
  total_unit: number | null;
  total_pendapatan: number | null;
  laba_rugi_bersih: number | null;
  total_aset: number | null;
  skor_rata_rata: number | null;
  skor_maksimal_rata_rata: number | null;
  total_sehat: number | null;
  total_kurang_sehat: number | null;
  total_tidak_sehat: number | null;
  total_dana_tersalur: number | null;
};

type BumdesPriority = {
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  nama_unit: string | null;
  total_pendapatan: number | null;
  laba_rugi_bersih: number | null;
  total_aset: number | null;
  kas_setara_kas: number | null;
  skor_kesehatan: number | null;
  skor_maksimal: number | null;
  dashboard_health_status: string | null;
  accounting_consistency_status: string | null;
  masalah_utama: string | null;
};

type TopPerformingBumdes = {
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  nama_unit: string | null;
  total_pendapatan: number | null;
  laba_rugi_bersih: number | null;
  total_aset: number | null;
  roe_percent: number | null;
  roi_percent: number | null;
  skor_kesehatan: number | null;
  skor_maksimal: number | null;
  dashboard_health_status: string | null;
  accounting_consistency_status: string | null;
};

const numberFormatter = new Intl.NumberFormat("id-ID");
const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number | string | null | undefined) {
  return currencyFormatter.format(toNumber(value));
}

function formatCompactCurrency(value: number | string | null | undefined) {
  const amount = toNumber(value);

  if (Math.abs(amount) >= 1_000_000_000) {
    return `Rp${numberFormatter.format(Math.round(amount / 1_000_000_000))} M`;
  }

  if (Math.abs(amount) >= 1_000_000) {
    return `Rp${numberFormatter.format(Math.round(amount / 1_000_000))} Jt`;
  }

  return formatCurrency(amount);
}

function formatPercent(value: number | string | null | undefined) {
  return `${numberFormatter.format(Number(toNumber(value).toFixed(2)))}%`;
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "Belum Dinilai").replaceAll("_", " ");
}

function statusVariant(status: string | null | undefined) {
  const normalized = normalizeStatus(status).toLowerCase();

  if (normalized.includes("tidak")) return "danger" as const;
  if (normalized.includes("kurang")) return "warning" as const;
  if (normalized.includes("sehat")) return "success" as const;

  return "neutral" as const;
}

function scoreColorClass(score: number) {
  if (score >= 70) return "bg-emerald-600";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-600";
}

function scoreTextColorClass(score: number) {
  if (score >= 70) return "text-emerald-700";
  if (score >= 45) return "text-amber-700";
  return "text-red-700";
}

function StatTile({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {value}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>
      </div>
    </section>
  );
}

function ScoreMeter({
  score,
  maxScore,
}: {
  score: number;
  maxScore: number;
}) {
  const safeMaxScore = maxScore > 0 ? maxScore : 100;
  const percent = Math.min(100, Math.max(0, (score / safeMaxScore) * 100));

  return (
    <div>
      <div className="relative h-5 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${scoreColorClass(score)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>0</span>
        <span>45</span>
        <span>70</span>
        <span>{safeMaxScore}</span>
      </div>
    </div>
  );
}

function HealthDistribution({
  sehat,
  kurangSehat,
  tidakSehat,
}: {
  sehat: number;
  kurangSehat: number;
  tidakSehat: number;
}) {
  const total = sehat + kurangSehat + tidakSehat;
  const safeTotal = total > 0 ? total : 1;

  const items = [
    {
      label: "Sehat",
      value: sehat,
      className: "bg-emerald-600",
      textClassName: "text-emerald-700",
    },
    {
      label: "Kurang Sehat",
      value: kurangSehat,
      className: "bg-amber-500",
      textClassName: "text-amber-700",
    },
    {
      label: "Tidak Sehat",
      value: tidakSehat,
      className: "bg-red-600",
      textClassName: "text-red-700",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex h-5 overflow-hidden rounded-full bg-slate-100">
        {items.map((item) => (
          <div
            key={item.label}
            className={item.className}
            style={{ width: `${(item.value / safeTotal) * 100}%` }}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className={`mt-2 text-2xl font-black ${item.textClassName}`}>
              {numberFormatter.format(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KecamatanBar({ item }: { item: KecamatanPerformance }) {
  const score = toNumber(item.skor_rata_rata);
  const maxScore = toNumber(item.skor_maksimal_rata_rata) || 100;
  const percent = Math.min(100, Math.max(0, (score / maxScore) * 100));

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950">
            {item.nama_kecamatan ?? "Tanpa Kecamatan"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {numberFormatter.format(toNumber(item.total_bumdes))} BUMDes ·{" "}
            {formatCompactCurrency(item.total_dana_tersalur)} tersalur
          </p>
        </div>
        <span className={`text-lg font-black ${scoreTextColorClass(score)}`}>
          {numberFormatter.format(Number(score.toFixed(1)))}
        </span>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full ${scoreColorClass(score)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default async function BupatiDashboardPage() {
  const supabase = await createClient();

  const [
    summaryResult,
    kecamatanResult,
    priorityResult,
    topResult,
  ] = await Promise.all([
    supabase.from("v_bupati_dashboard_summary").select("*").maybeSingle(),
    supabase
      .from("v_bupati_kecamatan_performance")
      .select("*")
      .order("skor_rata_rata", { ascending: false })
      .limit(8),
    supabase
      .from("v_bupati_bumdes_priority_attention")
      .select("*")
      .order("skor_kesehatan", { ascending: true })
      .limit(8),
    supabase
      .from("v_bupati_top_performing_bumdes")
      .select("*")
      .order("skor_kesehatan", { ascending: false })
      .limit(6),
  ]);

  const summary = summaryResult.data as DashboardSummary | null;
  const kecamatanRows = (kecamatanResult.data ?? []) as KecamatanPerformance[];
  const priorityRows = (priorityResult.data ?? []) as BumdesPriority[];
  const topRows = (topResult.data ?? []) as TopPerformingBumdes[];

  const errors = [
    summaryResult.error?.message,
    kecamatanResult.error?.message,
    priorityResult.error?.message,
    topResult.error?.message,
  ].filter(Boolean);

  const totalSehat = toNumber(summary?.total_sehat);
  const totalKurangSehat = toNumber(summary?.total_kurang_sehat);
  const totalTidakSehat = toNumber(summary?.total_tidak_sehat);
  const score = toNumber(summary?.skor_kesehatan_rata_rata);
  const maxScore = toNumber(summary?.skor_maksimal_rata_rata) || 100;

  return (
    <div className="space-y-6">
      {errors.length > 0 ? (
        <Card className="border-red-200 bg-red-50">
          <div className="flex gap-3 text-red-700">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-bold">Sebagian data dashboard gagal dimuat</h3>
              <p className="mt-1 text-sm">{errors.join(" | ")}</p>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-900 to-emerald-800 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">
              Executive Command Center · Tahun {summary?.report_year ?? "-"}
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
              Kinerja BUMDes Kabupaten
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              Ringkasan strategis kesehatan BUMDes lintas kecamatan, total dana
              tersalur, aset, pendapatan, laba bersih, prioritas perhatian, dan
              rekomendasi kebijakan daerah.
            </p>
          </div>

          <div className="rounded-3xl bg-white/12 p-5 ring-1 ring-white/20 backdrop-blur">
            <Badge variant={statusVariant(summary?.status_kesehatan_kabupaten)}>
              Status Kabupaten: {normalizeStatus(summary?.status_kesehatan_kabupaten)}
            </Badge>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-5xl font-black tracking-tight">
                {numberFormatter.format(Number(score.toFixed(1)))}
              </span>
              <span className="pb-2 text-lg font-bold text-white/60">
                / {numberFormatter.format(maxScore)}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/70">
              Skor kesehatan rata-rata berbasis engine skoring resmi.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          title="BUMDes Terpantau"
          value={numberFormatter.format(toNumber(summary?.total_bumdes_terpantau))}
          description={`${numberFormatter.format(toNumber(summary?.total_unit_terpantau))} unit usaha masuk pemantauan.`}
          icon={<Building2 className="h-6 w-6" />}
        />
        <StatTile
          title="Total Dana Tersalur"
          value={formatCompactCurrency(summary?.total_dana_tersalur)}
          description="Akumulasi modal/dana yang tersalur ke BUMDes."
          icon={<Banknote className="h-6 w-6" />}
        />
        <StatTile
          title="Total Aset BUMDes"
          value={formatCompactCurrency(summary?.total_aset)}
          description={`${formatPercent(summary?.aset_terhadap_dana_tersalur_percent)} terhadap dana tersalur.`}
          icon={<Landmark className="h-6 w-6" />}
        />
        <StatTile
          title="Laba Bersih Konsolidasi"
          value={formatCompactCurrency(summary?.laba_rugi_bersih)}
          description={`Produktivitas dana ${formatPercent(summary?.produktivitas_dana_percent)}.`}
          icon={<CircleDollarSign className="h-6 w-6" />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card className="rounded-3xl">
          <CardHeader
            title="Status Kesehatan Kabupaten"
            description="Skor rata-rata dan distribusi status kesehatan BUMDes."
            action={
              <Badge variant={statusVariant(summary?.status_kesehatan_kabupaten)}>
                {normalizeStatus(summary?.status_kesehatan_kabupaten)}
              </Badge>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Skor rata-rata
                  </p>
                  <p className={`text-4xl font-black ${scoreTextColorClass(score)}`}>
                    {numberFormatter.format(Number(score.toFixed(1)))}
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <ScoreMeter score={score} maxScore={maxScore} />
              </div>
            </div>

            <HealthDistribution
              sehat={totalSehat}
              kurangSehat={totalKurangSehat}
              tidakSehat={totalTidakSehat}
            />
          </div>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader
            title="Efektivitas Dana Tersalur"
            description="Perbandingan dana tersalur dengan aset dan laba bersih."
            action={<Badge variant="info">Akumulasi</Badge>}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-emerald-700 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">
                Dana Tersalur
              </p>
              <p className="mt-3 text-3xl font-black">
                {formatCompactCurrency(summary?.total_dana_tersalur)}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Sumber: capital_disbursements berstatus posted.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Menjadi aset tercatat
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPercent(summary?.aset_terhadap_dana_tersalur_percent)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Produktivitas dana
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {formatPercent(summary?.produktivitas_dana_percent)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="rounded-3xl">
          <CardHeader
            title="Skor Rata-rata per Kecamatan"
            description="Wilayah dengan skor rendah menjadi prioritas pendampingan."
            action={<MapPinned className="h-5 w-5 text-slate-500" />}
          />

          <div className="space-y-3">
            {kecamatanRows.length > 0 ? (
              kecamatanRows.map((item) => (
                <KecamatanBar
                  key={item.nama_kecamatan ?? "tanpa-kecamatan"}
                  item={item}
                />
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Belum ada data kecamatan.
              </p>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader
            title="BUMDes Prioritas Perhatian"
            description="Daftar unit yang memerlukan intervensi kebijakan atau pendampingan."
            action={<Badge variant="warning">Prioritas</Badge>}
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">BUMDes / Unit</th>
                  <th className="px-3 py-3">Kecamatan</th>
                  <th className="px-3 py-3">Skor</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Masalah Utama</th>
                </tr>
              </thead>
              <tbody>
                {priorityRows.length > 0 ? (
                  priorityRows.map((item) => (
                    <tr
                      key={`${item.kode_bumdes}-${item.nama_unit}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-4">
                        <p className="font-bold text-slate-950">
                          {item.nama_bumdes}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.nama_desa} · {item.nama_unit}
                        </p>
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {item.nama_kecamatan}
                      </td>
                      <td className="px-3 py-4">
                        <span className="font-black text-slate-950">
                          {numberFormatter.format(toNumber(item.skor_kesehatan))}
                        </span>
                        <span className="text-slate-400">
                          /{numberFormatter.format(toNumber(item.skor_maksimal) || 100)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={statusVariant(item.dashboard_health_status)}>
                          {normalizeStatus(item.dashboard_health_status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {item.masalah_utama || "Perlu review lanjutan"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-6 text-slate-500" colSpan={5}>
                      Tidak ada BUMDes yang masuk prioritas perhatian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="rounded-3xl">
          <CardHeader
            title="Top Performing BUMDes"
            description="BUMDes/unit berkinerja terbaik sebagai referensi praktik baik."
            action={<TrendingUp className="h-5 w-5 text-emerald-700" />}
          />

          <div className="grid gap-3 md:grid-cols-2">
            {topRows.length > 0 ? (
              topRows.map((item) => {
                const itemScore = toNumber(item.skor_kesehatan);

                return (
                  <div
                    key={`${item.kode_bumdes}-${item.nama_unit}`}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">
                          {item.nama_bumdes}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.nama_kecamatan} · {item.nama_unit}
                        </p>
                      </div>
                      <div
                        className={`grid h-12 w-12 place-items-center rounded-2xl text-sm font-black text-white ${scoreColorClass(itemScore)}`}
                      >
                        {numberFormatter.format(itemScore)}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Laba Bersih
                        </p>
                        <p className="mt-1 font-bold text-slate-950">
                          {formatCompactCurrency(item.laba_rugi_bersih)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Pendapatan
                        </p>
                        <p className="mt-1 font-bold text-slate-950">
                          {formatCompactCurrency(item.total_pendapatan)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Belum ada data BUMDes berkinerja.
              </p>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader
            title="Insight Kebijakan"
            description="Ringkasan strategis untuk bahan rapat pimpinan."
            action={<LineChart className="h-5 w-5 text-slate-500" />}
          />

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold text-slate-950">
                    {numberFormatter.format(totalKurangSehat + totalTidakSehat)} BUMDes perlu perhatian
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Prioritaskan pendampingan untuk kategori kurang sehat dan
                    tidak sehat.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex gap-3">
                <BarChart3 className="mt-1 h-5 w-5 shrink-0 text-blue-700" />
                <div>
                  <p className="font-bold text-slate-950">
                    Produktivitas dana {formatPercent(summary?.produktivitas_dana_percent)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Bandingkan dana tersalur dengan laba bersih untuk melihat
                    dampak ekonomi BUMDes.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-bold text-slate-950">
                    {numberFormatter.format(totalSehat)} BUMDes sehat dapat direplikasi
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Gunakan BUMDes sehat sebagai model praktik baik untuk wilayah
                    lain.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex gap-3">
                <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-bold text-slate-950">
                    Aset terhadap dana {formatPercent(summary?.aset_terhadap_dana_tersalur_percent)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Indikator ini membantu melihat apakah dana tersalur telah
                    membentuk aset yang tercatat.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
