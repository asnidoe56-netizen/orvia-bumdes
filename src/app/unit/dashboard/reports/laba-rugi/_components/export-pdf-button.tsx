"use client";

import { useState } from "react";
import { exportLabaRugiPdf, type LabaRugiPdfData } from "@/lib/reports/laba-rugi-pdf";

type ExportPdfButtonProps = {
  fileName?: string;
  reportData: LabaRugiPdfData;
};

export function ExportPdfButton({
  fileName = "laporan-laba-rugi.pdf",
  reportData,
}: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const isDisabled = isExporting || !reportData.summary;

  async function handleExportPdf() {
    setIsExporting(true);

    try {
      await exportLabaRugiPdf({
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
      className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isExporting ? "Membuat PDF..." : "Export PDF"}
    </button>
  );
}
