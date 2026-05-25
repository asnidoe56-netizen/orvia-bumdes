import { PurchaseEntryForm } from "../_components/purchase-entry-form";

export default function BeliKreditPage() {
  return (
    <PurchaseEntryForm
      paymentType="credit"
      eyebrow="Catat Transaksi / Beli Kredit"
      title="Beli Kredit"
      subtitle="Gunakan form ini untuk mencatat pembelian barang dari supplier yang pembayarannya dilakukan belakangan."
      submitLabel="Simpan & Posting Beli Kredit"
    />
  );
}

