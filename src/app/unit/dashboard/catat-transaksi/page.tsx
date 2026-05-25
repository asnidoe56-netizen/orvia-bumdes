import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  ReceiptText,
  ShoppingBag,
  Wallet,
} from "lucide-react";

const transactionCards = [
  {
    title: "Beli Tunai",
    description:
      "Catat pembelian barang yang langsung dibayar dari kas atau bank unit.",
    href: "/unit/dashboard/catat-transaksi/beli-tunai",
    icon: Wallet,
  },
  {
    title: "Beli Kredit",
    description:
      "Catat pembelian barang dari supplier yang pembayarannya dilakukan belakangan.",
    href: "/unit/dashboard/catat-transaksi/beli-kredit",
    icon: CreditCard,
  },
];

export default function CatatTransaksiPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin Unit / Catat Transaksi
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Catat Transaksi
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Pilih jenis transaksi sesuai aktivitas harian unit. Form dibuat
              sederhana, sementara proses pencatatan lengkap tetap dijalankan
              oleh engine database.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ReceiptText className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {transactionCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-6 w-6" />
                </div>

                <div className="rounded-full bg-slate-50 p-2 text-slate-400 transition group-hover:bg-emerald-50 group-hover:text-emerald-700">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>

              <h2 className="mt-5 text-lg font-bold text-slate-950">
                {card.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <ShoppingBag className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Tahap awal: transaksi pembelian
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Saat ini card yang diaktifkan adalah Beli Tunai dan Beli Kredit.
              Jenis transaksi lain bisa ditambahkan bertahap setelah engine
              database-nya selesai diverifikasi.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
