type MoneyValue = string | number | null | undefined;

export type ArusKasPdfRow = {
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  report_year: number | null;
  report_month: number | null;
  report_date: string | null;
  activity_section_name: string | null;
  activity_section_order: number | null;
  activity_name: string | null;
  transaction_no: string | null;
  source_type: string | null;
  profit_sharing_allocation_code: string | null;
  profit_sharing_allocation_name: string | null;
  cash_bank_account_code: string | null;
  cash_bank_account_name: string | null;
  cash_in_amount: MoneyValue;
  cash_out_amount: MoneyValue;
  internal_transfer_effect_amount: MoneyValue;
  cash_effect_amount: MoneyValue;
  status: string | null;
};

export type ArusKasPdfData = {
  tenant: {
    nama_bumdes: string | null;
    nama_desa: string | null;
    nama_kecamatan: string | null;
    nama_unit: string | null;
    kode_unit: string | null;
  };
  year: number;
  rows: ArusKasPdfRow[];
  totals: {
    totalCashIn: MoneyValue;
    totalCashOut: MoneyValue;
    netCashEffect: MoneyValue;
    internalTransferNet: MoneyValue;
  };
};

type ExportArusKasPdfOptions = {
  data: ArusKasPdfData;
  fileName?: string;
};

function toNumber(value: MoneyValue) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: MoneyValue) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

function groupBySection(rows: ArusKasPdfRow[]) {
  return rows.reduce<Record<string, ArusKasPdfRow[]>>((acc, row) => {
    const key = row.activity_section_name ?? "Aktivitas Lainnya";
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});
}

export async function exportArusKasPdf({
  data,
  fileName = "laporan-arus-kas.pdf",
}: ExportArusKasPdfOptions) {
  if (data.rows.length === 0) {
    throw new Error("Data Arus Kas belum tersedia untuk diexport.");
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("l", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 12;
  const rightX = pageWidth - marginX;
  const contentWidth = pageWidth - marginX * 2;

  let y = 12;

  function setText(
    color: [number, number, number],
    size: number,
    style: "normal" | "bold" = "normal"
  ) {
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.setFontSize(size);
    pdf.setFont("helvetica", style);
  }

  function addPageIfNeeded(requiredHeight = 10) {
    if (y + requiredHeight <= pageHeight - 12) return;
    pdf.addPage();
    y = 12;
  }

  function drawLine(yPos: number) {
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(marginX, yPos, rightX, yPos);
  }

  function drawText(
    value: string,
    x: number,
    yPos: number,
    options?: {
      align?: "left" | "center" | "right";
      maxWidth?: number;
      lineHeight?: number;
    }
  ) {
    if (options?.maxWidth) {
      const lines = pdf.splitTextToSize(value, options.maxWidth);
      pdf.text(lines, x, yPos, { align: options.align ?? "left" });
      return lines.length * (options.lineHeight ?? 4);
    }

    pdf.text(value, x, yPos, { align: options?.align ?? "left" });
    return options?.lineHeight ?? 4;
  }

  function drawSummaryBox(label: string, value: string, x: number, width: number) {
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(x, y, width, 18, 3, 3, "FD");

    setText([100, 116, 139], 7, "bold");
    drawText(label, x + 4, y + 6);

    setText([15, 23, 42], 10, "bold");
    drawText(value, x + 4, y + 13, { maxWidth: width - 8 });
  }

  const wilayah = [
    data.tenant.nama_desa ? `Desa ${data.tenant.nama_desa}` : "",
    data.tenant.nama_kecamatan ? `Kecamatan ${data.tenant.nama_kecamatan}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

  setText([4, 120, 87], 7.5, "bold");
  drawText("LAPORAN KEUANGAN UNIT", pageWidth / 2, y, { align: "center" });
  y += 7;

  setText([2, 6, 23], 18, "bold");
  drawText("Laporan Arus Kas", pageWidth / 2, y, { align: "center" });
  y += 7;

  setText([15, 23, 42], 10.5, "bold");
  drawText(data.tenant.nama_bumdes ?? "BUMDes", pageWidth / 2, y, {
    align: "center",
  });
  y += 5;

  if (wilayah) {
    setText([71, 85, 105], 8.5, "normal");
    drawText(wilayah, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  setText([71, 85, 105], 8, "normal");
  drawText(
    `Unit: ${data.tenant.kode_unit ?? "-"} - ${data.tenant.nama_unit ?? "-"} | Tahun ${data.year}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 8;

  const boxGap = 4;
  const boxWidth = (contentWidth - boxGap * 3) / 4;
  drawSummaryBox("KAS MASUK", formatRupiah(data.totals.totalCashIn), marginX, boxWidth);
  drawSummaryBox("KAS KELUAR", formatRupiah(data.totals.totalCashOut), marginX + boxWidth + boxGap, boxWidth);
  drawSummaryBox("ARUS KAS BERSIH", formatRupiah(data.totals.netCashEffect), marginX + (boxWidth + boxGap) * 2, boxWidth);
  drawSummaryBox("TRANSFER INTERNAL", formatRupiah(data.totals.internalTransferNet), marginX + (boxWidth + boxGap) * 3, boxWidth);
  y += 24;

  const groupedRows = groupBySection(data.rows);

  Object.entries(groupedRows).forEach(([sectionName, sectionRows]) => {
    const sectionTotal = sectionRows.reduce(
      (sum, row) => sum + toNumber(row.cash_effect_amount),
      0
    );

    addPageIfNeeded(18);

    setText([4, 120, 87], 9.5, "bold");
    drawText(sectionName, marginX, y);
    setText([71, 85, 105], 8, "normal");
    drawText(`Arus kas bersih: ${formatRupiah(sectionTotal)}`, rightX, y, {
      align: "right",
    });
    y += 5;
    drawLine(y);
    y += 4;

    setText([100, 116, 139], 7, "bold");
    drawText("No", marginX, y);
    drawText("Tanggal", marginX + 10, y);
    drawText("Transaksi / Aktivitas", marginX + 32, y);
    drawText("Akun Kas/Bank", marginX + 118, y);
    drawText("Masuk", marginX + 180, y, { align: "right" });
    drawText("Keluar", marginX + 210, y, { align: "right" });
    drawText("Efek Kas", rightX, y, { align: "right" });
    y += 4;
    drawLine(y);
    y += 3;

    sectionRows.forEach((row, index) => {
      addPageIfNeeded(12);

      const activityNote = [
        row.profit_sharing_allocation_code
          ? `${row.profit_sharing_allocation_code} - ${row.profit_sharing_allocation_name ?? "-"}`
          : row.source_type,
        row.status,
      ]
        .filter(Boolean)
        .join(" | ");

      setText([15, 23, 42], 7.8, "normal");
      drawText(String(index + 1), marginX, y);
      drawText(formatDate(row.report_date), marginX + 10, y);
      drawText(`${row.transaction_no ?? "-"} - ${row.activity_name ?? "-"}`, marginX + 32, y, {
        maxWidth: 78,
        lineHeight: 3.5,
      });
      drawText(`${row.cash_bank_account_code ?? "-"} - ${row.cash_bank_account_name ?? "-"}`, marginX + 118, y, {
        maxWidth: 48,
        lineHeight: 3.5,
      });

      setText([4, 120, 87], 7.8, "bold");
      drawText(formatRupiah(row.cash_in_amount), marginX + 180, y, { align: "right" });

      setText([190, 18, 60], 7.8, "bold");
      drawText(formatRupiah(row.cash_out_amount), marginX + 210, y, { align: "right" });

      setText(toNumber(row.cash_effect_amount) < 0 ? [190, 18, 60] : [4, 120, 87], 7.8, "bold");
      drawText(formatRupiah(row.cash_effect_amount), rightX, y, { align: "right" });

      y += 5;

      if (activityNote) {
        setText([100, 116, 139], 7, "normal");
        drawText(activityNote, marginX + 32, y, { maxWidth: 160 });
        y += 4;
      }

      drawLine(y);
      y += 3;
    });

    y += 2;
  });

  setText([100, 116, 139], 7, "normal");
  drawText(`Dicetak: ${new Date().toLocaleString("id-ID")}`, marginX, pageHeight - 8);

  pdf.save(formatFileName(fileName));
}
