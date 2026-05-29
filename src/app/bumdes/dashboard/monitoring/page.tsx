import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Database,
  FileClock,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type AuditTimelineRow = {
  id: string;
  tenant_id: string | null;
  unit_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  source_type: string | null;
  source_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatEventLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getEventBadgeVariant(eventType: string) {
  const value = eventType.toLowerCase();

  if (
    value.includes("reject") ||
    value.includes("failed") ||
    value.includes("delete") ||
    value.includes("cancel")
  ) {
    return "danger" as const;
  }

  if (
    value.includes("approve") ||
    value.includes("post") ||
    value.includes("success") ||
    value.includes("completed")
  ) {
    return "success" as const;
  }

  if (
    value.includes("submit") ||
    value.includes("request") ||
    value.includes("review")
  ) {
    return "warning" as const;
  }

  return "warning" as const;
}

function isAttentionEvent(row: AuditTimelineRow) {
  const combined = `${row.event_type} ${row.entity_type} ${row.description ?? ""}`.toLowerCase();

  return (
    combined.includes("reject") ||
    combined.includes("failed") ||
    combined.includes("delete") ||
    combined.includes("cancel") ||
    combined.includes("correction") ||
    combined.includes("koreksi")
  );
}

function getMetadataPreview(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata ?? {}).slice(0, 3);

  if (entries.length === 0) {
    return "-";
  }

  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" • ");
}

export default async function BumdesMonitoringPage() {
  const context = await getLoginContext();

  const tenantId = context?.tenant_id ?? null;

  const supabase = await createClient();

  const { data, error } = tenantId
    ? await supabase
        .from("audit_timeline")
        .select(
          "id, tenant_id, unit_id, actor_id, actor_role, event_type, entity_type, entity_id, source_type, source_id, description, metadata, created_at",
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: null, error: null };

  const activities = (data ?? []) as AuditTimelineRow[];

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayActivities = activities.filter((activity) =>
    activity.created_at.startsWith(todayKey),
  );

  const uniqueUnitCount = new Set(
    activities
      .map((activity) => activity.unit_id)
      .filter((unitId): unitId is string => Boolean(unitId)),
  ).size;

  const attentionActivities = activities.filter(isAttentionEvent);

  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Monitoring"
        title="Monitoring BUMDes"
        description="Pantau jejak aktivitas penting, posting transaksi, alur governance, dan kejadian sistem berdasarkan audit timeline tenant BUMDes."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Aktivitas Terekam"
          value={activities.length.toLocaleString("id-ID")}
          description="Aktivitas terbaru dari audit timeline."
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Aktivitas Hari Ini"
          value={todayActivities.length.toLocaleString("id-ID")}
          description="Aktivitas yang terjadi pada tanggal berjalan."
          icon={<CalendarClock className="h-5 w-5" />}
        />
        <StatCard
          title="Unit Terlibat"
          value={uniqueUnitCount.toLocaleString("id-ID")}
          description="Unit usaha yang muncul dalam audit timeline."
          icon={<Database className="h-5 w-5" />}
        />
        <StatCard
          title="Perlu Perhatian"
          value={attentionActivities.length.toLocaleString("id-ID")}
          description="Aktivitas koreksi, penolakan, pembatalan, atau kegagalan."
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {!tenantId ? (
        <Card>
          <CardHeader
            title="Tenant BUMDes Tidak Ditemukan"
            description="Akun ini belum memiliki tenant aktif sehingga audit timeline belum dapat ditampilkan."
            action={<Badge variant="danger">Tidak Ada Tenant</Badge>}
          />

          <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
            Silakan pastikan akun Direktur BUMDes sudah terhubung ke tenant
            BUMDes melalui data role dan profil pengguna.
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Audit Timeline Aktivitas BUMDes"
            description="Riwayat aktivitas ini bersumber dari tabel audit_timeline dan difilter berdasarkan tenant BUMDes aktif."
            action={
              error ? (
                <Badge variant="danger">Gagal Memuat</Badge>
              ) : (
                <Badge variant="success">Aktif</Badge>
              )
            }
          />

          {error ? (
            <div className="px-5 pb-5 text-sm leading-7 text-red-600">
              Gagal memuat audit timeline: {error.message}
            </div>
          ) : activities.length === 0 ? (
            <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
              Belum ada aktivitas audit timeline untuk tenant BUMDes ini.
              Setelah transaksi, proposal, koreksi, atau proses governance
              berjalan, riwayatnya akan tampil di sini.
            </div>
          ) : (
            <div className="overflow-x-auto px-5 pb-5">
              <table className="min-w-[980px] w-full border-separate border-spacing-y-3 text-left text-sm">
                <thead>
                  <tr className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-4">Waktu</th>
                    <th className="px-4">Aktivitas</th>
                    <th className="px-4">Entitas</th>
                    <th className="px-4">Aktor</th>
                    <th className="px-4">Sumber</th>
                    <th className="px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr
                      key={activity.id}
                      className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
                    >
                      <td className="rounded-l-2xl px-4 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                            <FileClock className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">
                              {formatDateTime(activity.created_at)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              ID: {activity.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <Badge variant={getEventBadgeVariant(activity.event_type)}>
                          {formatEventLabel(activity.event_type)}
                        </Badge>
                        <p className="mt-2 text-xs text-slate-500">
                          {activity.description ?? "Tidak ada deskripsi aktivitas."}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="font-bold text-slate-900">
                          {formatEventLabel(activity.entity_type)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activity.entity_id
                            ? `Entity ID: ${activity.entity_id.slice(0, 8)}`
                            : "Entity ID: -"}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2 text-slate-700">
                          <UserRoundCheck className="h-4 w-4 text-emerald-700" />
                          <span className="font-semibold">
                            {activity.actor_role
                              ? formatEventLabel(activity.actor_role)
                              : "Sistem"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {activity.actor_id
                            ? `User: ${activity.actor_id.slice(0, 8)}`
                            : "User: -"}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-700">
                          {activity.source_type
                            ? formatEventLabel(activity.source_type)
                            : "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activity.source_id
                            ? `Source ID: ${activity.source_id.slice(0, 8)}`
                            : "Source ID: -"}
                        </p>
                      </td>

                      <td className="rounded-r-2xl px-4 py-4 align-top">
                        <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                          <span>{getMetadataPreview(activity.metadata)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

