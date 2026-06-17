import { NextResponse } from "next/server";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type AiProvider = "gemini" | "openai";

type SettingsBody = {
  provider?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
};

const ENV_PATH = path.join(process.cwd(), ".env.local");
const BACKUP_DIR = path.join(process.cwd(), "backups");

function normalizeProvider(value: unknown): AiProvider {
  return value === "openai" ? "openai" : "gemini";
}

function cleanEnvValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/[\r\n]/g, "");
}

function parseEnv(content: string) {
  const values: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

    if (match) {
      values[match[1]] = match[2];
    }
  }

  return values;
}

async function readEnvContent() {
  try {
    return await readFile(ENV_PATH, "utf8");
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function setEnvValue(content: string, key: string, value: string) {
  const safeValue = value.replace(/[\r\n]/g, "");
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, () => `${key}=${safeValue}`);
  }

  const separator = content.trim().length > 0 ? "\n" : "";

  return `${content.trimEnd()}${separator}${key}=${safeValue}\n`;
}

function hasSecret(value?: string) {
  return Boolean(value && value.trim().length > 0);
}

function buildPublicSettings(values: Record<string, string>) {
  const provider = normalizeProvider(values.ORVIA_AI_PROVIDER);

  return {
    provider,
    gemini: {
      model: values.GEMINI_MODEL || "gemini-2.5-flash-lite",
      apiKeyConfigured: hasSecret(values.GEMINI_API_KEY),
      apiKeyLength: values.GEMINI_API_KEY?.length ?? 0,
    },
    openai: {
      model: values.OPENAI_MODEL || "gpt-4o-mini",
      apiKeyConfigured: hasSecret(values.OPENAI_API_KEY),
      apiKeyLength: values.OPENAI_API_KEY?.length ?? 0,
    },
    canWrite:
      process.env.NODE_ENV !== "production" ||
      process.env.ORVIA_AI_SETTINGS_WRITE === "true",
  };
}

export async function GET() {
  const content = await readEnvContent();
  const fileValues = parseEnv(content);

  const values = {
    ORVIA_AI_PROVIDER:
      fileValues.ORVIA_AI_PROVIDER ?? process.env.ORVIA_AI_PROVIDER ?? "gemini",
    GEMINI_API_KEY: fileValues.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "",
    GEMINI_MODEL:
      fileValues.GEMINI_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite",
    OPENAI_API_KEY: fileValues.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
    OPENAI_MODEL:
      fileValues.OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };

  return NextResponse.json({
    success: true,
    settings: buildPublicSettings(values),
  });
}

export async function POST(request: Request) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ORVIA_AI_SETTINGS_WRITE !== "true"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Pengaturan AI lewat UI hanya aktif untuk mode lokal/dev. Untuk produksi, aktifkan izin khusus di server.",
      },
      { status: 403 }
    );
  }

  const body = (await request.json()) as SettingsBody;

  const provider = normalizeProvider(body.provider);
  const geminiModel = cleanEnvValue(body.geminiModel) || "gemini-2.5-flash-lite";
  const openaiModel = cleanEnvValue(body.openaiModel) || "gpt-4o-mini";
  const geminiApiKey = cleanEnvValue(body.geminiApiKey);
  const openaiApiKey = cleanEnvValue(body.openaiApiKey);

  let content = await readEnvContent();

  await mkdir(BACKUP_DIR, { recursive: true });

  if (content.trim().length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await copyFile(ENV_PATH, path.join(BACKUP_DIR, `.env.local.before-ai-settings-${stamp}`));
  }

  content = setEnvValue(content, "ORVIA_AI_PROVIDER", provider);
  content = setEnvValue(content, "GEMINI_MODEL", geminiModel);
  content = setEnvValue(content, "OPENAI_MODEL", openaiModel);

  if (geminiApiKey) {
    content = setEnvValue(content, "GEMINI_API_KEY", geminiApiKey);
  }

  if (openaiApiKey) {
    content = setEnvValue(content, "OPENAI_API_KEY", openaiApiKey);
  }

  await writeFile(ENV_PATH, content, "utf8");

  process.env.ORVIA_AI_PROVIDER = provider;
  process.env.GEMINI_MODEL = geminiModel;
  process.env.OPENAI_MODEL = openaiModel;

  if (geminiApiKey) {
    process.env.GEMINI_API_KEY = geminiApiKey;
  }

  if (openaiApiKey) {
    process.env.OPENAI_API_KEY = openaiApiKey;
  }

  const values = parseEnv(content);

  return NextResponse.json({
    success: true,
    message: "Pengaturan Asisten AI berhasil disimpan.",
    settings: buildPublicSettings(values),
  });
}
