import { PurchaseEntryForm } from "../_components/purchase-entry-form";

export default function BeliTunaiPage() {
  return (
    <PurchaseEntryForm
      paymentType="cash"
      eyebrow="Catat Transaksi / Beli Tunai"
      title="Beli Tunai"
      subtitle="Gunakan form ini untuk mencatat pembelian barang yang langsung dibayar dari kas atau bank unit."
      submitLabel="Simpan & Posting Beli Tunai"
    />
  );
}

