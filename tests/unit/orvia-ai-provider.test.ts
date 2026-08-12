import { afterEach, describe, expect, it } from "vitest";
import {
  getOrviaAiModel,
  getOrviaAiProvider,
  getSafeOrviaAiErrorMessage,
} from "@/lib/orvia-ai/provider";

const ENV_KEYS = ["ORVIA_AI_PROVIDER", "OPENAI_MODEL", "GEMINI_MODEL"] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("getOrviaAiProvider", () => {
  it("defaults to gemini when unset", () => {
    expect(getOrviaAiProvider()).toBe("gemini");
  });

  it("selects openai case-insensitively", () => {
    process.env.ORVIA_AI_PROVIDER = "OpenAI";
    expect(getOrviaAiProvider()).toBe("openai");
  });

  it("falls back to gemini for an unrecognised provider", () => {
    process.env.ORVIA_AI_PROVIDER = "anthropic";
    expect(getOrviaAiProvider()).toBe("gemini");
  });
});

describe("getOrviaAiModel", () => {
  it("uses per-provider defaults", () => {
    expect(getOrviaAiModel("gemini")).toBe("gemini-2.5-flash-lite");
    expect(getOrviaAiModel("openai")).toBe("gpt-4o-mini");
  });

  it("lets the environment override the model", () => {
    process.env.GEMINI_MODEL = "gemini-3-pro";
    process.env.OPENAI_MODEL = "gpt-5";
    expect(getOrviaAiModel("gemini")).toBe("gemini-3-pro");
    expect(getOrviaAiModel("openai")).toBe("gpt-5");
  });
});

describe("getSafeOrviaAiErrorMessage", () => {
  it("maps quota and rate-limit failures to an operator-readable message", () => {
    for (const raw of [
      "429 RESOURCE_EXHAUSTED",
      "You exceeded your current quota",
      "Rate limit reached for requests",
    ]) {
      expect(getSafeOrviaAiErrorMessage(new Error(raw))).toContain(
        "batas pemakaian",
      );
    }
  });

  it("maps upstream outages to a retry message", () => {
    expect(getSafeOrviaAiErrorMessage(new Error("503 Service Unavailable"))).toContain(
      "sedang sibuk",
    );
  });

  it("maps auth failures without echoing the credential", () => {
    const message = getSafeOrviaAiErrorMessage(
      new Error("Incorrect API key provided: sk-proj-abc123SECRET"),
    );
    expect(message).toContain("kunci API");
    expect(message).not.toContain("sk-proj-abc123SECRET");
  });

  it("never forwards a raw upstream error to the browser", () => {
    // Provider errors routinely embed request URLs, project ids and key
    // fragments. Every branch must return one of the curated strings.
    const leaky = new Error(
      "request to https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyLEAKED failed",
    );
    const message = getSafeOrviaAiErrorMessage(leaky);

    expect(message).not.toContain("AIzaSyLEAKED");
    expect(message).not.toContain("googleapis.com");
    expect(message).toContain("ORVIA AI");
  });

  it("handles non-Error throwables", () => {
    expect(getSafeOrviaAiErrorMessage("boom")).toBeTruthy();
    expect(getSafeOrviaAiErrorMessage(null)).toBeTruthy();
    expect(getSafeOrviaAiErrorMessage(undefined)).toBeTruthy();
  });
});
