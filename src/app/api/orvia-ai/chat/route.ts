import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { getAiUnitHealthSummary } from "@/lib/orvia-ai/read-tools";

type ChatRequestBody = {
  question?: string;
};

type AiProvider = "gemini" | "openai";

const SYSTEM_PROMPT = `
Anda adalah ORVIA AI, asisten operasional BUMDes.

Batas wajib:
- Jawab hanya berdasarkan DATA_UNIT yang diberikan server.
- Jangan mengarang angka.
- Jangan meminta tenant_id atau unit_id kepada user.
- Jangan memberi instruksi posting transaksi.
- Jangan membuat jurnal.
- Jangan mengubah kas/bank.
- Jangan mengubah piutang.
- Jangan mengubah hutang.
- Jangan mengubah stok.
- Gunakan bahasa Indonesia sederhana.
- Jika data tidak cukup, katakan data belum cukup.
- Gunakan istilah "Catatan Transparansi Transaksi" atau "Perlu Perhatian", bukan "anomali".
- Jangan gunakan markdown.
- Jangan gunakan tanda **, heading markdown, tabel markdown, atau bullet rumit.
- Jawab dengan paragraf pendek yang mudah dibaca operator BUMDes.
- Untuk pertanyaan umum, jawab maksimal 4 sampai 6 kalimat.
- Untuk sapaan sederhana, jawab singkat dan arahkan user bertanya tentang kas/bank, piutang, hutang supplier, stok, atau catatan perhatian.
- Jangan menampilkan seluruh JSON DATA_UNIT kepada user.
`;

function getAiProvider(): AiProvider {
  const provider = process.env.ORVIA_AI_PROVIDER?.toLowerCase();

  if (provider === "openai") {
    return "openai";
  }

  return "gemini";
}

async function generateWithGemini(input: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur di server.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: input,
    config: {
      temperature: 0.2,
      systemInstruction: SYSTEM_PROMPT,
    },
  });

  return {
    provider: "gemini" as const,
    model,
    answer: response.text ?? "ORVIA AI belum dapat menyusun jawaban.",
  };
}

async function generateWithOpenAi(input: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY belum diatur di server.");
  }

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: input,
      },
    ],
  });

  return {
    provider: "openai" as const,
    model,
    answer:
      completion.choices[0]?.message?.content ??
      "ORVIA AI belum dapat menyusun jawaban.",
  };
}

function getSafeAiErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : "Gagal memproses pertanyaan ORVIA AI.";

  const lowerMessage = rawMessage.toLowerCase();

  if (
    lowerMessage.includes("resource_exhausted") ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("429")
  ) {
    return "Layanan AI eksternal sedang mencapai batas pemakaian. ORVIA AI tetap menampilkan jawaban sementara dari pembaca lokal.";
  }

  if (
    lowerMessage.includes("unavailable") ||
    lowerMessage.includes("high demand") ||
    lowerMessage.includes("503")
  ) {
    return "Layanan AI eksternal sedang sibuk. Coba lagi beberapa saat lagi. ORVIA AI tetap menampilkan jawaban sementara dari pembaca lokal.";
  }

  if (
    lowerMessage.includes("incorrect api key") ||
    lowerMessage.includes("api key") ||
    lowerMessage.includes("401")
  ) {
    return "Konfigurasi kunci API layanan AI eksternal belum valid. ORVIA AI tetap menampilkan jawaban sementara dari pembaca lokal.";
  }

  return "ORVIA AI belum berhasil menghubungi layanan AI eksternal. Jawaban sementara dari pembaca lokal tetap ditampilkan.";
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json(
        {
          success: false,
          error: "Pertanyaan belum diisi.",
        },
        { status: 400 }
      );
    }

    const unitSummary = await getAiUnitHealthSummary(
      `ORVIA AI Chat membaca ringkasan unit untuk pertanyaan: ${question}`
    );

    const input = JSON.stringify(
      {
        PERTANYAAN_USER: question,
        DATA_UNIT: unitSummary,
      },
      null,
      2
    );

    const provider = getAiProvider();

    const result =
      provider === "openai"
        ? await generateWithOpenAi(input)
        : await generateWithGemini(input);

    return NextResponse.json({
      success: true,
      mode: "server_side_ai",
      tool: "orvia.chat.unit_summary",
      provider: result.provider,
      model: result.model,
      answer: result.answer,
    });
  } catch (error) {
    const message = getSafeAiErrorMessage(error);

    return NextResponse.json({
      success: false,
      recoverable: true,
      mode: "server_side_ai",
      tool: "orvia.chat.unit_summary",
      provider: getAiProvider(),
      error: message,
    });
  }
}

