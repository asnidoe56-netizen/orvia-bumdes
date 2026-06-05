import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  CreditCard,
  FilePenLine,
  HandCoins,
  ReceiptText,
  ShoppingBag,
  Wallet,
} from "lucide-react";

type TransactionCardItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  tone: string;
};

const transactionCards: TransactionCardItem[] = [
  {
    title: "Beli Tunai",
    description: "Pembelian barang dibayar langsung. Stok dan HPP otomatis.",
    href: "/unit/dashboard/catat-transaksi/beli-tunai",
    icon: Wallet,
    disabled: false,
    tone: "from-emerald-50 to-teal-50 text-emerald-700 ring-emerald-100",
  },
  {
    title: "Beli Kredit",
    description: "Pembelian dari supplier. Persediaan dan utang otomatis.",
    href: "/unit/dashboard/catat-transaksi/beli-kredit",
    icon: CreditCard,
    disabled: false,
    tone: "from-amber-50 to-orange-50 text-amber-700 ring-amber-100",
  },
  {
    title: "Jual Tunai",
    description: "Penjualan dibayar tunai. Kas, stok, dan HPP otomatis.",
    href: "/unit/dashboard/catat-transaksi/jual-tunai",
    icon: ShoppingBag,
    disabled: false,
    tone: "from-sky-50 to-cyan-50 text-sky-700 ring-sky-100",
  },
  {
    title: "Jual Kredit",
    description: "Penjualan dengan piutang pelanggan dan HPP otomatis.",
    href: "/unit/dashboard/catat-transaksi/jual-kredit",
    icon: CreditCard,
    disabled: false,
    tone: "from-violet-50 to-purple-50 text-violet-700 ring-violet-100",
  },
  {
    title: "Bayar Hutang Supplier",
    description: "Pelunasan utang pembelian kredit ke supplier.",
    href: "/unit/dashboard/catat-transaksi/bayar-hutang-supplier",
    icon: HandCoins,
    disabled: false,
    tone: "from-teal-50 to-cyan-50 text-teal-700 ring-teal-100",
  },
  {
    title: "Terima Pendapatan",
    description: "Penerimaan pendapatan jasa atau pendapatan lain.",
    href: "/unit/dashboard/catat-transaksi/terima-pendapatan",
    icon: HandCoins,
    disabled: false,
    tone: "from-lime-50 to-emerald-50 text-lime-700 ring-lime-100",
  },
  {
    title: "Beban Operasional",
    description: "Catat biaya rutin unit dan validasi saldo kas/bank.",
    href: "/unit/dashboard/catat-transaksi/beban-operasional",
    icon: ReceiptText,
    disabled: false,
    tone: "from-fuchsia-50 to-pink-50 text-fuchsia-700 ring-fuchsia-100",
  },
  {
    title: "Belanja Modal",
    description: "Pembelian aset operasional seperti alat, mesin, dan bangunan.",
    href: "/unit/dashboard/catat-transaksi/belanja-modal",
    icon: Building2,
    disabled: false,
    tone: "from-slate-100 to-amber-50 text-slate-700 ring-slate-200",
  },
  {
    title: "Bayar Hutang Belanja Modal",
    description: "Pelunasan utang dari transaksi belanja modal kredit.",
    href: "/unit/dashboard/catat-transaksi/bayar-hutang-belanja-modal",
    icon: HandCoins,
    disabled: false,
    tone: "from-orange-50 to-red-50 text-orange-700 ring-orange-100",
  },
  {
    title: "Koreksi Transaksi",
    description: "Ajukan koreksi transaksi dengan alur review Pengawas.",
    href: "/unit/dashboard/catat-transaksi/koreksi-transaksi",
    icon: FilePenLine,
    disabled: false,
    tone: "from-blue-50 to-indigo-50 text-blue-700 ring-blue-100",
  },
];

function TransactionCard({
  title,
  description,
  href,
  icon: Icon,
  disabled,
  tone,
}: TransactionCardItem) {
  if (disabled) {
    return (
      <div className="min-h-[126px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 opacity-80">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-400">
            <Icon className="h-5 w-5" />
          </div>

          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            Belum aktif
          </span>
        </div>

        <h3 className="mt-4 text-base font-bold text-slate-500">{title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-500">
          {description}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group min-h-[126px] rounded-2xl border border-slate-900 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${tone}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="rounded-full bg-slate-50 p-2 text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-700">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>

      <h3 className="mt-4 text-base font-bold text-slate-950">{title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-600">
        {description}
      </p>
    </Link>
  );
}

export default function CatatTransaksiPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-900 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-700">
              Modul Unit Perdagangan
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Catat Transaksi
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Pilih jenis aktivitas harian. Jurnal, kas/bank, stok, utang,
              piutang, HPP, dan laporan diproses otomatis oleh engine database.
            </p>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <ReceiptText className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              Aktivitas Harian
            </p>
            <h2 className="text-lg font-bold text-slate-950">
              Pilih transaksi yang akan dicatat
            </h2>
          </div>

          <p className="text-sm text-slate-500">
            {transactionCards.length} menu tersedia
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {transactionCards.map((card) => (
            <TransactionCard key={card.href} {...card} />
          ))}
        </div>
      </section>
    </div>
  );
}


