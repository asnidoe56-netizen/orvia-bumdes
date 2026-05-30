import { PublicLoanApplicationForm } from "./_components/public-loan-application-form";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    slug: string;
    token: string;
  }>;
};

type PublicFormMetadata = {
  public_slug: string;
  title: string;
  description: string | null;
  nama_bumdes: string;
  nama_desa: string;
  nama_kecamatan: string;
  nama_unit: string;
  kode_unit: string;
  allow_individual: boolean;
  allow_group: boolean;
  require_pdf: boolean;
  max_requested_amount: number | null;
  min_tenor_months: number | null;
  max_tenor_months: number | null;
};

export default async function PublicLoanApplicationPage({ params }: PageProps) {
  const { slug, token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_savings_loan_public_application_form",
    {
      p_public_slug: slug,
      p_public_token: token,
    },
  );

  const metadata = Array.isArray(data)
    ? (data[0] as PublicFormMetadata | undefined)
    : undefined;

  if (error || !metadata) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Link Tidak Aktif
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">
            Form pengajuan tidak tersedia
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Link pengajuan publik tidak ditemukan, tidak aktif, atau sudah
            dinonaktifkan oleh pengelola unit.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl gap-6">
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">
            Form Publik Simpan Pinjam
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {metadata.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                {metadata.description ??
                  "Ajukan pinjaman secara mandiri. Data akan diverifikasi oleh petugas unit sebelum diproses lebih lanjut."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Tujuan Pengajuan
              </p>
              <p className="mt-2 text-lg font-black text-slate-950">
                {metadata.nama_unit}
              </p>
              <p className="text-sm text-slate-600">
                BUMDes {metadata.nama_bumdes}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Desa {metadata.nama_desa}, Kecamatan{" "}
                {metadata.nama_kecamatan}
              </p>
            </div>
          </div>
        </section>

        <PublicLoanApplicationForm metadata={metadata} token={token} />
      </div>
    </main>
  );
}