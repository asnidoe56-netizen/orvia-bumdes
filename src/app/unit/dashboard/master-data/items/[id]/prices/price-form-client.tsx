"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Save, Store, Tag, Truck, UserRound, X } from "lucide-react";

type PriceFormClientProps = {
  action: (formData: FormData) => void | Promise<void>;
  activePrice: number;
  averageCost: number;
};

const priceTypes = [
  { value: "retail", label: "Retail", icon: Store },
  { value: "grosir", label: "Grosir", icon: BriefcaseBusiness },
  { value: "agen", label: "Agen", icon: UserRound },
  { value: "distributor", label: "Distributor", icon: Truck },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseCurrency(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/Rp/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function PriceFormClient({
  action,
  activePrice,
  averageCost,
}: PriceFormClientProps) {
  const [priceType, setPriceType] = useState("retail");
  const [salesPriceInput, setSalesPriceInput] = useState("");
  const [reason, setReason] = useState("");

  const salesPrice = useMemo(() => parseCurrency(salesPriceInput), [salesPriceInput]);
  const difference = salesPrice - activePrice;
  const margin = salesPrice - averageCost;
  const marginPercentage = averageCost > 0 ? (margin / averageCost) * 100 : 0;

  const marginStatus = useMemo(() => {
    if (averageCost <= 0 || salesPrice <= 0) {
      return {
        label: "Belum dihitung",
        className: "border-slate-200 bg-slate-50 text-slate-600",
        barClassName: "bg-slate-200",
      };
    }

    if (marginPercentage < 0) {
      return {
        label: "Rendah / rugi",
        className: "border-red-200 bg-red-50 text-red-700",
        barClassName: "bg-red-500",
      };
    }

    if (marginPercentage < 10) {
      return {
        label: "Tipis",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        barClassName: "bg-amber-500",
      };
    }

    if (marginPercentage < 25) {
      return {
        label: "Cukup",
        className: "border-lime-200 bg-lime-50 text-lime-700",
        barClassName: "bg-lime-500",
      };
    }

    return {
      label: "Baik",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      barClassName: "bg-emerald-500",
    };
  }, [averageCost, marginPercentage, salesPrice]);

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.95fr)]">
      <form action={action} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Buat Harga Baru</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Harga lama ditutup otomatis sesuai tanggal berlaku harga baru. Riwayat tetap tersimpan untuk audit.
            </p>
          </div>

          <div className={`hidden rounded-2xl border px-4 py-3 text-right text-sm sm:block ${marginStatus.className}`}>
            <p className="font-semibold">Indikator Margin</p>
            <p className="mt-1 text-2xl font-black">{marginPercentage.toFixed(0)}%</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold sm:grid-cols-4">
          {priceTypes.map((type) => {
            const Icon = type.icon;
            const active = priceType === type.value;

            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setPriceType(type.value)}
                className={`flex items-center justify-center gap-2 border-slate-200 px-3 py-3 transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {type.label}
              </button>
            );
          })}
        </div>

        <input type="hidden" name="price_type" value={priceType} />

        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Harga Jual Baru</span>
            <div className="mt-1 flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-emerald-500">
              <input
                name="sales_price"
                type="text"
                inputMode="decimal"
                value={salesPriceInput}
                onChange={(event) => setSalesPriceInput(event.target.value)}
                placeholder="Contoh: 1200000"
                required
                className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
              />
              <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                Rp
              </span>
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Berlaku Mulai</span>
            <input
              name="effective_from"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Alasan Perubahan</span>
            <textarea
              name="reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: Harga pasar turun, promo, stok lama, barang rusak ringan, atau keputusan pengelola."
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Indikator Margin</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{marginPercentage.toFixed(0)}%</p>
          <p className="mt-1 text-sm text-slate-600">{marginStatus.label}</p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="reset"
            onClick={() => {
              setSalesPriceInput("");
              setReason("");
              setPriceType("retail");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Batal
          </button>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Save className="h-4 w-4" />
            Simpan Harga Baru
          </button>
        </div>
      </form>

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Ringkasan Perubahan</h2>
            <p className="mt-1 text-sm text-slate-500">Dihitung otomatis dari harga yang diisi.</p>
          </div>
          <div className="rounded-full bg-slate-100 p-2 text-slate-500">
            <Tag className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Harga Aktif Saat Ini</span>
            <span className="font-bold text-slate-900">{formatCurrency(activePrice)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Harga Baru</span>
            <span className="font-bold text-emerald-700">{formatCurrency(salesPrice)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Selisih</span>
            <span className={`font-bold ${difference < 0 ? "text-red-600" : "text-slate-900"}`}>
              {formatCurrency(difference)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Persentase Margin</span>
            <span className={`font-bold ${marginPercentage < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {marginPercentage.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="my-5 h-px bg-slate-100" />

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">HPP Rata-rata</span>
            <span className="font-bold text-slate-900">{formatCurrency(averageCost)}</span>
          </div>

          <div className={`rounded-2xl border p-4 ${marginStatus.className}`}>
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold">Margin terhadap HPP</span>
              <span className="text-xl font-black">{marginPercentage.toFixed(0)}%</span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className={`h-full rounded-full ${marginStatus.barClassName}`}
                style={{ width: `${Math.max(0, Math.min(100, marginPercentage))}%` }}
              />
            </div>

            <p className="mt-3 text-xs font-medium">{marginStatus.label}</p>
          </div>

          {salesPrice > 0 && averageCost > 0 && salesPrice < averageCost ? (
            <p className="rounded-2xl bg-red-50 p-3 text-xs leading-5 text-red-700">
              Harga baru berada di bawah HPP rata-rata. Sistem tetap mengizinkan karena kondisi lapangan bisa berubah, tetapi transaksi berpotensi rugi.
            </p>
          ) : null}
        </div>
      </aside>
    </section>
  );
}