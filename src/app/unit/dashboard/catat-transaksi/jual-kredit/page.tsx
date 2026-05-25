import { ArrowLeft, ReceiptText } from "lucide-react";
import Link from "next/link";

export default function JualKreditPage() {
  return (
    <div className="space-y-5">
      <Link
        href="/unit/dashboard/catat-transaksi"
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Catat Transaksi / Jual Kredit
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Jual Kredit
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Fondasi halaman penjualan kredit sudah tersedia. Form transaksi
              akan dihubungkan setelah engine penjualan kredit diverifikasi dari
              database.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ReceiptText className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h2 className="text-lg font-bold text-slate-950">
          Form akan disiapkan setelah engine valid
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Nantinya user cukup mengisi pelanggan, barang, jumlah, harga jual,
          tanggal transaksi, dan jatuh tempo. Backend akan menangani stok
          keluar, piutang, pendapatan, harga pokok, dan pencatatan keuangan.
        </p>
      </section>
    </div>
  );
}
