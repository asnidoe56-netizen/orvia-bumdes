import { SalesEntryForm } from "../_components/sales-entry-form";

export default function JualKreditPage() {
  return (
    <SalesEntryForm
      paymentType="credit"
      eyebrow="Catat Transaksi / Jual Kredit"
      title="Jual Kredit"
      subtitle="Gunakan form ini untuk mencatat penjualan barang yang pembayarannya dilakukan belakangan. Sistem akan mencatat piutang, pendapatan, HPP, dan stok keluar melalui engine database."
      submitLabel="Simpan & Posting Jual Kredit"
    />
  );
}
