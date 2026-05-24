import { PlaceholderCard } from "@/components/dashboard/placeholder-card";

export default function BupatiDashboardPage() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <PlaceholderCard
        title="Bupati"
        description="Area ini disiapkan untuk ringkasan eksekutif dan kinerja BUMDes secara regional."
      />
      <PlaceholderCard
        title="Executive Summary"
        description="Modul ini nanti membaca ringkasan performa wilayah dari view laporan database."
      />
      <PlaceholderCard
        title="Prinsip Akses"
        description="Dashboard Bupati bersifat monitoring strategis dan tidak melakukan transaksi operasional."
      />
    </div>
  );
}
