"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Power,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

type AiProvider = "gemini" | "openai";

type AiSettings = {
  provider: AiProvider;
  gemini: {
    model: string;
    apiKeyConfigured: boolean;
    apiKeyLength: number;
  };
  openai: {
    model: string;
    apiKeyConfigured: boolean;
    apiKeyLength: number;
  };
  canWrite: boolean;
};

type SettingsPayload = {
  success?: boolean;
  message?: string;
  error?: string;
  settings?: AiSettings;
};

type TenantAccessRow = {
  tenant_id: string;
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  status: string | null;
  is_enabled: boolean;
  transaction_assistant_enabled: boolean;
  notes: string | null;
  transaction_assistant_notes: string | null;
  enabled_at: string | null;
  disabled_at: string | null;
  transaction_assistant_enabled_at: string | null;
  transaction_assistant_disabled_at: string | null;
  updated_at: string | null;
};

type TenantAccessPayload = {
  success?: boolean;
  message?: string;
  error?: string;
  tenants?: TenantAccessRow[];
};

const geminiModels = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

const openAiModels = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano"];

function statusLabel(status: string | null) {
  if (status === "active") return "Aktif";
  if (status === "inactive") return "Nonaktif";
  return status ?? "-";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OrviaAiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash-lite");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [tenantAccess, setTenantAccess] = useState<TenantAccessRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  async function loadSettings() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orvia-ai/settings", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const payload = (await response.json()) as SettingsPayload;

      if (!response.ok || !payload.success || !payload.settings) {
        throw new Error(
          payload.error ?? "Pengaturan ORVIA AI Platform belum dapat dibaca."
        );
      }

      setSettings(payload.settings);
      setProvider(payload.settings.provider);
      setGeminiModel(payload.settings.gemini.model);
      setOpenaiModel(payload.settings.openai.model);
    } catch (loadError) {
      const loadMessage =
        loadError instanceof Error
          ? loadError.message
          : "Pengaturan ORVIA AI Platform belum dapat dibaca.";

      setError(loadMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTenantAccess() {
    setIsLoadingAccess(true);
    setAccessError(null);

    try {
      const response = await fetch("/api/orvia-ai/tenant-access", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const payload = (await response.json()) as TenantAccessPayload;

      if (!response.ok || !payload.success || !payload.tenants) {
        throw new Error(
          payload.error ?? "Daftar izin BUMDes belum dapat dibaca."
        );
      }

      setTenantAccess(payload.tenants);
    } catch (loadError) {
      const loadMessage =
        loadError instanceof Error
          ? loadError.message
          : "Daftar izin BUMDes belum dapat dibaca.";

      setAccessError(loadMessage);
    } finally {
      setIsLoadingAccess(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSettings();
      void loadTenantAccess();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/orvia-ai/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          provider,
          geminiModel,
          openaiModel,
          geminiApiKey: geminiApiKey.trim() || undefined,
          openaiApiKey: openaiApiKey.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as SettingsPayload;

      if (!response.ok || !payload.success || !payload.settings) {
        throw new Error(
          payload.error ?? "Pengaturan ORVIA AI Platform belum berhasil disimpan."
        );
      }

      setSettings(payload.settings);
      setProvider(payload.settings.provider);
      setGeminiModel(payload.settings.gemini.model);
      setOpenaiModel(payload.settings.openai.model);
      setGeminiApiKey("");
      setOpenaiApiKey("");
      setMessage(
        payload.message ?? "Pengaturan ORVIA AI Platform berhasil disimpan."
      );
    } catch (saveError) {
      const saveMessage =
        saveError instanceof Error
          ? saveError.message
          : "Pengaturan ORVIA AI Platform belum berhasil disimpan.";

      setError(saveMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleTenantAccess(
    tenant: TenantAccessRow,
    feature: "orvia_ai" | "transaction_assistant"
  ) {
    const isTransactionAssistant = feature === "transaction_assistant";
    const nextEnabled = isTransactionAssistant
      ? !tenant.transaction_assistant_enabled
      : !tenant.is_enabled;

    setSavingTenantId(tenant.tenant_id);
    setMessage(null);
    setAccessError(null);

    try {
      const response = await fetch("/api/orvia-ai/tenant-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          tenantId: tenant.tenant_id,
          feature,
          isEnabled: nextEnabled,
          notes: isTransactionAssistant
            ? nextEnabled
              ? "Asisten Catat Transaksi diaktifkan dari Dashboard Platform."
              : "Asisten Catat Transaksi dinonaktifkan dari Dashboard Platform."
            : nextEnabled
              ? "ORVIA AI diaktifkan dari Dashboard Platform."
              : "ORVIA AI dinonaktifkan dari Dashboard Platform.",
        }),
      });

      const payload = (await response.json()) as TenantAccessPayload;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ?? "Izin fitur BUMDes belum berhasil disimpan."
        );
      }

      setMessage(payload.message ?? "Izin fitur BUMDes berhasil disimpan.");

      await loadTenantAccess();
    } catch (saveError) {
      const saveMessage =
        saveError instanceof Error
          ? saveError.message
          : "Izin fitur BUMDes belum berhasil disimpan.";

      setAccessError(saveMessage);
    } finally {
      setSavingTenantId(null);
    }
  }

  const activeProviderLabel =
    provider === "gemini" ? "Google Gemini" : "OpenAI";

  const enabledTenantCount = useMemo(
    () => tenantAccess.filter((tenant) => tenant.is_enabled).length,
    [tenantAccess]
  );

  return (
    <main className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/platform/dashboard"
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard Platform
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Bot className="h-7 w-7" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                ORVIA AI
              </p>
              <h1 className="text-2xl font-black text-slate-950">
                Pengaturan ORVIA AI Platform
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Pilih layanan AI, atur model, simpan API key, dan tentukan
                BUMDes mana yang diizinkan memakai ORVIA AI. API key tidak
                ditampilkan kembali setelah disimpan.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            <p className="font-black text-emerald-800">Provider aktif</p>
            <p className="mt-1 font-semibold text-emerald-700">
              {activeProviderLabel}
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={saveSettings}
        className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <p className="text-sm font-black text-slate-950">
                Pilih Provider
              </p>
            </div>

            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as AiProvider)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
            </select>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Pengaturan ini hanya untuk Super Admin Platform. Provider dipakai
              oleh fitur ORVIA AI yang diizinkan pada tenant/BUMDes.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              <p className="text-sm font-black text-amber-900">
                Catatan Keamanan
              </p>
            </div>
            <p className="text-xs leading-5 text-amber-800">
              ORVIA AI tidak memberi hak posting transaksi. Untuk produksi,
              secret tetap sebaiknya dikelola dari server, sedangkan izin
              penggunaan AI dikendalikan dari database per BUMDes.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Membaca pengaturan...
            </div>
          ) : null}

          {message ? (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-emerald-700" />
              <div>
                <p className="text-sm font-black text-slate-950">
                  Google Gemini
                </p>
                <p className="text-xs text-slate-500">
                  Status key:{" "}
                  <span className="font-bold">
                    {settings?.gemini.apiKeyConfigured
                      ? `Terpasang (${settings.gemini.apiKeyLength} karakter)`
                      : "Belum ada"}
                  </span>
                </p>
              </div>
            </div>

            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
              Model Gemini
            </label>
            <input
              list="gemini-models"
              value={geminiModel}
              onChange={(event) => setGeminiModel(event.target.value)}
              className="mb-4 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
            <datalist id="gemini-models">
              {geminiModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>

            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
              Gemini API Key Baru
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(event) => setGeminiApiKey(event.target.value)}
              placeholder="Kosongkan jika tidak ingin mengganti key"
              className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-700" />
              <div>
                <p className="text-sm font-black text-slate-950">OpenAI</p>
                <p className="text-xs text-slate-500">
                  Status key:{" "}
                  <span className="font-bold">
                    {settings?.openai.apiKeyConfigured
                      ? `Terpasang (${settings.openai.apiKeyLength} karakter)`
                      : "Belum ada"}
                  </span>
                </p>
              </div>
            </div>

            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
              Model OpenAI
            </label>
            <input
              list="openai-models"
              value={openaiModel}
              onChange={(event) => setOpenaiModel(event.target.value)}
              className="mb-4 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
            <datalist id="openai-models">
              {openAiModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>

            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
              OpenAI API Key Baru
            </label>
            <input
              type="password"
              value={openaiApiKey}
              onChange={(event) => setOpenaiApiKey(event.target.value)}
              placeholder="Kosongkan jika tidak ingin mengganti key"
              className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </section>

          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-700" />
              <h2 className="text-xl font-black text-slate-950">
                Izin ORVIA AI per BUMDes
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              BUMDes yang belum diizinkan tetap bisa memakai pembaca lokal pada
              form transaksi, tetapi tidak bisa memakai layanan AI eksternal.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <p className="font-black text-emerald-800">Diizinkan</p>
              <p className="mt-1 font-semibold text-emerald-700">
                {enabledTenantCount} dari {tenantAccess.length} BUMDes
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadTenantAccess()}
              disabled={isLoadingAccess}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoadingAccess ? "animate-spin" : ""}`}
              />
              Muat Ulang
            </button>
          </div>
        </div>

        {accessError ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {accessError}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs font-black uppercase tracking-wide text-slate-500">
                <th className="border-b border-slate-200 px-4 py-3">BUMDes</th>
                <th className="border-b border-slate-200 px-4 py-3">Desa</th>
                <th className="border-b border-slate-200 px-4 py-3">
                  Kecamatan
                </th>
                <th className="border-b border-slate-200 px-4 py-3">
                  Status Tenant
                </th>
                <th className="border-b border-slate-200 px-4 py-3">
                  Status ORVIA AI
                </th>
                <th className="border-b border-slate-200 px-4 py-3">
                  Update Terakhir
                </th>
                <th className="border-b border-slate-200 px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingAccess ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm font-bold text-slate-500"
                  >
                    Membaca daftar BUMDes...
                  </td>
                </tr>
              ) : tenantAccess.length > 0 ? (
                tenantAccess.map((tenant) => {
                  const isSavingThisTenant = savingTenantId === tenant.tenant_id;

                  return (
                    <tr key={tenant.tenant_id} className="align-top">
                      <td className="border-b border-slate-100 px-4 py-4">
                        <p className="font-black text-slate-950">
                          {tenant.nama_bumdes ?? "-"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {tenant.kode_bumdes ?? "Tanpa kode"} Ãƒâ€šÃ‚Â· ID{" "}
                          {tenant.tenant_id.slice(0, 8)}...
                        </p>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 font-bold text-slate-700">
                        {tenant.nama_desa ?? "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 font-bold text-slate-700">
                        {tenant.nama_kecamatan ?? "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                            tenant.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {statusLabel(tenant.status)}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                            tenant.is_enabled
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {tenant.is_enabled ? "Diizinkan" : "Tidak Diizinkan"}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-xs font-semibold leading-5 text-slate-600">
                        {formatDateTime(tenant.updated_at)}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void toggleTenantAccess(tenant, "orvia_ai")}
                          disabled={isSavingThisTenant}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            tenant.is_enabled
                              ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "bg-emerald-700 text-white hover:bg-emerald-800"
                          }`}
                        >
                          {isSavingThisTenant ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          {tenant.is_enabled ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm font-bold text-slate-500"
                  >
                    Belum ada BUMDes/tenant yang terbaca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
