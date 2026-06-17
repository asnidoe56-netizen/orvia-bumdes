"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";

type UnitHealthSummary = {
  mode: "read_only";
  tool: "orvia.read.unit_health_summary";
  scope: string;
  tenant_id: string;
  unit_id: string | null;
  summary: {
    cash_bank_balance: number;
    customer_receivable_outstanding: number;
    supplier_payable_outstanding: number;
    inventory_value: number;
    net_liquid_position: number;
    customer_receivable_invoice_count: number;
    supplier_payable_invoice_count: number;
    inventory_item_count: number;
    low_or_empty_inventory_count: number;
  };
  attention_notes: string[];
};

type ApiError = {
  error?: string;
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function OrviaAiUnitSummaryCard() {
  const [data, setData] = useState<UnitHealthSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadSummary() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orvia-ai/read/unit-health-summary", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const payload = (await response.json()) as UnitHealthSummary & ApiError;

      if (!response.ok) {
        throw new Error(payload.error ?? "Ringkasan ORVIA AI belum dapat dibaca.");
      }

      setData(payload);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Ringkasan ORVIA AI belum dapat dibaca.";

      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSummary() {
      try {
        const response = await fetch("/api/orvia-ai/read/unit-health-summary", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const payload = (await response.json()) as UnitHealthSummary & ApiError;

        if (!response.ok) {
          throw new Error(payload.error ?? "Ringkasan ORVIA AI belum dapat dibaca.");
        }

        if (isMounted) {
          setData(payload);
        }
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Ringkasan ORVIA AI belum dapat dibaca.";

        if (isMounted) {
          setError(message);
          setData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const mainInsight = useMemo(() => {
    if (!data) {
      return "ORVIA AI sedang menyiapkan ringkasan kondisi unit.";
    }

    if (data.summary.supplier_payable_outstanding > data.summary.cash_bank_balance) {
      return "Hutang supplier lebih besar dari saldo kas/bank. Perlu perhatian sebelum pembayaran baru.";
    }

    if (data.summary.customer_receivable_invoice_count > 0) {
      return "Kas masih kuat, tetapi ada piutang pelanggan yang perlu dipantau.";
    }

    if (data.summary.low_or_empty_inventory_count > 0) {
      return "Ada stok rendah atau kosong yang perlu diperiksa.";
    }

    return "Kondisi awal unit terlihat stabil dari kas/bank, piutang, hutang supplier, dan stok.";
  }, [data]);

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-sm">
      <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-6">
        <div className="flex flex-col justify-between gap-5">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <Bot className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  ORVIA AI
                </p>
                <h2 className="text-xl font-black text-slate-950">
                  Ringkasan Kesehatan Unit
                </h2>
              </div>
            </div>

            <p className="max-w-2xl text-sm leading-6 text-slate-700">
              AI membaca data unit secara terbatas dari kas/bank, piutang,
              hutang supplier, dan stok. AI hanya membaca data, tidak bisa
              posting, mengubah transaksi, atau mengubah saldo.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white/80 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <p className="text-sm font-black text-slate-950">
                Jawaban singkat
              </p>
            </div>

            {isLoading ? (
              <p className="text-sm leading-6 text-slate-600">
                Membaca ringkasan unit...
              </p>
            ) : error ? (
              <p className="text-sm leading-6 text-red-700">{error}</p>
            ) : (
              <p className="text-sm leading-6 text-slate-700">{mainInsight}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void loadSummary()}
            className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Muat ulang ringkasan
          </button>
        </div>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Kas/Bank
                  </p>
                  <p className="mt-2 text-xl font-black text-slate-950">
                    {data ? formatRupiah(data.summary.cash_bank_balance) : "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Posisi Likuid Bersih
                  </p>
                  <p className="mt-2 text-xl font-black text-slate-950">
                    {data ? formatRupiah(data.summary.net_liquid_position) : "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Piutang Pelanggan
                  </p>
                  <p className="mt-2 text-xl font-black text-slate-950">
                    {data
                      ? formatRupiah(data.summary.customer_receivable_outstanding)
                      : "-"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {data ? `${data.summary.customer_receivable_invoice_count} invoice` : ""}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Hutang Supplier
                  </p>
                  <p className="mt-2 text-xl font-black text-slate-950">
                    {data
                      ? formatRupiah(data.summary.supplier_payable_outstanding)
                      : "-"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {data ? `${data.summary.supplier_payable_invoice_count} invoice` : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">
                    Catatan Transparansi Transaksi
                  </p>
                  {data?.summary.low_or_empty_inventory_count ? (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                </div>

                <div className="space-y-2">
                  {(data?.attention_notes ?? ["Menunggu ringkasan ORVIA AI."]).map(
                    (note) => (
                      <p
                        key={note}
                        className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700"
                      >
                        {note}
                      </p>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Nilai Stok
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {data ? formatRupiah(data.summary.inventory_value) : "-"}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {data
                    ? `${data.summary.inventory_item_count} item aktif, ${data.summary.low_or_empty_inventory_count} stok rendah/kosong`
                    : ""}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
