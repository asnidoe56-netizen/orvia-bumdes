"use client";

import { useState } from "react";
import { exportNeracaPdf, type NeracaPdfData } from "@/lib/reports/neraca-pdf";

type ExportPdfButtonProps = {
  fileName?: string;
  reportData: NeracaPdfData;
};

export function ExportPdfButton({
  fileName = "laporan-neraca.pdf",
  reportData,
}: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const isDisabled = isExporting || !reportData.summary;

  async function handleExportPdf() {
    setIsExporting(true);

    try {
      await exportNeracaPdf({
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
