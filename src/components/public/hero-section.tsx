import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { trustItems } from "@/components/public/landing-data";
import type {
  PublicLandingItem,
  PublicLandingSection,
} from "@/lib/public/landing-content";

type HeroSectionProps = {
  section?: PublicLandingSection;
  featureItems: PublicLandingItem[];
};

export function HeroSection({ section, featureItems }: HeroSectionProps) {
  void featureItems;

  const imageUrl = section?.image_url || "/images/hero-bumdes-governance.png";
  const eyebrow =
    section?.eyebrow || "Sistem ERP multi-tenant untuk tata kelola BUMDes";
  const title =
    section?.title ||
    "Satu platform untuk tenant, unit usaha, akuntansi, transaksi, audit, dan laporan.";
  const description =
    section?.subtitle ||
    section?.body ||
    "Dibangun dengan prinsip database-first sebagai sumber kebenaran. Frontend menjadi lapisan workflow dan UI, sementara posting, approval, permission, audit, dan governance berjalan melalui engine database.";
  const primaryCtaLabel = section?.cta_label || "Masuk ke Dashboard";
  const primaryCtaHref = section?.cta_href || "/login";

  return (
    <section
      id="beranda"
      className="relative overflow-hidden bg-[radial-gradient(circle_at_86%_12%,rgba(103,232,249,0.34),transparent_34%),radial-gradient(circle_at_12%_84%,rgba(255,237,213,0.46),transparent_31%),linear-gradient(135deg,#ffffff_0%,#f8fdff_42%,#e0f7ff_100%)] pt-20"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0_43%,rgba(125,211,252,0.16)_43%_55%,transparent_55%),linear-gradient(45deg,transparent_0_58%,rgba(186,230,253,0.24)_58%_68%,transparent_68%)]" />
      <div className="absolute -right-20 top-16 h-96 w-96 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="absolute bottom-0 left-1/2 h-80 w-80 rounded-full bg-orange-100/65 blur-3xl" />
      <div className="absolute right-16 top-48 hidden h-44 w-44 rounded-full border border-cyan-200/70 bg-white/20 backdrop-blur-sm 2xl:block" />

      <div className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 2xl:grid-cols-[0.86fr_1.14fr] lg:px-8 lg:py-20">
        <section className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            {eyebrow}
          </div>

          <h1 className="mt-7 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl 2xl:text-6xl">
            {title}
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            {description}
          </p>

          {section?.body && section?.subtitle ? (
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
              {section.body}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryCtaHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#b6f4fc] px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-100 transition hover:-translate-y-0.5 hover:bg-[#8ee8f5]"
            >
              {primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-6 py-4 text-sm font-black text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-50"
            >
              <Building2 className="h-4 w-4" />
              Daftarkan BUMDes
            </Link>
          </div>

          <div className="mt-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-4">
            {trustItems.map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-2xl font-black text-slate-950">
                  {item.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative min-h-[360px] sm:min-h-[430px] 2xl:min-h-[560px]">
          <div className="absolute -right-10 top-2 hidden h-72 w-72 rounded-full bg-emerald-100/80 2xl:block" />
          <div className="absolute -right-20 top-64 hidden h-40 w-40 rounded-full bg-orange-100/90 2xl:block" />
          <div className="absolute bottom-20 right-4 hidden h-32 w-32 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] [background-size:14px_14px] opacity-35 2xl:block" />

          <div className="relative h-[360px] w-full sm:h-[430px] 2xl:absolute 2xl:right-[-180px] 2xl:top-[-10px] 2xl:h-[470px] 2xl:w-[880px]">
            <Image
              src={imageUrl}
              alt="Visual forum laporan dan dashboard kesehatan keuangan BUMDes"
              fill
              unoptimized
              priority
              sizes="(max-width: 1536px) 100vw, 58vw"
              className="object-contain object-center"
            />
          </div>
        </section>
      </div>
    </section>
  );
}



