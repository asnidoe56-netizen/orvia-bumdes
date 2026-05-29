export const dynamic = "force-dynamic";

import {
  ClipboardCheck,
  Clock3,
  Eye,
  FileSearch,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type BusinessPlanReviewRow = {
  business_plan_id: string;
  tenant_id: string;
  plan_no: string;
  title: string;
  nama_unit: string | null;
  status: string;
  status_label: string;
  requested_capital_amount: number | string | null;
  created_at: string | null;
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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusVariant(status: string) {
  if (status === "submitted_to_facilitator" || status === "under_facilitator_review") {
    return "warning";
  }

  if (status === "ready_for_village_submission") return "success";
  if (status === "needs_revision" || status === "not_feasible") return "danger";

  return "neutral";
}

export default async function PendampingBusinessPlansPage() {
  const context = await getLoginContext();

  if (!context?.user_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_business_plan_capital_flow")
    .select(
      "business_plan_id, tenant_id, plan_no, title, nama_unit, status, status_label, requested_capital_amount, created_at"
    )
    .in("status", ["submitted_to_facilitator", "under_facilitator_review"])
    .order("created_at", { ascending: false });

  const proposalRows = (data ?? []) as BusinessPlanReviewRow[];

  const waitingReview = proposalRows.filter(
    (plan) => plan.status === "submitted_to_facilitator"
  ).length;

  const underReview = proposalRows.filter(
    (plan) => plan.status === "under_facilitator_review"
  ).length;

  const totalRequested = proposalRows.reduce(
    (total, plan) => total + toNumber(plan.requested_capital_amount),
    0
  );

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        Gagal membaca proposal review: {error.message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Ruang Telaah Pendamping Kecamatan
          </div>

          <h1 className="max-w-4xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Review Proposal Master Plan
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Telaah proposal modal BUMDes dengan tenang, jernih, dan bertanggung
            jawab. Setiap catatan pendamping membantu rencana usaha menjadi lebih
            layak, lebih siap, dan lebih aman bagi dana publik.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          title="Menunggu Review"
          value={String(waitingReview)}
          description="Proposal yang sudah diajukan direktur BUMDes."
          icon={<Clock3 className="h-5 w-5" />}
        />

        <StatCard
          title="Sedang Ditelaah"
          value={String(underReview)}
          description="Proposal yang berada dalam ruang analisis pendamping."
          icon={<FileSearch className="h-5 w-5" />}
        />

        <StatCard
          title="Total Modal Diajukan"
          value={formatRupiah(totalRequested)}
          description="Akumulasi modal dari proposal yang perlu direview."
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Daftar Proposal Menunggu Review"
          description="Daftar ini membaca proposal yang sudah diajukan ke Pendamping Kecamatan."
          action={<Badge variant="warning">Perlu Telaah</Badge>}
        />

        <DataTable
          columns={[
            "Nomor Proposal",
            "Judul",
            "Unit",
            "Status",
            "Modal Diminta",
            "Tanggal Dibuat",
            "Aksi",
          ]}
          emptyText="Belum ada proposal yang menunggu review Pendamping Kecamatan."
        >
          {proposalRows.length > 0
            ? proposalRows.map((plan) => (
                <tr key={plan.business_plan_id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-bold text-slate-950">
                    {plan.plan_no}
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-950">{plan.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Tenant: {plan.tenant_id}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {plan.nama_unit ?? "-"}
                  </td>

                  <td className="px-4 py-4">
                    <Badge variant={getStatusVariant(plan.status)}>
                      {plan.status_label}
                    </Badge>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(plan.requested_capital_amount)}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {formatDate(plan.created_at)}
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={`/pendamping/dashboard/business-plans/${plan.business_plan_id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                      Review
                    </Link>
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>
    </div>
  );
}
