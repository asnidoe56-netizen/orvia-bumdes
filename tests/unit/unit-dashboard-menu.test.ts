import { describe, expect, it } from "vitest";
import {
  getUnitDashboardNav,
  isSavingsLoanUnit,
  savingsLoanUnitNav,
} from "@/lib/navigation/unit-dashboard-menu";
import { unitNav } from "@/lib/navigation/dashboard-config";

describe("isSavingsLoanUnit", () => {
  it("matches the canonical template code", () => {
    expect(isSavingsLoanUnit({ templateCode: "SIMPAN_PINJAM" })).toBe(true);
  });

  it("tolerates the casing and spacing operators actually type", () => {
    // Unit master data is filled in by 123 different villages; normalisation
    // is the only thing keeping the menu from silently falling back.
    expect(isSavingsLoanUnit({ templateCode: "simpan_pinjam" })).toBe(true);
    expect(isSavingsLoanUnit({ jenisUnit: "Simpan Pinjam" })).toBe(true);
    expect(isSavingsLoanUnit({ jenisUnit: "  simpan   pinjam  " })).toBe(true);
    expect(isSavingsLoanUnit({ jenisUnit: "Unit Simpan Pinjam Desa" })).toBe(true);
  });

  it("does not match unrelated unit types", () => {
    expect(isSavingsLoanUnit({ templateCode: "PERDAGANGAN" })).toBe(false);
    expect(isSavingsLoanUnit({ jenisUnit: "Wisata Desa" })).toBe(false);
  });

  it("falls back to the general menu when unit metadata is absent", () => {
    expect(isSavingsLoanUnit({})).toBe(false);
    expect(isSavingsLoanUnit({ templateCode: null, jenisUnit: null })).toBe(false);
    expect(isSavingsLoanUnit({ templateCode: "   " })).toBe(false);
  });

  it("does not treat a partial template code as a savings-loan unit", () => {
    expect(isSavingsLoanUnit({ templateCode: "SIMPAN" })).toBe(false);
  });
});

describe("getUnitDashboardNav", () => {
  it("serves the savings-loan menu to a savings-loan unit", () => {
    expect(getUnitDashboardNav({ templateCode: "SIMPAN_PINJAM" })).toBe(
      savingsLoanUnitNav,
    );
  });

  it("serves the general unit menu to everyone else", () => {
    expect(getUnitDashboardNav({ jenisUnit: "Wisata" })).toBe(unitNav);
  });

  it("keeps every menu entry inside the unit dashboard", () => {
    // A stray href here would push an operator into a route their role
    // cannot open, producing a redirect loop rather than a clean menu.
    for (const item of savingsLoanUnitNav) {
      expect(item.href, item.label).toMatch(/^\/unit\/dashboard/);
    }
  });

  it("has no duplicate destinations in the savings-loan menu", () => {
    const hrefs = savingsLoanUnitNav.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
