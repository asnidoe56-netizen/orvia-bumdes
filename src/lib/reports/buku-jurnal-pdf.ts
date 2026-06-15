type MoneyValue = string | number | null | undefined;

export type BukuJurnalPdfRow = {
  row_no: number | null;
  journal_line_id: string;
  journal_no: string | null;
  journal_date: string | null;
  source_type: string | null;
  journal_description: string | null;
  line_no: number | null;
  account_code: string | null;
  account_name: string | null;
  account_type: string | null;
  normal_balance: string | null;
  line_description: string | null;
  description_clean: string | null;
  reference_no: string | null;
  debit: MoneyValue;
  credit: MoneyValue;
};

export type BukuJurnalPdfData = {
  year: number;
  rows: BukuJurnalPdfRow[];
  totals: {
    journalCount: number;
    totalDebit: MoneyValue;
    totalCredit: MoneyValue;
  };
};

type ExportBukuJurnalPdfOptions = {
  data: BukuJurnalPdfData;
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
  }).format(new Date(`${value}T00:00:00`));
}

function formatFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

export async function exportBukuJurnalPdf({
  data,
  fileName = "buku-jurnal.pdf",
}: ExportBukuJurnalPdfOptions) {
  if (data.rows.length === 0) {
    throw new Error("Data Buku Jurnal belum tersedia untuk diexport.");
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("l", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 10;
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

  setText([4, 120, 87], 7.5, "bold");
  drawText("LAPORAN KEUANGAN UNIT", pageWidth / 2, y, { align: "center" });
  y += 7;

  setText([2, 6, 23], 18, "bold");
  drawText("Buku Jurnal", pageWidth / 2, y, { align: "center" });
  y += 7;

  setText([71, 85, 105], 8.5, "normal");
  drawText(`Tahun ${data.year}`, pageWidth / 2, y, { align: "center" });
  y += 9;

  const boxGap = 4;
  const boxWidth = (contentWidth - boxGap * 3) / 4;
  drawSummaryBox("TAHUN", String(data.year), marginX, boxWidth);
  drawSummaryBox("JUMLAH JURNAL", String(data.totals.journalCount), marginX + boxWidth + boxGap, boxWidth);
  drawSummaryBox("TOTAL DEBIT", formatRupiah(data.totals.totalDebit), marginX + (boxWidth + boxGap) * 2, boxWidth);
  drawSummaryBox("TOTAL KREDIT", formatRupiah(data.totals.totalCredit), marginX + (boxWidth + boxGap) * 3, boxWidth);
  y += 24;

  setText([100, 116, 139], 7, "bold");
  drawText("No", marginX, y, { align: "right" });
  drawText("Tanggal", marginX + 8, y);
  drawText("No. Jurnal", marginX + 30, y);
  drawText("Uraian", marginX + 56, y);
  drawText("Ref.", marginX + 129, y);
  drawText("Akun", marginX + 153, y);
  drawText("Debit", marginX + 222, y, { align: "right" });
  drawText("Kredit", marginX + 254, y, { align: "right" });
  drawText("Sumber", marginX + 260, y);
  y += 4;
  drawLine(y);
  y += 3;

  data.rows.forEach((row, index) => {
    addPageIfNeeded(14);

    const description =
      row.description_clean ||
      row.line_description ||
      row.journal_description ||
      "Jurnal transaksi diposting oleh engine database.";

    const account = `${row.account_code ?? "-"} - ${row.account_name ?? "-"}`;
    const accountNote = `${row.account_type ?? "-"} - Normal ${row.normal_balance ?? "-"}`;
    const journalNote = `Baris jurnal: ${row.line_no ?? "-"}`;

    setText([15, 23, 42], 7.5, "normal");
    drawText(String(row.row_no ?? index + 1), marginX, y, { align: "right" });
    drawText(formatDate(row.journal_date), marginX + 8, y);
    drawText(row.journal_no ?? "-", marginX + 30, y, {
      maxWidth: 22,
      lineHeight: 3.4,
    });
    drawText(description, marginX + 56, y, {
      maxWidth: 68,
      lineHeight: 3.4,
    });
    drawText(row.reference_no ?? "-", marginX + 129, y, {
      maxWidth: 20,
      lineHeight: 3.4,
    });
    drawText(account, marginX + 153, y, {
      maxWidth: 48,
      lineHeight: 3.4,
    });

    setText([4, 120, 87], 7.5, "bold");
    drawText(formatRupiah(row.debit), marginX + 222, y, { align: "right" });

    setText([190, 18, 60], 7.5, "bold");
    drawText(formatRupiah(row.credit), marginX + 254, y, { align: "right" });

    setText([100, 116, 139], 7.2, "normal");
    drawText(row.source_type ?? "-", marginX + 260, y, { maxWidth: 26 });

    y += 5;

    setText([100, 116, 139], 6.8, "normal");
    drawText(journalNote, marginX + 30, y, { maxWidth: 22 });
    drawText(accountNote, marginX + 153, y, { maxWidth: 70 });
    y += 4;

    drawLine(y);
    y += 3;
  });

  setText([100, 116, 139], 7, "normal");
  drawText(`Dicetak: ${new Date().toLocaleString("id-ID")}`, marginX, pageHeight - 8);

  pdf.save(formatFileName(fileName));
}
