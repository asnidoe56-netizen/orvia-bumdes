import { describe, expect, it } from "vitest";
import { readSource } from "../helpers/source-tree";

/**
 * The financial reports read a fixed `.limit(1000)` window and then compute
 * their headline totals from whatever came back. There is no `.range()`,
 * no offset, no page parameter and no "showing N of M" notice anywhere in
 * src/app/unit/dashboard/reports.
 *
 * A unit posting ~3 journal lines a day crosses 1000 within a year, after
 * which the ledger, its totals and the exported PDF are all quietly wrong.
 * These tests pin the current shape so the fix is visible when it lands.
 */

const BUKU_BESAR = "src/app/unit/dashboard/reports/buku-besar/page.tsx";
const BUKU_JURNAL = "src/app/unit/dashboard/reports/buku-jurnal/page.tsx";

describe("general ledger (buku besar)", () => {
  it("still caps the ledger query at a fixed 1000 rows", () => {
    const source = readSource(BUKU_BESAR);
    const limits = source.match(/\.limit\((\d+)\)/g) ?? [];
    expect(limits).toEqual([".limit(1000)", ".limit(1000)"]);
  });

  it("derives the displayed closing balance from the last returned row", () => {
    // This is the bug: when the query truncates, `rows[rows.length - 1]` is
    // row 1000, not the last journal line, so "Saldo Terakhir" is understated.
    const source = readSource(BUKU_BESAR);
    expect(source).toMatch(/rows\[rows\.length - 1\]\?\.running_balance/);
    expect(source).toMatch(/const latestBalance = getLatestBalance\(rows\)/);
  });

  it("sums debit and credit over the truncated array", () => {
    const source = readSource(BUKU_BESAR);
    expect(source).toMatch(/totalDebit\s*=\s*rows\.reduce/);
    expect(source).toMatch(/totalCredit\s*=\s*rows\.reduce/);
  });

  it("hands those same totals to the PDF export", () => {
    // So the exported document inherits the truncation.
    const source = readSource(BUKU_BESAR);
    // [^}] already spans newlines, so no dotAll flag is needed (target is ES2017).
    expect(source).toMatch(/totals:\s*{[^}]*totalDebit[^}]*latestBalance/);
  });

  it("has no pagination and no truncation warning", () => {
    const source = readSource(BUKU_BESAR);
    expect(source).not.toMatch(/\.range\(/);
    expect(source).not.toMatch(/\boffset\b/);
    // Fix hint: when rows.length === limit, either page the query or surface a
    // notice. Either change makes one of these assertions fail — update it then.
    expect(source).not.toMatch(/rows\.length === 1000|isTruncated|terpotong/i);
  });
});

describe("journal book (buku jurnal)", () => {
  it("still caps at a fixed 1000 rows with no pagination", () => {
    const source = readSource(BUKU_JURNAL);
    expect(source).toMatch(/\.limit\(1000\)/);
    expect(source).not.toMatch(/\.range\(/);
  });
});

describe("cross-report expectation", () => {
  it("documents that no report exposes a page parameter yet", () => {
    for (const file of [BUKU_BESAR, BUKU_JURNAL]) {
      expect(readSource(file)).not.toMatch(/searchParams[^\n]*\bpage\b/);
    }
  });
});
