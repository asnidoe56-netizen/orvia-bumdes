"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
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

const geminiModels = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

const openAiModels = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano"];

export default function OrviaAiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash-lite");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error(payload.error ?? "Pengaturan Asisten AI belum dapat dibaca.");
      }

      setSettings(payload.settings);
      setProvider(payload.settings.provider);
      setGeminiModel(payload.settings.gemini.model);
      setOpenaiModel(payload.settings.openai.model);
    } catch (loadError) {
      const loadMessage =
        loadError instanceof Error
          ? loadError.message
          : "Pengaturan Asisten AI belum dapat dibaca.";

      setError(loadMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
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
        throw new Error(payload.error ?? "Pengaturan Asisten AI belum berhasil disimpan.");
      }

      setSettings(payload.settings);
      setProvider(payload.settings.provider);
      setGeminiModel(payload.settings.gemini.model);
      setOpenaiModel(payload.settings.openai.model);
      setGeminiApiKey("");
      setOpenaiApiKey("");
      setMessage(payload.message ?? "Pengaturan Asisten AI berhasil disimpan.");
    } catch (saveError) {
      const saveMessage =
        saveError instanceof Error
          ? saveError.message
          : "Pengaturan Asisten AI belum berhasil disimpan.";

      setError(saveMessage);
    } finally {
      setIsSaving(false);
    }
  }

  const activeProviderLabel =
    provider === "gemini" ? "Google Gemini" : "OpenAI";

  return (
    <main className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/unit/dashboard"
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard Unit
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
                Pengaturan Asisten AI
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Pilih layanan AI, atur model, dan simpan API key dari halaman ini.
                API key tidak ditampilkan kembali setelah disimpan.
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
              Provider ini dipakai oleh tombol Tanya ORVIA AI di dashboard unit.
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
              Halaman ini cocok untuk lokal/dev. Untuk produksi, aksesnya harus
              dibatasi ke admin platform dan secret sebaiknya dikelola dari server.
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
    </main>
  );
}
