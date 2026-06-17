import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export type OrviaAiProvider = "gemini" | "openai";

export type OrviaAiGenerateResult = {
  provider: OrviaAiProvider;
  model: string;
  text: string;
};

export function getOrviaAiProvider(): OrviaAiProvider {
  const configuredProvider = process.env.ORVIA_AI_PROVIDER?.toLowerCase();

  if (configuredProvider === "openai") {
    return "openai";
  }

  return "gemini";
}

export function getOrviaAiModel(provider = getOrviaAiProvider()) {
  if (provider === "openai") {
    return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
}

export function getSafeOrviaAiErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : "Gagal memproses permintaan ORVIA AI.";

  const lowerMessage = rawMessage.toLowerCase();

  if (
    lowerMessage.includes("resource_exhausted") ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("429")
  ) {
    return "Layanan AI eksternal sedang mencapai batas pemakaian. Gunakan hasil pembaca lokal sementara.";
  }

  if (
    lowerMessage.includes("unavailable") ||
    lowerMessage.includes("high demand") ||
    lowerMessage.includes("503")
  ) {
    return "Layanan AI eksternal sedang sibuk. Gunakan hasil pembaca lokal sementara dan coba lagi beberapa saat.";
  }

  if (
    lowerMessage.includes("incorrect api key") ||
    lowerMessage.includes("api key") ||
    lowerMessage.includes("401")
  ) {
    return "Konfigurasi kunci API layanan AI eksternal belum valid. Gunakan hasil pembaca lokal sementara.";
  }

  return "ORVIA AI belum berhasil menghubungi layanan AI eksternal. Gunakan hasil pembaca lokal sementara.";
}

async function generateWithGemini(input: string): Promise<OrviaAiGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur.");
  }

  const model = getOrviaAiModel("gemini");
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: input,
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini tidak mengembalikan jawaban.");
  }

  return {
    provider: "gemini",
    model,
    text,
  };
}

async function generateWithOpenAi(input: string): Promise<OrviaAiGenerateResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY belum diatur.");
  }

  const model = getOrviaAiModel("openai");
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: input,
      },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("OpenAI tidak mengembalikan jawaban.");
  }

  return {
    provider: "openai",
    model,
    text,
  };
}

export async function generateOrviaAiText(input: string) {
  const provider = getOrviaAiProvider();

  if (provider === "openai") {
    return generateWithOpenAi(input);
  }

  return generateWithGemini(input);
}