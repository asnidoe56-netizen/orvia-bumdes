"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";

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

function buildLocalGreetingAnswer(question: string) {
  const normalizedQuestion = question.toLowerCase().trim();

  const greetingWords = [
    "halo",
    "halow",
    "hallo",
    "hai",
    "hi",
    "hello",
    "tes",
    "test",
    "pagi",
    "siang",
    "sore",
    "malam",
  ];

  if (greetingWords.includes(normalizedQuestion)) {
    return "Halo, saya ORVIA AI. Saya bisa membantu membaca kondisi kas/bank, piutang pelanggan, hutang supplier, stok, dan catatan perhatian unit. Silakan tanya, misalnya: Berapa kas saya hari ini?";
  }

  return null;
}
function buildLocalAnswer(question: string, data: UnitHealthSummary | null) {
  if (!data) {
    return "Ringkasan unit belum selesai dibaca. Klik Muat ulang ringkasan, lalu coba bertanya lagi.";
  }

  const normalizedQuestion = question.toLowerCase().trim();

  if (!normalizedQuestion) {
    return "Tulis pertanyaan dulu. Contoh: Berapa kas saya hari ini?";
  }

  if (
    normalizedQuestion.includes("kas") ||
    normalizedQuestion.includes("bank") ||
    normalizedQuestion.includes("saldo")
  ) {
    return `Saldo kas/bank unit saat ini ${formatRupiah(
      data.summary.cash_bank_balance
    )}. Posisi likuid bersih setelah memperhitungkan piutang dan hutang supplier adalah ${formatRupiah(
      data.summary.net_liquid_position
    )}.`;
  }

  if (
    normalizedQuestion.includes("piutang") ||
    normalizedQuestion.includes("tagih") ||
    normalizedQuestion.includes("pelanggan")
  ) {
    return `Piutang pelanggan yang masih terbuka saat ini ${formatRupiah(
      data.summary.customer_receivable_outstanding
    )} dari ${data.summary.customer_receivable_invoice_count} invoice. Perlu dipantau agar pembayaran pelanggan tidak tertunda terlalu lama.`;
  }

  if (
    normalizedQuestion.includes("hutang") ||
    normalizedQuestion.includes("utang") ||
    normalizedQuestion.includes("supplier") ||
    normalizedQuestion.includes("pemasok")
  ) {
    return `Hutang supplier yang masih terbuka saat ini ${formatRupiah(
      data.summary.supplier_payable_outstanding
    )} dari ${data.summary.supplier_payable_invoice_count} invoice. Bandingkan dengan saldo kas/bank sebelum membuat rencana pembayaran.`;
  }

  if (
    normalizedQuestion.includes("stok") ||
    normalizedQuestion.includes("persediaan") ||
    normalizedQuestion.includes("barang")
  ) {
    if (data.summary.low_or_empty_inventory_count > 0) {
      return `Nilai stok saat ini ${formatRupiah(
        data.summary.inventory_value
      )}. Ada ${data.summary.low_or_empty_inventory_count} item stok rendah atau kosong dari ${data.summary.inventory_item_count} item aktif.`;
    }

    return `Nilai stok saat ini ${formatRupiah(
      data.summary.inventory_value
    )}. Terdapat ${data.summary.inventory_item_count} item aktif dan belum ada stok rendah atau kosong.`;
  }

  if (
    normalizedQuestion.includes("perlu diperhatikan") ||
    normalizedQuestion.includes("perhatian") ||
    normalizedQuestion.includes("masalah") ||
    normalizedQuestion.includes("kondisi") ||
    normalizedQuestion.includes("sehat") ||
    normalizedQuestion.includes("aman")
  ) {
    return data.attention_notes.join(" ");
  }

  if (
    normalizedQuestion.includes("ringkasan") ||
    normalizedQuestion.includes("hari ini") ||
    normalizedQuestion.includes("keadaan")
  ) {
    return `Ringkasan unit: kas/bank ${formatRupiah(
      data.summary.cash_bank_balance
    )}, piutang ${formatRupiah(
      data.summary.customer_receivable_outstanding
    )}, hutang supplier ${formatRupiah(
      data.summary.supplier_payable_outstanding
    )}, dan nilai stok ${formatRupiah(data.summary.inventory_value)}.`;
  }

  return "Saya bisa menjawab pertanyaan seputar kas/bank, piutang pelanggan, hutang supplier, stok, dan catatan perhatian unit. Contoh: Berapa kas saya? Apa yang perlu diperhatikan?";
}

export function OrviaAiUnitSummaryCard() {
  const [data, setData] = useState<UnitHealthSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(
    "Silakan tanya kondisi unit. Contoh: Berapa kas saya hari ini?"
  );
  const [isAsking, setIsAsking] = useState(false);

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

  async function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setAnswer("Tulis pertanyaan dulu. Contoh: Berapa kas saya hari ini?");
      return;
    }

    const localGreetingAnswer = buildLocalGreetingAnswer(trimmedQuestion);

    if (localGreetingAnswer) {
      setAnswer(localGreetingAnswer);
      return;
    }

    setIsAsking(true);
    setAnswer("ORVIA AI sedang membaca ringkasan unit dan menyusun jawaban...");

    try {
      const response = await fetch("/api/orvia-ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ question: trimmedQuestion }),
        cache: "no-store",
      });

      const payload = (await response.json()) as {
        success?: boolean;
        answer?: string;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "ORVIA AI belum berhasil menjawab.");
      }

      setAnswer(payload.answer ?? "ORVIA AI belum dapat menyusun jawaban.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "ORVIA AI belum berhasil menjawab.";
      const localAnswer = buildLocalAnswer(trimmedQuestion, data);

      setAnswer(`${message}\n\nJawaban sementara dari pembaca lokal: ${localAnswer}`);
    } finally {
      setIsAsking(false);
    }
  }

  const suggestedQuestions = [
    "Berapa kas saya?",
    "Berapa piutang?",
    "Berapa hutang supplier?",
    "Stok saya aman?",
    "Apa yang perlu diperhatikan?",
  ];

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
                  Tanya Kondisi Unit
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

          <form onSubmit={handleAsk} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-700" />
              <p className="text-sm font-black text-slate-950">
                Tanya ORVIA AI
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Contoh: Berapa kas saya hari ini?"
                className="min-h-11 flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />

              <button
                type="submit"
                disabled={isLoading || isAsking}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isAsking ? "Menjawab..." : "Tanya"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedQuestions.map((suggestedQuestion) => (
                <button
                  key={suggestedQuestion}
                  type="button"
                  onClick={() => {
                    setQuestion(suggestedQuestion);
                    setAnswer(buildLocalAnswer(suggestedQuestion, data));
                  }}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  {suggestedQuestion}
                </button>
              ))}
            </div>

            <div className="mt-4 whitespace-pre-line rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {answer}
            </div>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void loadSummary()}
              className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || isAsking}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Muat ulang ringkasan
            </button>

            <Link
              href="/unit/dashboard/orvia-ai-settings"
              className="inline-flex w-fit items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              Atur Asisten AI
            </Link>
          </div>
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

