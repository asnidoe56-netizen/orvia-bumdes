import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Handshake,
  Leaf,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PublicNavbar } from "@/components/public/public-navbar";
import { getPublicLandingContent } from "@/lib/public/landing-content";

const values = [
  {
    title: "Kejernihan",
    description:
      "Setiap proses penting diarahkan agar tercatat, terbaca, dan dapat ditelusuri dengan lebih jelas.",
    icon: Sparkles,
  },
  {
    title: "Akuntabilitas",
    description:
      "Setiap peran bekerja sesuai kewenangan, dengan alur yang mendukung pertanggungjawaban publik.",
    icon: ShieldCheck,
  },
  {
    title: "Kolaborasi",
    description:
      "BUMDes, unit usaha, pendamping, pengawas, dan pemerintah daerah terhubung dalam satu ekosistem kerja.",
    icon: Handshake,
  },
  {
    title: "Pertumbuhan Desa",
    description:
      "Data dan laporan yang tertib membantu BUMDes mengambil keputusan yang lebih sehat dan terukur.",
    icon: Leaf,
  },
];

const principles = [
  "Tata kelola yang kuat dimulai dari pencatatan yang jernih.",
  "Kepercayaan publik tumbuh ketika proses dapat dipertanggungjawabkan.",
  "Teknologi desa harus menyederhanakan pekerjaan penting, bukan membuatnya semakin rumit.",
  "BUMDes yang sehat membutuhkan kolaborasi antara pengelola, pendamping, pengawas, dan pemerintah daerah.",
];

export default async function TentangPage() {
  const landingContent = await getPublicLandingContent();
  const aboutSection = landingContent.sections.find(
    (section) => section.section_key === "tentang",
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <PublicNavbar />

      <section className="relative isolate overflow-hidden px-4 pb-20 pt-36 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]" />

        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-700">
              {aboutSection?.eyebrow ?? "Tentang ORVIA-BUMDES"}
            </p>

            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Menguatkan BUMDes dari dalam: tertib tata kelola, jernih laporan,
              tumbuh bersama desa.
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
              ORVIA-BUMDES adalah platform tata kelola dan ERP BUMDes yang
              membantu desa membangun usaha yang lebih transparan, akuntabel,
              terukur, dan dipercaya masyarakat.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                Mulai Registrasi
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/#aplikasi"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Lihat Ekosistem
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-2xl shadow-emerald-100/60">
            <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                Filosofi
              </p>
              <h2 className="mt-4 text-3xl font-black">
                Usaha desa yang kuat lahir dari tata kelola yang jernih.
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-300">
                Ketika data tertib, laporan lebih mudah dipercaya. Ketika
                proses transparan, keputusan menjadi lebih bertanggung jawab.
                Ketika semua pihak terhubung, BUMDes dapat tumbuh sebagai
                kekuatan ekonomi desa yang sehat dan bermakna bagi masyarakat.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {principles.map((principle) => (
                <div
                  key={principle}
                  className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <p className="text-sm font-semibold leading-6 text-slate-700">
                    {principle}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
              Mengapa ORVIA-BUMDES
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Bukan sekadar aplikasi pencatatan, tetapi ruang kerja tata kelola
              desa.
            </h2>
          </div>

          <div className="space-y-6 text-base leading-8 text-slate-600">
            <p>
              BUMDes lahir dari cita-cita besar: menjadikan desa lebih mandiri,
              produktif, dan mampu mengelola potensinya sendiri. Di dalamnya ada
              kepercayaan masyarakat, amanah pemerintah desa, kerja keras
              pengelola, serta harapan agar usaha desa benar-benar memberi
              manfaat bagi warga.
            </p>

            <p>
              Namun membangun BUMDes yang sehat tidak hanya membutuhkan modal
              dan semangat. Ia membutuhkan sistem. Ia membutuhkan tata kelola
              yang tertib, pencatatan yang rapi, laporan yang dapat dipercaya,
              serta proses pengawasan dan pendampingan yang berjalan tanpa
              saling menebak.
            </p>

            <p>
              ORVIA-BUMDES dibangun untuk menjawab kebutuhan itu. Setiap
              transaksi tidak hanya dicatat sebagai angka, tetapi ditempatkan
              dalam alur pertanggungjawaban yang jelas. Setiap peran memiliki
              ruang kerja sesuai kewenangan. Setiap laporan disusun agar lebih
              mudah dibaca, diperiksa, dan dijadikan dasar pengambilan
              keputusan.
            </p>

            <p>
              Kami percaya bahwa teknologi terbaik untuk desa bukanlah teknologi
              yang membuat proses menjadi rumit, tetapi teknologi yang membuat
              pekerjaan penting menjadi lebih mudah, lebih tertib, dan lebih
              dapat dipercaya.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
              Nilai Utama
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Empat fondasi untuk menjaga kepercayaan publik desa.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {values.map((value) => {
              const Icon = value.icon;

              return (
                <div
                  key={value.title}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-slate-950">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
              Dari administrasi menuju kepercayaan
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              ORVIA-BUMDES hadir untuk mendampingi perjalanan BUMDes menuju tata
              kelola yang lebih matang.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              Dari pencatatan menuju kepercayaan, dari administrasi menuju tata
              kelola, dari usaha desa menuju kemandirian bersama.
            </p>
          </div>

          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-50"
          >
            Mulai Registrasi
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
