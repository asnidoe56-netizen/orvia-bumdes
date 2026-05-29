import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CreditCard,
  HandCoins,
  ReceiptText,
  ShoppingBag,
  Wallet,
  FilePenLine,
} from "lucide-react";

const purchaseCards = [
  {
    title: "Beli Tunai",
    description:
      "Catat pembelian barang yang langsung dibayar dari kas atau bank unit.",
    href: "/unit/dashboard/catat-transaksi/beli-tunai",
    icon: Wallet,
    disabled: false,
  },
  {
    title: "Beli Kredit",
    description:
      "Catat pembelian barang dari supplier yang pembayarannya dilakukan belakangan.",
    href: "/unit/dashboard/catat-transaksi/beli-kredit",
    icon: CreditCard,
    disabled: false,
  },
  {
    title: "Bayar Hutang Supplier",
    description:
      "Bayar hutang dari pembelian kredit dan posting otomatis ke kas/bank serta jurnal.",
    href: "/unit/dashboard/catat-transaksi/bayar-hutang-supplier",
    icon: HandCoins,
    disabled: false,
  },
];

const salesCards = [
  {
    title: "Jual Tunai",
    description:
      "Catat penjualan barang yang langsung dibayar oleh pelanggan.",
    href: "/unit/dashboard/catat-transaksi/jual-tunai",
    icon: Wallet,
    disabled: false,
  },
  {
    title: "Jual Kredit",
    description:
      "Catat penjualan barang yang pembayarannya dilakukan belakangan dan otomatis menjadi piutang.",
    href: "/unit/dashboard/catat-transaksi/jual-kredit",
    icon: CreditCard,
    disabled: false,
  },
];

const revenueCards = [
  {
    title: "Terima Pendapatan",
    description:
      "Catat penerimaan pendapatan unit seperti pendapatan jasa, pendapatan lain-lain, atau penerimaan pendapatan non-penjualan barang.",
    href: "/unit/dashboard/catat-transaksi/terima-pendapatan",
    icon: HandCoins,
    disabled: false,
  },
];
const capitalCards = [
  {
    title: "Belanja Modal",
    description:
      "Siapkan pencatatan pembelian aset operasional seperti peralatan, mesin, meubelair, bangunan, konstruksi, dan software.",
    href: "/unit/dashboard/catat-transaksi/belanja-modal",
    icon: Building2,
    disabled: false,
  },
  {
    title: "Bayar Hutang Belanja Modal",
    description:
      "Bayar hutang dari Belanja Modal kredit dan posting otomatis ke kas/bank serta jurnal.",
    href: "/unit/dashboard/catat-transaksi/bayar-hutang-belanja-modal",
    icon: HandCoins,
    disabled: false,
  },
];


const governanceCards = [
  {
    title: "Koreksi Transaksi",
    description:
      "Ajukan koreksi atas transaksi yang sudah diposting. Pengawas akan mereview, lalu Admin BUMDes memposting koreksi final.",
    href: "/unit/dashboard/catat-transaksi/koreksi-transaksi",
    icon: FilePenLine,
    disabled: false,
  },
];
const expenseCards = [
  {
    title: "Beban Operasional",
    description:
      "Catat biaya operasional unit seperti gaji pegawai, listrik, transportasi, administrasi, pemeliharaan, dan beban usaha lainnya.",
    href: "/unit/dashboard/catat-transaksi/beban-operasional",
    icon: ReceiptText,
    disabled: false,
  },
];

function TransactionCard({
  title,
  description,
  href,
  icon: Icon,
  disabled,
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof Wallet;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 opacity-80">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400">
            <Icon className="h-6 w-6" />
          </div>

          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            Belum aktif
          </span>
        </div>

        <h3 className="mt-5 text-lg font-bold text-slate-500">{title}</h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    );
  }

  return (
    <Link
      href={href}
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

      <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  );
}

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

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Pembelian</h2>
          <p className="mt-1 text-sm text-slate-600">
            Catat barang masuk dari supplier, baik dibayar tunai maupun kredit.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {purchaseCards.map((card) => (
            <TransactionCard key={card.href} {...card} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Penjualan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Penjualan tunai dan penjualan kredit sudah aktif melalui engine
            database penjualan, stok, HPP, pendapatan, kas, dan piutang.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {salesCards.map((card) => (
            <TransactionCard key={card.href} {...card} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">
            Penerimaan Pendapatan
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Catat pendapatan masuk dengan bahasa bisnis sederhana. Backend akan
            menangani kas/bank, jurnal, audit, dan laporan laba rugi.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {revenueCards.map((card) => (
            <TransactionCard key={card.href} {...card} />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">
            Aset & Belanja Modal
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Siapkan pencatatan pembelian aset operasional lintas unit. Engine
            database akan disambungkan setelah struktur Belanja Modal selesai.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {capitalCards.map((card) => (
            <TransactionCard key={card.href} {...card} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">
            Beban Operasional
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Catat biaya rutin unit dengan bahasa bisnis sederhana. Backend akan
            menangani kas/bank, jurnal, audit, dan validasi saldo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {expenseCards.map((card) => (
            <TransactionCard key={card.href} {...card} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">
            Koreksi & Governance
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Ajukan koreksi transaksi dengan alur audit: pengajuan unit,
            review Pengawas, dan posting final oleh Admin BUMDes.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {governanceCards.map((card) => (
            <TransactionCard key={card.href} {...card} />
          ))}
        </div>
      </section>
      <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <ShoppingBag className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Fondasi transaksi harian
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Pembelian tunai, pembelian kredit, penjualan tunai, dan
              penjualan kredit sudah aktif. Engine database tetap menangani
              stok, kas/bank, utang, piutang, HPP, pendapatan, dan jurnal.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}









