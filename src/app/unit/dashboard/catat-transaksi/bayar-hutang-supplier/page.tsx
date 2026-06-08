import { SupplierPaymentEntryForm } from "../_components/supplier-payment-entry-form";

type BayarHutangSupplierPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function BayarHutangSupplierPage({
  searchParams,
}: BayarHutangSupplierPageProps) {
  const params = await searchParams;

  return (
    <SupplierPaymentEntryForm
      errorMessage={params?.error ? decodeURIComponent(params.error) : null}
    />
  );
}
