type MoneyValue = string | number | null | undefined;

export type PerubahanEkuitasPdfRow = {
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  report_year: number | null;
  report_date: string | null;
  section_name: string | null;
  section_order: number | null;
  line_order: number | null;
  line_code: string | null;
  line_name: string | null;
  line_category: string | null;
  display_amount: MoneyValue;
  equity_effect_amount: MoneyValue;
  running_equity_amount: MoneyValue;
  source_type: string | null;
  status: string | null;
};

export type PerubahanEkuitasPdfData = {
  tenant: {
    nama_bumdes: string | null;
    nama_desa: string | null;
    nama_kecamatan: string | null;
    nama_unit: string | null;
    kode_unit: string | null;
  };
  year: number;
  rows: PerubahanEkuitasPdfRow[];
  totals: {
    latestRunningEquity: MoneyValue;
    externalDistribution: MoneyValue;
    internalReserve: MoneyValue;
  };
};

type ExportPerubahanEkuitasPdfOptions = {
  data: PerubahanEkuitasPdfData;
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

function groupBySection(rows: PerubahanEkuitasPdfRow[]) {
  return rows.reduce<Record<string, PerubahanEkuitasPdfRow[]>>((acc, row) => {
    const key = row.section_name ?? "Bagian Lainnya";
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});
}

export async function exportPerubahanEkuitasPdf({
  data,
  fileName = "laporan-perubahan-ekuitas.pdf",
}: ExportPerubahanEkuitasPdfOptions) {
  if (data.rows.length === 0) {
    throw new Error("Data Perubahan Ekuitas belum tersedia untuk diexport.");
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
  drawText("Laporan Perubahan Ekuitas", pageWidth / 2, y, { align: "center" });
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
  const boxWidth = (contentWidth - boxGap * 2) / 3;
  drawSummaryBox("EKUITAS AKHIR", formatRupiah(data.totals.latestRunningEquity), marginX, boxWidth);
  drawSummaryBox("DISTRIBUSI KELUAR", formatRupiah(data.totals.externalDistribution), marginX + boxWidth + boxGap, boxWidth);
  drawSummaryBox("CADANGAN MODAL", formatRupiah(data.totals.internalReserve), marginX + (boxWidth + boxGap) * 2, boxWidth);
  y += 24;

  const groupedRows = groupBySection(data.rows);

  Object.entries(groupedRows).forEach(([sectionName, sectionRows]) => {
    const sectionTotal = sectionRows.reduce(
      (sum, row) => sum + toNumber(row.equity_effect_amount),
      0
    );

    addPageIfNeeded(18);

    setText([4, 120, 87], 9.5, "bold");
    drawText(sectionName, marginX, y);
    setText([71, 85, 105], 8, "normal");
    drawText(`Total efek ekuitas: ${formatRupiah(sectionTotal)}`, rightX, y, {
      align: "right",
    });
    y += 5;
    drawLine(y);
    y += 4;

    setText([100, 116, 139], 7, "bold");
    drawText("No", marginX, y);
    drawText("Tanggal", marginX + 10, y);
    drawText("Kode", marginX + 34, y);
    drawText("Uraian", marginX + 58, y);
    drawText("Nilai", marginX + 178, y, { align: "right" });
    drawText("Efek", marginX + 214, y, { align: "right" });
    drawText("Saldo", rightX, y, { align: "right" });
    y += 4;
    drawLine(y);
    y += 3;

    sectionRows.forEach((row, index) => {
      addPageIfNeeded(12);

      const note = [row.line_category, row.source_type, row.status]
        .filter(Boolean)
        .join(" | ");

      setText([15, 23, 42], 7.8, "normal");
      drawText(String(index + 1), marginX, y);
      drawText(formatDate(row.report_date), marginX + 10, y);
      drawText(row.line_code ?? "-", marginX + 34, y);
      drawText(row.line_name ?? "-", marginX + 58, y, {
        maxWidth: 90,
        lineHeight: 3.5,
      });

      setText([15, 23, 42], 7.8, "bold");
      drawText(formatRupiah(row.display_amount), marginX + 178, y, { align: "right" });

      setText(
        toNumber(row.equity_effect_amount) < 0 ? [190, 18, 60] : [4, 120, 87],
        7.8,
        "bold"
      );
      drawText(formatRupiah(row.equity_effect_amount), marginX + 214, y, {
        align: "right",
      });

      setText([15, 23, 42], 7.8, "bold");
      drawText(formatRupiah(row.running_equity_amount), rightX, y, {
        align: "right",
      });

      y += 5;

      if (note) {
        setText([100, 116, 139], 7, "normal");
        drawText(note, marginX + 58, y, { maxWidth: 160 });
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
