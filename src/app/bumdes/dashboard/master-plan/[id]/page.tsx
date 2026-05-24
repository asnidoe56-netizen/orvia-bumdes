import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileText,
  Flame,
  Landmark,
  Leaf,
  Lightbulb,
  Route,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type BusinessPlanCapitalFlow = {
  business_plan_id: string;
  plan_no: string;
  title: string;
  nama_unit: string | null;
  status: string;
  status_label: string;
  requested_capital_amount: number | string | null;
  approved_capital_amount: number | string | null;
  disbursed_capital_amount: number | string | null;
  allocated_capital_amount: number | string | null;
  remaining_to_disburse: number | string | null;
  remaining_to_allocate: number | string | null;
  can_edit: boolean | null;
  can_submit_to_facilitator: boolean | null;
  can_submit_to_village: boolean | null;
  can_record_disbursement: boolean | null;
  can_allocate_to_unit: boolean | null;
  created_at: string | null;
};

type TimelineRow = Record<string, string | number | boolean | null>;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
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

function formatDate(value: string | number | boolean | null | undefined) {
  if (!value || typeof value !== "string") return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusVariant(status: string) {
  if (status === "allocated_to_unit" || status === "disbursed") return "success";

  if (
    status === "submitted_to_facilitator" ||
    status === "under_facilitator_review" ||
    status === "submitted_to_village"
  ) {
    return "warning";
  }

  if (status === "needs_revision" || status === "not_feasible") return "danger";

  if (status === "approved_by_village" || status === "ready_for_village_submission") {
    return "info";
  }

  return "neutral";
}

function getProgressPercent(status: string) {
  const progressMap: Record<string, number> = {
    draft: 12,
    submitted_to_facilitator: 25,
    under_facilitator_review: 36,
    needs_revision: 40,
    not_feasible: 40,
    ready_for_village_submission: 52,
    submitted_to_village: 64,
    approved_by_village: 76,
    rejected_by_village: 76,
    disbursed: 88,
    allocated_to_unit: 100,
    closed: 100,
    cancelled: 100,
  };

  return progressMap[status] ?? 10;
}

function getProgressMessage(status: string) {
  if (status === "allocated_to_unit") {
    return "Modal sudah sampai ke unit. Kini energi kerja berpindah dari rencana menjadi gerak nyata.";
  }

  if (status === "disbursed") {
    return "Dana sudah cair ke BUMDes. Langkah berikutnya adalah memastikan modal menemukan unit yang tepat.";
  }

  if (status === "approved_by_village") {
    return "Proposal sudah disetujui desa. Kepercayaan sudah diberikan, sekarang tata kelola harus dijaga.";
  }

  if (status === "ready_for_village_submission") {
    return "Pendamping sudah memberi lampu hijau. Rencana makin matang untuk dibawa ke keputusan desa.";
  }

  if (status === "needs_revision") {
    return "Revisi bukan mundur. Revisi adalah cara proposal menjadi lebih kuat sebelum membawa dana publik.";
  }

  return "Setiap proposal yang rapi adalah janji kerja: uang publik harus bergerak dengan arah, bukti, dan manfaat.";
}

function getNextAction(plan: BusinessPlanCapitalFlow) {
  if (plan.can_submit_to_facilitator) return "Ajukan Review Pendamping";
  if (plan.can_submit_to_village) return "Ajukan ke Desa";
  if (plan.can_record_disbursement) return "Catat Dana Cair";
  if (plan.can_allocate_to_unit) return "Alokasikan Modal ke Unit";
  if (plan.can_edit) return "Lanjutkan Draft";

  return "Workflow Selesai / Lihat Arsip";
}

function getTimelineTitle(row: TimelineRow) {
  return (
    row.step_label ??
    row.event_label ??
    row.status_label ??
    row.title ??
    row.status ??
    "Tahap Governance"
  );
}

function getTimelineDescription(row: TimelineRow) {
  return (
    row.description ??
    row.notes ??
    row.note ??
    row.remarks ??
    row.actor_role ??
    "Tahap ini tercatat sebagai bagian dari jejak governance proposal."
  );
}

function getTimelineDate(row: TimelineRow) {
  return (
    row.created_at ??
    row.event_at ??
    row.changed_at ??
    row.reviewed_at ??
    row.decided_at ??
    row.posted_at ??
    null
  );
}

export default async function BumdesMasterPlanDetailPage({ params }: PageProps) {
  const { id } = await params;
  const context = await getLoginContext();

  if (!context || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: planData, error: planError } = await supabase
    .from("v_business_plan_capital_flow")
    .select("*")
    .eq("tenant_id", context.tenant_id)
    .eq("business_plan_id", id)
    .single();

  if (planError || !planData) {
    notFound();
  }

  const plan = planData as BusinessPlanCapitalFlow;

  const { data: timelineData } = await supabase
    .from("v_business_plan_governance_timeline")
    .select("*")
    .eq("business_plan_id", id);

  const timelineRows = (timelineData ?? []) as TimelineRow[];
  const progress = getProgressPercent(plan.status);

  const moneyCards = [
    {
      title: "Modal Diminta",
      value: formatRupiah(plan.requested_capital_amount),
      icon: <FileText className="h-5 w-5" />,
      description: "Nilai kebutuhan awal yang diajukan dalam master plan.",
    },
    {
      title: "Modal Disetujui",
      value: formatRupiah(plan.approved_capital_amount),
      icon: <ClipboardCheck className="h-5 w-5" />,
      description: "Nilai yang sudah melewati keputusan governance.",
    },
    {
      title: "Dana Cair",
      value: formatRupiah(plan.disbursed_capital_amount),
      icon: <Landmark className="h-5 w-5" />,
      description: "Dana yang sudah masuk ke kas atau bank BUMDes.",
    },
    {
      title: "Masuk ke Unit",
      value: formatRupiah(plan.allocated_capital_amount),
      icon: <Banknote className="h-5 w-5" />,
      description: "Modal yang sudah dialokasikan ke unit pelaksana.",
    },
  ];

  const governanceSteps = [
    "Draft Proposal",
    "Review Pendamping",
    "Keputusan Desa",
    "Dana Cair",
    "Alokasi ke Unit",
  ];

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

            <Badge variant={getStatusVariant(plan.status)}>
              {plan.status_label}
            </Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr] lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                <Sparkles className="h-3.5 w-3.5" />
                Proposal Modal Produktif
              </div>

              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {plan.title}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                {getProgressMessage(plan.status)}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  {plan.plan_no}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  Unit: {plan.nama_unit ?? "-"}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  Dibuat: {formatDate(plan.created_at)}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">Progress Governance</p>
                <p className="text-2xl font-black text-emerald-700">{progress}%</p>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900 ring-1 ring-amber-100">
                <div className="mb-2 flex items-center gap-2 font-black">
                  <Flame className="h-4 w-4" />
                  Energi Kerja
                </div>
                Rencana yang terang membuat kerja lebih ringan. Modal yang tercatat
                rapi membuat kepercayaan tumbuh.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {moneyCards.map((card) => (
          <section
            key={card.title}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">{card.title}</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {card.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {card.description}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                {card.icon}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader
            title="Peta Jalan Governance"
            description="Satu proposal bergerak dari gagasan, review, keputusan, pencairan, lalu menjadi modal kerja unit."
            action={<Badge variant="success">Terkendali</Badge>}
          />

          <div className="grid gap-3 md:grid-cols-5">
            {governanceSteps.map((step, index) => {
              const isDone = progress >= ((index + 1) / governanceSteps.length) * 100;

              return (
                <div
                  key={step}
                  className={[
                    "rounded-2xl border p-4 transition",
                    isDone
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "mb-3 flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black",
                      isDone
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-500 ring-1 ring-slate-200",
                    ].join(" ")}
                  >
                    {isDone ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                  </div>
                  <p className="text-sm font-black text-slate-950">{step}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Aksi Berikutnya"
            description="Panel ini mengikuti sinyal boolean dari engine database."
            action={<Target className="h-5 w-5 text-emerald-700" />}
          />

          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500">
              <Route className="h-6 w-6" />
            </div>

            <p className="text-xl font-black">{getNextAction(plan)}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Sistem menjaga alur agar setiap tahap tidak loncat, tidak samar,
              dan tetap punya jejak tanggung jawab.
            </p>

            <div className="mt-5 grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                <span>Sisa untuk dicairkan</span>
                <strong>{formatRupiah(plan.remaining_to_disburse)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                <span>Sisa untuk dialokasikan</span>
                <strong>{formatRupiah(plan.remaining_to_allocate)}</strong>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader
            title="Filosofi Kerja"
            description="Supaya layar ini bukan sekadar angka, tetapi pengingat arah."
            action={<Lightbulb className="h-5 w-5 text-amber-500" />}
          />

          <div className="space-y-3">
            {[
              {
                icon: <Leaf className="h-5 w-5" />,
                title: "Tumbuh pelan, tercatat rapi",
                text: "BUMDes yang kuat tidak hanya mengejar besar, tetapi menjaga akar: data, bukti, dan manfaat warga.",
              },
              {
                icon: <WalletCards className="h-5 w-5" />,
                title: "Modal adalah amanah kerja",
                text: "Setiap rupiah harus punya cerita: dari mana datangnya, ke mana bergeraknya, dan manfaat apa yang ditumbuhkan.",
              },
              {
                icon: <Sparkles className="h-5 w-5" />,
                title: "Kerja baik perlu rasa terang",
                text: "UI yang bersih membantu pikiran tetap lapang, supaya keputusan tidak terasa berat.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  {item.icon}
                </div>
                <p className="font-black text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Timeline Governance"
            description="Jejak perjalanan proposal dari database governance timeline."
            action={<Badge variant="neutral">{timelineRows.length} Catatan</Badge>}
          />

          {timelineRows.length > 0 ? (
            <div className="space-y-3">
              {timelineRows.map((row, index) => (
                <div
                  key={`${String(getTimelineTitle(row))}-${index}`}
                  className="relative rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <CircleDot className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="font-black text-slate-950">
                        {String(getTimelineTitle(row))}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {String(getTimelineDescription(row))}
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        {formatDate(getTimelineDate(row))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="font-black text-slate-950">Timeline belum tersedia</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Saat proposal bergerak melalui engine governance, jejak tahapannya
                akan tampil di sini.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

