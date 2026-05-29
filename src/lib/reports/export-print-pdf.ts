type ExportElementToPrintPdfOptions = {
  targetId: string;
  fileName?: string;
  stylesheetHref: string;
  documentTitle?: string;
};

function removeNonPrintableElements(root: HTMLElement) {
  root
    .querySelectorAll("button, nav, aside, header, .print-hidden, .print\\:hidden")
    .forEach((element) => element.remove());
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function exportElementToPrintPdf({
  targetId,
  fileName = "laporan.pdf",
  stylesheetHref,
  documentTitle,
}: ExportElementToPrintPdfOptions) {
  const target = document.getElementById(targetId);

  if (!target) {
    throw new Error(`Area laporan dengan id "${targetId}" tidak ditemukan.`);
  }

  const clonedTarget = target.cloneNode(true) as HTMLElement;
  removeNonPrintableElements(clonedTarget);

  const safeTitle = escapeHtml(documentTitle ?? fileName.replace(/\.pdf$/i, ""));

  const printWindow = window.open("", "_blank", "width=980,height=1200");

  if (!printWindow) {
    throw new Error("Popup print diblokir browser. Izinkan popup untuk membuat PDF.");
  }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="${stylesheetHref}" />
</head>
<body>
  <main class="print-document-root">
    ${clonedTarget.outerHTML}
  </main>

  <script>
    const runPrint = () => {
      window.focus();
      setTimeout(() => window.print(), 350);
    };

    if (document.readyState === "complete") {
      runPrint();
    } else {
      window.addEventListener("load", runPrint);
    }
  </script>
</body>
</html>`);
  printWindow.document.close();
}
