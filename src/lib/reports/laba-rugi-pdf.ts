type MoneyValue = string | number | null | undefined;

export type LabaRugiPdfSummary = {
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
  total_pendapatan: MoneyValue;
  total_hpp: MoneyValue;
  laba_kotor: MoneyValue;
  total_beban: MoneyValue;
  laba_rugi_bersih: MoneyValue;
};

export type LabaRugiPdfDetail = {
  account_code: string;
  account_name: string;
  amount: MoneyValue;
};

export type LabaRugiPdfData = {
  tenant: {
    nama_bumdes: string | null;
    nama_desa: string | null;
    nama_kecamatan: string | null;
  };
  summary: LabaRugiPdfSummary | null;
  pendapatanRows: LabaRugiPdfDetail[];
  hppRows: LabaRugiPdfDetail[];
  bebanRows: LabaRugiPdfDetail[];
  statusLabel: string;
};

type ExportLabaRugiPdfOptions = {
  data: LabaRugiPdfData;
  fileName?: string;
};

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

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
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getPeriodLabel(summary: LabaRugiPdfSummary) {
  const monthName =
    monthNames[summary.period_month - 1] ?? `Bulan ${summary.period_month}`;

  return `${monthName} ${summary.period_year}`;
}

function formatFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

export async function exportLabaRugiPdf({
  data,
  fileName = "laporan-laba-rugi.pdf",
}: ExportLabaRugiPdfOptions) {
  if (!data.summary) {
    throw new Error("Data laporan belum tersedia untuk diexport.");
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  const rightX = pageWidth - marginX;

  let y = 16;

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
    if (y + requiredHeight <= pageHeight - 16) return;
    pdf.addPage();
    y = 16;
  }

  function drawLine(yPos: number) {
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(marginX, yPos, rightX, yPos);
  }

  function drawBox(
    x: number,
    yPos: number,
    width: number,
    height: number,
    fill: [number, number, number],
    stroke: [number, number, number] = [226, 232, 240]
  ) {
    pdf.setFillColor(fill[0], fill[1], fill[2]);
    pdf.setDrawColor(stroke[0], stroke[1], stroke[2]);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(x, yPos, width, height, 3, 3, "FD");
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

  function drawAmountLine(
    label: string,
    value: MoneyValue,
    options?: {
      bold?: boolean;
      indent?: boolean;
      muted?: boolean;
      negativeColor?: boolean;
    }
  ) {
    addPageIfNeeded(8);

    const isNegative = toNumber(value) < 0;
    const x = options?.indent ? marginX + 6 : marginX;

    setText(
      options?.muted ? [100, 116, 139] : [15, 23, 42],
      options?.bold ? 9 : 8.5,
      options?.bold ? "bold" : "normal"
    );

    drawText(label, x, y, { maxWidth: contentWidth - 54 });

    setText(
      isNegative || options?.negativeColor ? [190, 18, 60] : [15, 23, 42],
      options?.bold ? 9 : 8.5,
      options?.bold ? "bold" : "normal"
    );

    drawText(formatRupiah(value), rightX, y, { align: "right" });

    y += 5.5;
    drawLine(y);
    y += 3;
  }

  function drawSection(
    title: string,
    rows: LabaRugiPdfDetail[],
    emptyText: string,
    totalLabel: string,
    totalValue: MoneyValue
  ) {
    addPageIfNeeded(12);

    y += 3;
    setText([71, 85, 105], 8.5, "bold");
    drawText(title, marginX, y);
    y += 4;
    drawLine(y);
    y += 3;

    if (rows.length === 0) {
      setText([148, 163, 184], 8, "normal");
      drawText(emptyText, marginX + 6, y, { maxWidth: contentWidth - 6 });
      y += 7;
      drawLine(y);
      y += 3;
    } else {
      rows.forEach((row) => {
        drawAmountLine(`${row.account_code} - ${row.account_name}`, row.amount, {
          indent: true,
        });
      });
    }

    drawAmountLine(totalLabel, totalValue, { bold: true });
  }

  const { summary } = data;
  const hppBeban = toNumber(summary.total_hpp) + toNumber(summary.total_beban);
  const labaBersih = toNumber(summary.laba_rugi_bersih);
  const wilayah = [
    data.tenant.nama_desa ? `Desa ${data.tenant.nama_desa}` : "",
    data.tenant.nama_kecamatan ? `Kecamatan ${data.tenant.nama_kecamatan}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  setText([4, 120, 87], 7.5, "bold");
  drawText("LAPORAN KEUANGAN UNIT", pageWidth / 2, y, { align: "center" });
  y += 8;

  setText([2, 6, 23], 18, "bold");
  drawText("Laporan Laba & Rugi", pageWidth / 2, y, { align: "center" });
  y += 7;

  setText([15, 23, 42], 10.5, "bold");
  drawText(data.tenant.nama_bumdes ?? "BUMDes", pageWidth / 2, y, {
    align: "center",
  });
  y += 5;

  if (wilayah) {
    setText([71, 85, 105], 8.5, "normal");
    drawText(wilayah, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  drawBox(pageWidth / 2 - 22, y - 4.5, 44, 8, [220, 252, 231], [187, 247, 208]);
  setText([6, 78, 59], 8, "bold");
  drawText(`Periode ${getPeriodLabel(summary)}`, pageWidth / 2, y + 1, {
    align: "center",
  });
  y += 11;

  setText([71, 85, 105], 8, "normal");
  drawText(
    `${formatDate(summary.period_start)} sampai ${formatDate(summary.period_end)}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 9;

  drawBox(marginX, y, contentWidth, 24, [248, 250, 252]);
  const colWidth = contentWidth / 3;

  const summaryCards = [
    {
      label: "TOTAL PENDAPATAN",
      value: formatRupiah(summary.total_pendapatan),
      color: [4, 120, 87] as [number, number, number],
    },
    {
      label: "HPP + BEBAN",
      value: formatRupiah(hppBeban),
      color: [2, 6, 23] as [number, number, number],
    },
    {
      label: "STATUS",
      value: data.statusLabel,
      color:
        labaBersih < 0
          ? ([190, 18, 60] as [number, number, number])
          : ([4, 120, 87] as [number, number, number]),
    },
  ];

  summaryCards.forEach((item, index) => {
    const centerX = marginX + colWidth * index + colWidth / 2;

    setText([100, 116, 139], 7, "bold");
    drawText(item.label, centerX, y + 8, { align: "center" });

    setText(item.color, 11, "bold");
    drawText(item.value, centerX, y + 16, { align: "center" });
  });

  y += 33;

  drawBox(marginX, y, contentWidth, 14, [220, 252, 231], [187, 247, 208]);
  setText([6, 78, 59], 9, "bold");
  drawText("RINCIAN LAPORAN", marginX + 4, y + 6);
  setText([4, 120, 87], 7.5, "normal");
  drawText("Akun kosong tidak ditampilkan.", marginX + 4, y + 11);
  y += 19;

  drawSection(
    "PENDAPATAN",
    data.pendapatanRows,
    "Tidak ada akun pendapatan yang memiliki transaksi.",
    "Total Pendapatan",
    summary.total_pendapatan
  );

  drawSection(
    "HARGA POKOK PENJUALAN",
    data.hppRows,
    "Tidak ada akun HPP yang memiliki transaksi.",
    "Total HPP",
    summary.total_hpp
  );

  drawAmountLine("LABA KOTOR", summary.laba_kotor, {
    bold: true,
    negativeColor: toNumber(summary.laba_kotor) < 0,
  });

  drawSection(
    "BEBAN",
    data.bebanRows,
    "Tidak ada akun beban yang memiliki transaksi.",
    "Total Beban",
    summary.total_beban
  );

  addPageIfNeeded(24);
  y += 4;
  drawBox(marginX, y, contentWidth, 22, [248, 250, 252]);

  setText([71, 85, 105], 8.5, "bold");
  drawText("LABA/RUGI BERSIH", marginX + 4, y + 8);

  setText([100, 116, 139], 7.5, "normal");
  drawText(
    "Pendapatan dikurangi HPP dan seluruh beban periode ini.",
    marginX + 4,
    y + 14
  );

  setText(
    labaBersih < 0 ? [190, 18, 60] : [4, 120, 87],
    13,
    "bold"
  );
  drawText(formatRupiah(summary.laba_rugi_bersih), rightX - 4, y + 13, {
    align: "right",
  });

  y += 32;

  setText([100, 116, 139], 7, "normal");
  drawText(
    "Laporan ini dihasilkan otomatis dari transaksi yang sudah diposting pada engine akuntansi ERP BUMDes.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  pdf.save(formatFileName(fileName));
}
