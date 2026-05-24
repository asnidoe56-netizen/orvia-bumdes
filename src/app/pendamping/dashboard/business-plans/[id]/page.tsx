import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  History,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { reviewBusinessPlanAction } from "./actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type BusinessPlanDetail = {
  business_plan_id: string;
  tenant_id?: string | null;
  plan_no?: string | null;
  title?: string | null;
  business_type?: string | null;
  nama_unit?: string | null;
  status?: string | null;
  status_label?: string | null;
  requested_capital_amount?: number | string | null;
  approved_capital_amount?: number | string | null;
  disbursed_amount?: number | string | null;
  allocated_amount?: number | string | null;
  background?: string | null;
  objectives?: string | null;
  market_analysis?: string | null;
  operational_plan?: string | null;
  risk_analysis?: string | null;
  expected_benefits?: string | null;
  created_at?: string | null;
};

type TimelineRow = {
  id?: string;
  action_type?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  notes?: string | null;
  actor_role?: string | null;
  created_at?: string | null;
};

type BudgetLine = {
  id: string;
  line_no: number;
  category: string;
  description: string;
  quantity: number | string;
  unit_of_measure: string;
  unit_cost: number | string;
  total_amount: number | string;
  calculated_total_amount?: number | string | null;
  notes?: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDecimal(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusVariant(status: string | null | undefined) {
  if (status === "submitted_to_facilitator" || status === "under_facilitator_review") {
    return "warning";
  }

  if (status === "ready_for_village_submission") return "success";
  if (status === "needs_revision" || status === "not_feasible") return "danger";

  return "neutral";
}

function canReview(status: string | null | undefined) {
  return status === "submitted_to_facilitator" || status === "under_facilitator_review";
}

function getReviewHint(status: string | null | undefined) {
  if (canReview(status)) {
    return "Proposal ini sudah berada di meja Pendamping Kecamatan dan dapat direview.";
  }

  return "Proposal ini tidak sedang berada pada tahap review Pendamping Kecamatan.";
}

export default async function PendampingBusinessPlanReviewDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const context = await getLoginContext();

  if (!context?.user_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: planData, error: planError } = await supabase
    .from("v_business_plan_capital_flow")
    .select("*")
    .eq("business_plan_id", id)
    .single();

  if (planError || !planData) {
    notFound();
  }

  const { data: narrativeData } = await supabase
    .from("business_plans")
    .select(
      "background, objectives, market_analysis, operational_plan, risk_analysis, expected_benefits"
    )
    .eq("id", id)
    .single();

  const plan = {
    ...(planData as BusinessPlanDetail),
    ...(narrativeData ?? {}),
  } as BusinessPlanDetail;

  const { data: timelineData } = await supabase
    .from("v_business_plan_governance_timeline")
    .select("*")
    .eq("business_plan_id", id)
    .order("created_at", { ascending: true });

  const timelineRows = (timelineData ?? []) as TimelineRow[];

  const { data: budgetData } = await supabase
    .from("v_business_plan_budget_lines")
    .select(
      "id, line_no, category, description, quantity, unit_of_measure, unit_cost, total_amount, calculated_total_amount, notes"
    )
    .eq("business_plan_id", id)
    .order("line_no", { ascending: true });

  const budgetRows = (budgetData ?? []) as BudgetLine[];
  const budgetTotal = budgetRows.reduce(
    (total, item) =>
      total +
      (toNumber(item.calculated_total_amount) > 0
        ? toNumber(item.calculated_total_amount)
        : toNumber(item.total_amount) > 0
          ? toNumber(item.total_amount)
          : toNumber(item.quantity) * toNumber(item.unit_cost)),
    0
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <Link
        href="/pendamping/dashboard/business-plans"
        className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar proposal
      </Link>

      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Telaah Kelayakan Usaha
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {plan.title ?? "Proposal Master Plan"}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                {plan.plan_no ?? "-"} · {plan.nama_unit ?? "Unit belum tersedia"} ·{" "}
                {plan.business_type ?? "Jenis usaha belum tersedia"}
              </p>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                {getReviewHint(plan.status)}
              </p>
            </div>

            <Badge variant={getStatusVariant(plan.status)}>
              {plan.status_label ?? plan.status ?? "-"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        <StatCard
          title="Modal Diminta"
          value={formatRupiah(plan.requested_capital_amount)}
          description="Nilai RAB yang diajukan."
          icon={<ClipboardCheck className="h-5 w-5" />}
        />

        <StatCard
          title="Modal Disetujui"
          value={formatRupiah(plan.approved_capital_amount)}
          description="Masih menunggu keputusan desa."
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <StatCard
          title="Dana Cair"
          value={formatRupiah(plan.disbursed_amount)}
          description="Setelah keputusan dan pencairan."
          icon={<FileSearch className="h-5 w-5" />}
        />

        <StatCard
          title="Dialokasikan"
          value={formatRupiah(plan.allocated_amount)}
          description="Masuk ke unit usaha."
          icon={<Lightbulb className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader
            title="Isi Proposal"
            description="Ringkasan narasi yang perlu ditelaah sebelum memberi rekomendasi."
          />

          <div className="space-y-4 px-5 pb-5 text-sm leading-7 text-slate-700">
            <section>
              <h3 className="font-black text-slate-950">Latar Belakang</h3>
              <p>{plan.background || "Belum ada latar belakang."}</p>
            </section>

            <section>
              <h3 className="font-black text-slate-950">Tujuan</h3>
              <p>{plan.objectives || "Belum ada tujuan."}</p>
            </section>

            <section>
              <h3 className="font-black text-slate-950">Analisis Pasar</h3>
              <p>{plan.market_analysis || "Belum ada analisis pasar."}</p>
            </section>

            <section>
              <h3 className="font-black text-slate-950">Rencana Operasional</h3>
              <p>{plan.operational_plan || "Belum ada rencana operasional."}</p>
            </section>

            <section>
              <h3 className="font-black text-slate-950">Risiko</h3>
              <p>{plan.risk_analysis || "Belum ada analisis risiko."}</p>
            </section>

            <section>
              <h3 className="font-black text-slate-950">Manfaat yang Diharapkan</h3>
              <p>{plan.expected_benefits || "Belum ada manfaat yang ditulis."}</p>
            </section>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Form Review Pendamping"
            description="Catatan kelayakan wajib diisi. Hasil review akan mengubah status proposal."
            action={
              canReview(plan.status) ? (
                <Badge variant="warning">Siap Direview</Badge>
              ) : (
                <Badge variant="neutral">Tidak Aktif</Badge>
              )
            }
          />

          {canReview(plan.status) ? (
            <form action={reviewBusinessPlanAction} className="space-y-4 px-5 pb-5">
              <input
                type="hidden"
                name="business_plan_id"
                value={plan.business_plan_id}
              />

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-900">
                  Hasil Review
                </span>
                <select
                  name="review_result"
                  required
                  defaultValue="ready_for_village_submission"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="ready_for_village_submission">
                    Layak / Siap Diajukan ke Desa
                  </option>
                  <option value="needs_revision">
                    Perlu Perbaikan
                  </option>
                  <option value="not_feasible">
                    Belum Layak
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-900">
                  Catatan Kelayakan
                </span>
                <textarea
                  name="feasibility_notes"
                  required
                  rows={4}
                  placeholder="Tuliskan analisis kelayakan usaha, kesiapan pengelola, dan alasan rekomendasi."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-900">
                  Catatan RAB
                </span>
                <textarea
                  name="budget_notes"
                  rows={3}
                  placeholder="Opsional. Catatan kewajaran RAB, prioritas belanja, atau koreksi anggaran."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-900">
                  Catatan Risiko
                </span>
                <textarea
                  name="risk_notes"
                  rows={3}
                  placeholder="Opsional. Risiko pasar, operasional, pengawasan, atau keberlanjutan."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-900">
                  Rekomendasi Pendamping
                </span>
                <textarea
                  name="recommendation_notes"
                  rows={3}
                  placeholder="Opsional. Rekomendasi tindak lanjut sebelum atau setelah diajukan ke desa."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500"
              >
                Simpan Review Proposal
              </button>
            </form>
          ) : (
            <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
              Proposal ini sudah tidak berada pada tahap review Pendamping
              Kecamatan, sehingga form review tidak ditampilkan.
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="RAB / Rencana Anggaran Biaya"
          description="Rincian angka proposal yang menjadi dasar penilaian kewajaran modal."
          action={
            <Badge variant="info">
              Total {formatRupiah(budgetTotal)}
            </Badge>
          }
        />

        <DataTable
          columns={[
            "No",
            "Kategori",
            "Uraian",
            "Jumlah",
            "Satuan",
            "Harga Satuan",
            "Total",
            "Catatan",
          ]}
          emptyText="Belum ada rincian RAB untuk proposal ini."
        >
          {budgetRows.length > 0
            ? budgetRows.map((item) => {
                const lineTotal =
                  toNumber(item.calculated_total_amount) > 0
                    ? toNumber(item.calculated_total_amount)
                    : toNumber(item.total_amount) > 0
                      ? toNumber(item.total_amount)
                      : toNumber(item.quantity) * toNumber(item.unit_cost);

                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-bold text-slate-950">
                      {item.line_no}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {item.category}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {item.description}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-700">
                      {formatDecimal(item.quantity)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.unit_of_measure}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-700">
                      {formatRupiah(item.unit_cost)}
                    </td>
                    <td className="px-4 py-4 text-right font-black text-slate-950">
                      {formatRupiah(lineTotal)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.notes ?? "-"}
                    </td>
                  </tr>
                );
              })
            : null}
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title="Timeline Governance"
          description="Jejak status dan tanggung jawab proposal."
          action={<History className="h-5 w-5 text-slate-500" />}
        />

        <DataTable
          columns={["Waktu", "Aksi", "Status Lama", "Status Baru", "Catatan"]}
          emptyText="Belum ada timeline governance."
        >
          {timelineRows.length > 0
            ? timelineRows.map((item, index) => (
                <tr key={item.id ?? `${item.action_type}-${index}`} className="hover:bg-slate-50">
                  <td className="px-4 py-4 text-slate-600">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-950">
                    {item.action_type ?? "-"}
                    <div className="mt-1 text-xs text-slate-500">
                      {item.actor_role ?? "-"}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {item.old_status ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-900">
                    {item.new_status ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {item.notes ?? "-"}
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>
    </div>
  );
}



