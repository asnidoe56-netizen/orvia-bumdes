import { SalesEntryForm } from "../_components/sales-entry-form";

export default function JualTunaiPage() {
  return (
    <SalesEntryForm
      paymentType="cash"
      eyebrow="Catat Transaksi / Jual Tunai"
      title="Jual Tunai"
      subtitle="Gunakan form ini untuk mencatat penjualan barang yang langsung dibayar oleh pelanggan."
      submitLabel="Simpan & Posting Jual Tunai"
    />
  );
}
