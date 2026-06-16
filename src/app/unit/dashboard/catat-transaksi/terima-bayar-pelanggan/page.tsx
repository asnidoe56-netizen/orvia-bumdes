import { CustomerPaymentEntryForm } from "../_components/customer-payment-entry-form";

type TerimaBayarPelangganPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function TerimaBayarPelangganPage({
  searchParams,
}: TerimaBayarPelangganPageProps) {
  const params = await searchParams;

  return (
    <CustomerPaymentEntryForm
      errorMessage={params?.error ? decodeURIComponent(params.error) : null}
    />
  );
}
