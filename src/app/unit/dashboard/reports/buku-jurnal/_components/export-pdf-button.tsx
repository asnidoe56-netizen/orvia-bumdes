"use client";

import { useState } from "react";
import {
  exportBukuJurnalPdf,
  type BukuJurnalPdfData,
} from "@/lib/reports/buku-jurnal-pdf";

type ExportPdfButtonProps = {
  fileName?: string;
  reportData: BukuJurnalPdfData;
};

export function ExportPdfButton({
  fileName = "buku-jurnal.pdf",
  reportData,
}: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const isDisabled = isExporting || reportData.rows.length === 0;

  async function handleExportPdf() {
    setIsExporting(true);

    try {
      await exportBukuJurnalPdf({
        data: reportData,
        fileName,
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Export PDF gagal. Silakan coba lagi.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExportPdf}
      disabled={isDisabled}
      className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isExporting ? "Membuat PDF..." : "Export PDF"}
    </button>
  );
}
