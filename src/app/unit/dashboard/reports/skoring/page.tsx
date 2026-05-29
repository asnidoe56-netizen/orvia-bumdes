import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Gauge,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { Card, CardHeader } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { PageHeader } from "@/components/ui/page-header";
import {
  AnimatedGaugeCard,
  IndicatorLineChartCard,
  type VisualIndicator,
} from "./_components/skoring-visuals";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type HealthScoringRow = {
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  report_year: number | null;

  total_pendapatan: number | string | null;
  total_hpp: number | string | null;
  laba_kotor: number | string | null;
  total_beban: number | string | null;
  laba_rugi_bersih: number | string | null;
  total_aset: number | string | null;
  total_kewajiban: number | string | null;
  total_ekuitas: number | string | null;

  kas_setara_kas: number | string | null;
  piutang_usaha: number | string | null;
  persediaan: number | string | null;
  aset_lancar: number | string | null;
  kewajiban_lancar: number | string | null;
  total_penjualan_kredit: number | string | null;

  roe_percent: number | string | null;
  roi_percent: number | string | null;
  rasio_kas_percent: number | string | null;
  rasio_lancar_percent: number | string | null;
  collection_period_days: number | string | null;
  inventory_turnover_days: number | string | null;
  total_asset_turnover_percent: number | string | null;
  owner_equity_to_asset_percent: number | string | null;

  roe_max_score: number | null;
  roe_score: number | null;
  roi_max_score: number | null;
  roi_score: number | null;
  rasio_kas_max_score: number | null;
  rasio_kas_score: number | null;
  rasio_lancar_max_score: number | null;
  rasio_lancar_score: number | null;
  collection_period_max_score: number | null;
  collection_period_score: number | null;
  inventory_turnover_max_score: number | null;
  inventory_turnover_score: number | null;
  total_asset_turnover_max_score: number | null;
  total_asset_turnover_score: number | null;
  owner_equity_to_asset_max_score: number | null;
  owner_equity_to_asset_score: number | null;

  total_score: number | null;
  max_score: number | null;
  health_status: string | null;
  accounting_consistency_status: string | null;
};

type IndicatorRow = {
  no: number;
  name: string;
  value: string;
  score: number;
  maxScore: number;
  note: string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatCompactRupiah(value: number | string | null | undefined) {
  const numberValue = toNumber(value);

  if (Math.abs(numberValue) >= 1_000_000_000) {
    return `Rp${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 2,
    }).format(numberValue / 1_000_000_000)}M`;
  }

  if (Math.abs(numberValue) >= 1_000_000) {
    return `Rp${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 2,
    }).format(numberValue / 1_000_000)}Jt`;
  }

  return formatRupiah(numberValue);
}

function formatPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-";

  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value))}%`;
}

function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function getYearParam(params: Record<string, string | string[] | undefined>) {
  const rawYear = Array.isArray(params.year) ? params.year[0] : params.year;
  const year = Number(rawYear);

  return Number.isFinite(year) && year > 2000 ? year : new Date().getFullYear();
}

function getStatusTheme(status: string | null | undefined) {
  if (status === "Sehat") {
    return {
      wrapper: "border-emerald-200 bg-emerald-50 text-emerald-900",
      badge: "bg-emerald-700 text-white",
      soft: "bg-white/70 text-emerald-800",
      icon: BadgeCheck,
    };
  }

  if (status === "Kurang Sehat") {
    return {
      wrapper: "border-amber-200 bg-amber-50 text-amber-900",
      badge: "bg-amber-600 text-white",
      soft: "bg-white/70 text-amber-800",
      icon: AlertTriangle,
    };
  }

  return {
    wrapper: "border-rose-200 bg-rose-50 text-rose-900",
    badge: "bg-rose-700 text-white",
    soft: "bg-white/70 text-rose-800",
    icon: TrendingDown,
  };
}

function getBarClass(score: number, maxScore: number) {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;

  if (percent >= 75) return "bg-emerald-600";
  if (percent >= 45) return "bg-amber-500";

  return "bg-rose-500";
}

function getQualityLabel(score: number, maxScore: number) {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;

  if (percent >= 75) return "Kuat";
  if (percent >= 45) return "Sedang";

  return "Lemah";
}

function getInsightRows(indicators: IndicatorRow[]) {
  return indicators
    .map((indicator) => ({
      ...indicator,
      percent:
        indicator.maxScore > 0
          ? Math.round((indicator.score / indicator.maxScore) * 100)
          : 0,
    }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 3);
}

function KpiCard({
  title,
  value,
  description,
  tone = "blue",
}: {
  title: string;
  value: string;
  description: string;
  tone?: "blue" | "red" | "green" | "amber";
}) {
  const toneClass = {
    blue: "text-blue-700 after:bg-blue-100",
    red: "text-rose-700 after:bg-rose-100",
    green: "text-emerald-700 after:bg-emerald-100",
    amber: "text-amber-700 after:bg-amber-100",
  }[tone];

  return (
    <div
      className={`relative min-h-28 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:[clip-path:polygon(0_70%,20%_45%,42%_60%,64%_25%,82%_50%,100%_20%,100%_100%,0_100%)] ${toneClass}`}
    >
      <p className="relative z-10 text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="relative z-10 mt-2 text-2xl font-black tracking-tight">
        {value}
      </p>
      <p className="relative z-10 mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function ScoreCompositionChart({ indicators }: { indicators: IndicatorRow[] }) {
  return (
    <Card>
      <CardHeader
        title="Score Composition"
        description="Perbandingan skor aktual terhadap sisa skor maksimum."
      />

      <div className="space-y-3">
        {indicators.map((indicator) => {
          const percent =
            indicator.maxScore > 0
              ? Math.min(100, Math.max(0, (indicator.score / indicator.maxScore) * 100))
              : 0;

          return (
            <div key={indicator.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <p className="truncate font-bold text-slate-700">{indicator.name}</p>
                <p className="shrink-0 font-black text-slate-950">
                  {indicator.score}/{indicator.maxScore}
                </p>
              </div>
              <div className="flex h-4 overflow-hidden rounded-full bg-rose-100">
                <div
                  className="h-full rounded-full bg-blue-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function IndicatorTable({ indicators }: { indicators: IndicatorRow[] }) {
  return (
    <Card>
      <CardHeader
        title="Rincian Skor Kesehatan"
        description="Format internal seperti scoring kesehatan keuangan."
      />

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">No</th>
              <th className="px-4 py-3">Indikator</th>
              <th className="px-4 py-3">Nilai</th>
              <th className="px-4 py-3 text-right">Skor Maks</th>
              <th className="px-4 py-3 text-right">Skor</th>
              <th className="px-4 py-3">Kualitas</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {indicators.map((indicator) => {
              const percent =
                indicator.maxScore > 0
                  ? Math.min(100, Math.max(0, (indicator.score / indicator.maxScore) * 100))
                  : 0;

              return (
                <tr key={indicator.name}>
                  <td className="px-4 py-4 text-slate-500">{indicator.no}</td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-900">{indicator.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {indicator.note}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-800">
                    {indicator.value}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-slate-600">
                    {indicator.maxScore}
                  </td>
                  <td className="px-4 py-4 text-right font-black text-slate-950">
                    {indicator.score}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-slate-600">
                        {getQualityLabel(indicator.score, indicator.maxScore)}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {Math.round(percent)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${getBarClass(
                          indicator.score,
                          indicator.maxScore
                        )}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function SkoringReportPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const context = await getLoginContext();

  if (!context || !context.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : {};
  const selectedYear = getYearParam(params);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_unit_financial_health_scoring")
    .select(
      "kode_bumdes, nama_bumdes, nama_desa, nama_kecamatan, kode_unit, nama_unit, report_year, total_pendapatan, total_hpp, laba_kotor, total_beban, laba_rugi_bersih, total_aset, total_kewajiban, total_ekuitas, kas_setara_kas, piutang_usaha, persediaan, aset_lancar, kewajiban_lancar, total_penjualan_kredit, roe_percent, roi_percent, rasio_kas_percent, rasio_lancar_percent, collection_period_days, inventory_turnover_days, total_asset_turnover_percent, owner_equity_to_asset_percent, roe_max_score, roe_score, roi_max_score, roi_score, rasio_kas_max_score, rasio_kas_score, rasio_lancar_max_score, rasio_lancar_score, collection_period_max_score, collection_period_score, inventory_turnover_max_score, inventory_turnover_score, total_asset_turnover_max_score, total_asset_turnover_score, owner_equity_to_asset_max_score, owner_equity_to_asset_score, total_score, max_score, health_status, accounting_consistency_status"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("report_year", selectedYear)
    .maybeSingle();

  const scoring = data as HealthScoringRow | null;

  const totalScore = scoring?.total_score ?? 0;
  const maxScore = scoring?.max_score ?? 100;
  const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const healthStatus = scoring?.health_status ?? "Belum Ada Data";
  const statusTheme = getStatusTheme(healthStatus);
  const StatusIcon = statusTheme.icon;

  const indicators: IndicatorRow[] = scoring
    ? [
        {
          no: 1,
          name: "Imbalan kepada Pemilik / ROE",
          value: formatPercent(scoring.roe_percent),
          score: scoring.roe_score ?? 0,
          maxScore: scoring.roe_max_score ?? 29,
          note: "Laba bersih dibandingkan total ekuitas/modal pemilik.",
        },
        {
          no: 2,
          name: "Imbalan Investasi / ROI",
          value: formatPercent(scoring.roi_percent),
          score: scoring.roi_score ?? 0,
          maxScore: scoring.roi_max_score ?? 22,
          note: "Laba bersih dibandingkan total aset.",
        },
        {
          no: 3,
          name: "Rasio Kas",
          value:
            scoring.rasio_kas_percent === null
              ? "Tidak ada kewajiban lancar"
              : formatPercent(scoring.rasio_kas_percent),
          score: scoring.rasio_kas_score ?? 0,
          maxScore: scoring.rasio_kas_max_score ?? 7,
          note: "Kas dan setara kas dibandingkan kewajiban lancar.",
        },
        {
          no: 4,
          name: "Rasio Lancar",
          value:
            scoring.rasio_lancar_percent === null
              ? "Tidak ada kewajiban lancar"
              : formatPercent(scoring.rasio_lancar_percent),
          score: scoring.rasio_lancar_score ?? 0,
          maxScore: scoring.rasio_lancar_max_score ?? 7,
          note: "Aset lancar dibandingkan kewajiban lancar.",
        },
        {
          no: 5,
          name: "Periode Penagihan",
          value: `${formatNumber(scoring.collection_period_days)} hari`,
          score: scoring.collection_period_score ?? 0,
          maxScore: scoring.collection_period_max_score ?? 7,
          note: "Piutang usaha dibandingkan penjualan kredit tahunan.",
        },
        {
          no: 6,
          name: "Perputaran Persediaan",
          value: `${formatNumber(scoring.inventory_turnover_days)} hari`,
          score: scoring.inventory_turnover_score ?? 0,
          maxScore: scoring.inventory_turnover_max_score ?? 7,
          note: "Persediaan dibandingkan HPP tahunan.",
        },
        {
          no: 7,
          name: "Perputaran Total Aset",
          value: formatPercent(scoring.total_asset_turnover_percent),
          score: scoring.total_asset_turnover_score ?? 0,
          maxScore: scoring.total_asset_turnover_max_score ?? 7,
          note: "Omzet/pendapatan dibandingkan total aset.",
        },
        {
          no: 8,
          name: "Modal Pemilik terhadap Total Aset",
          value: formatPercent(scoring.owner_equity_to_asset_percent),
          score: scoring.owner_equity_to_asset_score ?? 0,
          maxScore: scoring.owner_equity_to_asset_max_score ?? 14,
          note: "Total ekuitas dibandingkan total aset.",
        },
      ]
    : [];

  const visualIndicators: VisualIndicator[] = indicators.map((indicator) => ({
    name: indicator.name,
    score: indicator.score,
    maxScore: indicator.maxScore,
    value: indicator.value,
  }));

  const weakestIndicators = getInsightRows(indicators);

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/reports" />

      <PageHeader
        breadcrumb="Admin Unit / Laporan / Skoring"
        title="Financial Health Dashboard"
        description="Dashboard kesehatan keuangan unit berbasis view database. Bagian status kesehatan tetap berada di paling atas."
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Tahun Laporan
            </label>
            <input
              name="year"
              type="number"
              min="2000"
              max="2100"
              defaultValue={selectedYear}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            Tampilkan
          </button>
        </form>
      </section>

      {error ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Data gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{error.message}</p>
        </section>
      ) : null}

      {!error && !scoring ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Belum ada data skoring
          </h2>

          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Belum ditemukan data scoring kesehatan keuangan untuk tahun{" "}
            {selectedYear}. Pastikan laporan laba rugi, neraca, arus kas, dan
            saldo akun sudah tersedia.
          </p>
        </section>
      ) : null}

      {scoring ? (
        <>
          <section
            className={[
              "rounded-[2rem] border p-6 shadow-sm",
              statusTheme.wrapper,
            ].join(" ")}
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div
                  className={[
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black",
                    statusTheme.badge,
                  ].join(" ")}
                >
                  <StatusIcon className="h-4 w-4" />
                  {healthStatus}
                </div>

                <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                  Status Kesehatan Keuangan: {healthStatus}
                </h2>

                <p className="mt-3 max-w-4xl text-sm leading-6">
                  {scoring.nama_bumdes ?? "BUMDes"} · Unit{" "}
                  {scoring.kode_unit ?? "-"} {scoring.nama_unit ?? "-"} · Tahun{" "}
                  {selectedYear}. Total skor saat ini adalah{" "}
                  <span className="font-black">{totalScore}</span> dari{" "}
                  <span className="font-black">{maxScore}</span>, atau sekitar{" "}
                  <span className="font-black">{scorePercent}%</span> dari skor
                  maksimum.
                </p>
              </div>

              <div
                className={[
                  "rounded-[2rem] p-6 text-center shadow-sm",
                  statusTheme.soft,
                ].join(" ")}
              >
                <p className="text-sm font-black uppercase tracking-wide">
                  Health Score
                </p>
                <p className="mt-2 text-6xl font-black tracking-tight tabular-nums">
                  {totalScore}
                </p>
                <p className="mt-1 text-sm font-bold">dari {maxScore}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              title="Total Pendapatan"
              value={formatCompactRupiah(scoring.total_pendapatan)}
              description="Omzet tahun berjalan."
              tone="blue"
            />

            <KpiCard
              title="HPP + Beban"
              value={formatCompactRupiah(
                toNumber(scoring.total_hpp) + toNumber(scoring.total_beban)
              )}
              description="Total biaya pembentuk laba."
              tone="red"
            />

            <KpiCard
              title="Equity Ratio"
              value={formatPercent(scoring.owner_equity_to_asset_percent)}
              description="Modal pemilik terhadap aset."
              tone="green"
            />

            <KpiCard
              title="Health Score"
              value={`${totalScore}`}
              description={healthStatus}
              tone="amber"
            />

            <KpiCard
              title="Laba Bersih"
              value={formatCompactRupiah(scoring.laba_rugi_bersih)}
              description="Laba setelah HPP dan beban."
              tone="green"
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <AnimatedGaugeCard
              title="ROE"
              value={formatPercent(scoring.roe_percent)}
              score={scoring.roe_score ?? 0}
              maxScore={scoring.roe_max_score ?? 29}
            />
            <AnimatedGaugeCard
              title="ROI"
              value={formatPercent(scoring.roi_percent)}
              score={scoring.roi_score ?? 0}
              maxScore={scoring.roi_max_score ?? 22}
            />
            <AnimatedGaugeCard
              title="Collection Period"
              value={`${formatNumber(scoring.collection_period_days)} hari`}
              score={scoring.collection_period_score ?? 0}
              maxScore={scoring.collection_period_max_score ?? 7}
            />
            <AnimatedGaugeCard
              title="Inventory Turnover"
              value={`${formatNumber(scoring.inventory_turnover_days)} hari`}
              score={scoring.inventory_turnover_score ?? 0}
              maxScore={scoring.inventory_turnover_max_score ?? 7}
            />
            <AnimatedGaugeCard
              title="Asset Turnover"
              value={formatPercent(scoring.total_asset_turnover_percent)}
              score={scoring.total_asset_turnover_score ?? 0}
              maxScore={scoring.total_asset_turnover_max_score ?? 7}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ScoreCompositionChart indicators={indicators} />
            <IndicatorLineChartCard indicators={visualIndicators} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <IndicatorTable indicators={indicators} />

            <Card>
              <CardHeader
                title="Management Insight"
                description="Prioritas perhatian berdasarkan indikator dengan capaian paling rendah."
                action={
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                }
              />

              <div className="space-y-3">
                {weakestIndicators.map((indicator) => (
                  <div
                    key={indicator.name}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${getBarClass(
                          indicator.score,
                          indicator.maxScore
                        )}`}
                      />
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {indicator.name}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Nilai saat ini {indicator.value}, skor{" "}
                          <span className="font-bold">{indicator.score}</span>{" "}
                          dari {indicator.maxScore}. Area ini menjadi prioritas
                          pembenahan karena kontribusinya masih rendah terhadap
                          total skor.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-sm font-black text-emerald-900">
                        Konsistensi Akuntansi
                      </p>
                      <p className="mt-1 text-sm leading-6 text-emerald-800">
                        Status neraca:{" "}
                        <span className="font-bold">
                          {scoring.accounting_consistency_status ?? "-"}
                        </span>
                        . Dashboard ini membaca view{" "}
                        <span className="font-bold">
                          v_unit_financial_health_scoring
                        </span>
                        , sehingga rumus tetap berada di database.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <Card className="border-blue-100 bg-blue-50">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700">
                <Gauge className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-bold text-blue-900">
                  Visual baru skoring
                </p>
                <p className="mt-2 text-sm leading-6 text-blue-800">
                  Kartu gauge kini memakai jarum animatif yang bergerak sesuai
                  skor. Kotak visual kanan kini memakai line chart untuk
                  memperjelas pola capaian skor per indikator. Jika nanti ingin
                  line chart bulanan real, kita bisa lanjutkan dari view bulanan.
                </p>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
