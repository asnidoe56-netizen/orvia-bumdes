export const dynamic = "force-dynamic";

import {
  Banknote,
  ClipboardList,
  FileCheck2,
  Landmark,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
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

function getNextAction(plan: BusinessPlanCapitalFlow) {
  if (plan.can_submit_to_facilitator) return "Ajukan Review";
  if (plan.can_submit_to_village) return "Ajukan ke Desa";
  if (plan.can_record_disbursement) return "Catat Dana Cair";
  if (plan.can_allocate_to_unit) return "Alokasikan Modal";
  if (plan.can_edit) return "Lanjutkan Draft";

  return "Lihat Detail";
}

export default async function BumdesMasterPlanPage() {
  const context = await getLoginContext();

  if (!context || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_business_plan_capital_flow")
    .select(
      "business_plan_id, plan_no, title, nama_unit, status, status_label, requested_capital_amount, approved_capital_amount, disbursed_capital_amount, allocated_capital_amount, remaining_to_disburse, remaining_to_allocate, can_edit, can_submit_to_facilitator, can_submit_to_village, can_record_disbursement, can_allocate_to_unit, created_at"
    )
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false });

  const proposalRows = (data ?? []) as BusinessPlanCapitalFlow[];

  const totalProposal = proposalRows.length;
  const waitingReview = proposalRows.filter((plan) =>
    ["submitted_to_facilitator", "under_facilitator_review"].includes(plan.status)
  ).length;
  const totalDisbursed = proposalRows.reduce(
    (total, plan) => total + toNumber(plan.disbursed_capital_amount),
    0
  );
  const totalAllocated = proposalRows.reduce(
    (total, plan) => total + toNumber(plan.allocated_capital_amount),
    0
  );

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        Gagal membaca data Master Plan: {error.message}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Master Plan"
        title="Master Plan / Proposal Modal"
        description="Kelola perencanaan usaha, RAB, review Pendamping Kecamatan, pengajuan ke desa, pencairan dana, dan alokasi modal ke unit usaha."
        action={
          <Link
            href="/bumdes/dashboard/master-plan/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <ClipboardList className="h-4 w-4" />
            Buat Proposal
          </Link>
        }
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Proposal"
          value={String(totalProposal)}
          description="Dibaca dari v_business_plan_capital_flow."
          icon={<ClipboardList className="h-5 w-5" />}
        />

        <StatCard
          title="Menunggu Review"
          value={String(waitingReview)}
          description="Proposal yang menunggu Pendamping Kecamatan."
          icon={<FileCheck2 className="h-5 w-5" />}
        />

        <StatCard
          title="Dana Cair"
          value={formatRupiah(totalDisbursed)}
          description="Modal yang sudah cair ke BUMDes."
          icon={<Landmark className="h-5 w-5" />}
        />

        <StatCard
          title="Dialokasikan ke Unit"
          value={formatRupiah(totalAllocated)}
          description="Modal yang sudah masuk ke unit usaha."
          icon={<Banknote className="h-5 w-5" />}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Alur Governance Master Plan"
          description="Alur ini mengikuti engine database: draft, review Pendamping Kecamatan, keputusan desa, dana cair, lalu alokasi modal ke unit."
          action={<Badge variant="success">Engine Siap</Badge>}
        />

        <div className="grid gap-3 px-5 pb-5 md:grid-cols-5">
          {[
            "Draft Proposal",
            "Review Pendamping",
            "Keputusan Desa",
            "Dana Cair",
            "Alokasi ke Unit",
          ].map((step, index) => (
            <div
              key={step}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
                {index + 1}
              </div>
              <p className="text-sm font-bold text-slate-950">{step}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Daftar Proposal Modal"
          description="Daftar ini membaca status, nominal, dan tombol aksi dari v_business_plan_capital_flow."
          action={<Badge variant="neutral">Database Connected</Badge>}
        />

        <DataTable
          columns={[
            "Nomor Proposal",
            "Judul",
            "Unit Tujuan",
            "Status",
            "Modal Diminta",
            "Modal Disetujui",
            "Dana Cair",
            "Dialokasikan",
            "Aksi",
          ]}
          emptyText="Belum ada proposal modal. Klik Buat Proposal untuk menyusun master plan dan RAB usaha."
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
                      Sisa cair: {formatRupiah(plan.remaining_to_disburse)} · Sisa alokasi:{" "}
                      {formatRupiah(plan.remaining_to_allocate)}
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
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(plan.approved_capital_amount)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(plan.disbursed_capital_amount)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(plan.allocated_capital_amount)}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/bumdes/dashboard/master-plan/${plan.business_plan_id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      {getNextAction(plan)}
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



