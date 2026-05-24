import { PlaceholderCard } from "@/components/dashboard/placeholder-card";

export default function DinasPmdDashboardPage() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <PlaceholderCard
        title="Dinas PMD"
        description="Area ini disiapkan untuk monitoring dan pelaporan antar-BUMDes pada level daerah."
      />
      <PlaceholderCard
        title="Monitoring Wilayah"
        description="Modul ini nanti membaca ringkasan performa BUMDes dari view laporan database."
      />
      <PlaceholderCard
        title="Prinsip Akses"
        description="Dinas PMD membaca data monitoring sesuai scope wilayah, bukan melakukan transaksi unit."
      />
    </div>
  );
}
