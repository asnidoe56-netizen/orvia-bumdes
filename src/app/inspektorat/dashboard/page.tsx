import { PlaceholderCard } from "@/components/dashboard/placeholder-card";

export default function InspektoratDashboardPage() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <PlaceholderCard
        title="Inspektorat"
        description="Area ini disiapkan untuk temuan audit, tindak lanjut, dan kepatuhan BUMDes."
      />
      <PlaceholderCard
        title="Audit Findings"
        description="Modul ini nanti membaca data temuan audit dan compliance dari view/RPC database."
      />
      <PlaceholderCard
        title="Prinsip Audit"
        description="Inspektorat membaca jejak audit dan kepatuhan tanpa mengubah transaksi posted."
      />
    </div>
  );
}
