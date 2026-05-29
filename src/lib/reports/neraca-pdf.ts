type MoneyValue = string | number | null | undefined;

export type NeracaPdfSummary = {
  total_aset: MoneyValue;
  total_kewajiban: MoneyValue;
  total_ekuitas: MoneyValue;
  total_kewajiban_ekuitas: MoneyValue;
  selisih_neraca: MoneyValue;
  status_neraca: string | null;
};

export type NeracaPdfDetail = {
  account_code: string;
  account_name: string;
  neraca_group: "ASET" | "KEWAJIBAN" | "EKUITAS" | string;
  neraca_amount: MoneyValue;
  is_contra_account?: boolean | null;
  is_current_profit_loss?: boolean | null;
};

export type NeracaPdfData = {
  tenant: {
    nama_bumdes: string | null;
    nama_desa: string | null;
    nama_kecamatan: string | null;
  };
  summary: NeracaPdfSummary | null;
  asetRows: NeracaPdfDetail[];
  kewajibanRows: NeracaPdfDetail[];
  ekuitasRows: NeracaPdfDetail[];
  reportDateLabel: string;
};

type ExportNeracaPdfOptions = {
  data: NeracaPdfData;
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

function formatFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

export async function exportNeracaPdf({
  data,
  fileName = "laporan-neraca.pdf",
}: ExportNeracaPdfOptions) {
  if (!data.summary) {
    throw new Error("Data Neraca belum tersedia untuk diexport.");
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

    const numberValue = toNumber(value);
    const isNegative = numberValue < 0;
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
    rows: NeracaPdfDetail[],
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
        const suffix = row.is_contra_account ? " (kontra aset)" : row.is_current_profit_loss ? " (berjalan)" : "";

        drawAmountLine(`${row.account_code} - ${row.account_name}${suffix}`, row.neraca_amount, {
          indent: true,
          negativeColor: toNumber(row.neraca_amount) < 0,
        });
      });
    }

    drawAmountLine(totalLabel, totalValue, { bold: true });
  }

  const { summary } = data;
  const isBalanced = summary.status_neraca === "SEIMBANG";
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
  drawText("Neraca", pageWidth / 2, y, { align: "center" });
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

  drawBox(pageWidth / 2 - 28, y - 4.5, 56, 8, [220, 252, 231], [187, 247, 208]);
  setText([6, 78, 59], 8, "bold");
  drawText(data.reportDateLabel, pageWidth / 2, y + 1, {
    align: "center",
  });
  y += 13;

  drawBox(marginX, y, contentWidth, 24, [248, 250, 252]);
  const colWidth = contentWidth / 3;

  const summaryCards = [
    {
      label: "TOTAL ASET",
      value: formatRupiah(summary.total_aset),
      color: [4, 120, 87] as [number, number, number],
    },
    {
      label: "KEWAJIBAN + EKUITAS",
      value: formatRupiah(summary.total_kewajiban_ekuitas),
      color: [2, 6, 23] as [number, number, number],
    },
    {
      label: "STATUS",
      value: summary.status_neraca ?? "-",
      color: isBalanced
        ? ([4, 120, 87] as [number, number, number])
        : ([190, 18, 60] as [number, number, number]),
    },
  ];

  summaryCards.forEach((item, index) => {
    const centerX = marginX + colWidth * index + colWidth / 2;

    setText([100, 116, 139], 7, "bold");
    drawText(item.label, centerX, y + 8, { align: "center" });

    setText(item.color, 10.5, "bold");
    drawText(item.value, centerX, y + 16, { align: "center" });
  });

  y += 33;

  drawBox(marginX, y, contentWidth, 14, [220, 252, 231], [187, 247, 208]);
  setText([6, 78, 59], 9, "bold");
  drawText("RINCIAN NERACA", marginX + 4, y + 6);
  setText([4, 120, 87], 7.5, "normal");
  drawText("Akun kosong tidak ditampilkan.", marginX + 4, y + 11);
  y += 19;

  drawSection(
    "ASET",
    data.asetRows,
    "Tidak ada akun aset yang memiliki saldo.",
    "Total Aset",
    summary.total_aset
  );

  drawSection(
    "KEWAJIBAN",
    data.kewajibanRows,
    "Tidak ada akun kewajiban yang memiliki saldo.",
    "Total Kewajiban",
    summary.total_kewajiban
  );

  drawSection(
    "EKUITAS",
    data.ekuitasRows,
    "Tidak ada akun ekuitas yang memiliki saldo.",
    "Total Ekuitas",
    summary.total_ekuitas
  );

  addPageIfNeeded(26);
  y += 4;
  drawBox(marginX, y, contentWidth, 24, [248, 250, 252]);

  setText([71, 85, 105], 8.5, "bold");
  drawText("KEWAJIBAN + EKUITAS", marginX + 4, y + 8);

  setText([100, 116, 139], 7.5, "normal");
  drawText(
    `Selisih Neraca: ${formatRupiah(summary.selisih_neraca)}`,
    marginX + 4,
    y + 15
  );

  setText(isBalanced ? [4, 120, 87] : [190, 18, 60], 13, "bold");
  drawText(formatRupiah(summary.total_kewajiban_ekuitas), rightX - 4, y + 13, {
    align: "right",
  });

  y += 34;

  setText([100, 116, 139], 7, "normal");
  drawText(
    "Laporan ini dihasilkan otomatis dari saldo akun yang sudah diposting pada engine akuntansi ERP BUMDes.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  pdf.save(formatFileName(fileName));
}
