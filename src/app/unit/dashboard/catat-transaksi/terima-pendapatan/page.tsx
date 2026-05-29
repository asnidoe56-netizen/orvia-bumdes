import Link from "next/link";
import { ArrowLeft, HandCoins } from "lucide-react";
import { RevenueReceiptEntrySection } from "./_components/revenue-receipt-entry-section";

export default function TerimaPendapatanPage() {
  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/unit/dashboard/catat-transaksi"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div>
          <p className="text-sm text-slate-500">Catat Transaksi</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Terima Pendapatan
          </h1>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <HandCoins className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Pencatatan Penerimaan Pendapatan Unit
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Gunakan halaman ini untuk mencatat penerimaan pendapatan unit
              seperti pendapatan jasa, pendapatan lain-lain, atau penerimaan
              pendapatan non-penjualan barang.
            </p>
          </div>
        </div>
      </div>

      <RevenueReceiptEntrySection />
    </main>
  );
}
