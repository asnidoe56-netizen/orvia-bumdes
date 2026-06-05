import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { ExpenseEntrySection } from "./_components/expense-entry-section";

export default function BebanOperasionalPage() {
  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/unit/dashboard/catat-transaksi"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-900 bg-white text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div>
          <p className="text-sm text-slate-500">Catat Transaksi</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Beban Operasional
          </h1>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-900 bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
            <ReceiptText className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Pencatatan Beban Unit
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Gunakan halaman ini untuk mencatat biaya operasional unit seperti
              gaji pegawai, listrik, transportasi, administrasi, pemeliharaan,
              dan beban usaha lainnya.
            </p>
          </div>
        </div>
      </div>

      <ExpenseEntrySection />
    </main>
  );
}

