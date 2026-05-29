import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  GitBranch,
  Handshake,
  Layers3,
  LockKeyhole,
  MonitorCheck,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { PublicNavbar } from "@/components/public/public-navbar";
import { PublicNewsPopup } from "@/components/public/public-news-popup";
import { getPublicLandingContent } from "@/lib/public/landing-content";

const managementPrinciples = [
  {
    title: "Akuntabilitas",
    description:
      "Setiap proses penting diarahkan agar memiliki penanggung jawab, status, dan jejak data yang dapat ditelusuri.",
    icon: ShieldCheck,
  },
  {
    title: "Transparansi",
    description:
      "Informasi strategis dapat dipantau sesuai peran dan kewenangan masing-masing aktor dalam ekosistem.",
    icon: MonitorCheck,
  },
  {
    title: "Keamanan Data",
    description:
      "Akses pengguna dibatasi berdasarkan tenant, unit usaha, dan peran agar data tetap terlindungi.",
    icon: LockKeyhole,
  },
  {
    title: "Keberlanjutan",
    description:
      "Platform dikembangkan bertahap berdasarkan kebutuhan BUMDes, tata kelola desa, dan evaluasi lapangan.",
    icon: GitBranch,
  },
];

const managementTeams = [
  {
    title: "Pengelola Platform",
    description:
      "Menjaga arah strategis, kebijakan layanan, standar pengembangan, dan keberlanjutan platform.",
    responsibilities: [
      "Menentukan arah pengembangan platform.",
      "Menjaga kualitas layanan.",
      "Mengatur standar tata kelola sistem.",
      "Mengelola kerja sama dan ekosistem pengguna.",
    ],
    icon: Building2,
  },
  {
    title: "Tim Teknologi dan Sistem",
    description:
      "Mengelola pengembangan aplikasi, database, keamanan, integrasi, dan stabilitas sistem.",
    responsibilities: [
      "Mengembangkan fitur dan modul.",
      "Menjaga performa sistem.",
      "Mengelola keamanan akses dan data.",
      "Melakukan pembaruan sistem secara berkala.",
    ],
    icon: Database,
  },
  {
    title: "Tim Tata Kelola dan Akuntansi",
    description:
      "Memastikan alur sistem sesuai prinsip akuntansi, pelaporan, audit, dan pertanggungjawaban BUMDes.",
    responsibilities: [
      "Merancang alur transaksi dan pelaporan.",
      "Menjaga kesesuaian proses bisnis.",
      "Mengawal logika jurnal, laporan, dan audit trail.",
      "Memberikan masukan terhadap standar tata kelola BUMDes.",
    ],
    icon: ClipboardList,
  },
  {
    title: "Tim Pendampingan dan Implementasi",
    description:
      "Membantu pengguna memahami, menerapkan, dan menjalankan platform di lingkungan BUMDes.",
    responsibilities: [
      "Membantu proses onboarding pengguna.",
      "Memberikan panduan penggunaan sistem.",
      "Mendampingi migrasi atau input data awal.",
      "Menampung masukan dari pengguna lapangan.",
    ],
    icon: Handshake,
  },
  {
    title: "Tim Monitoring dan Evaluasi",
    description:
      "Memantau pemanfaatan platform, mengevaluasi kebutuhan pengguna, dan memberi rekomendasi peningkatan.",
    responsibilities: [
      "Memantau penggunaan fitur.",
      "Mengidentifikasi kendala operasional.",
      "Menyusun rekomendasi pengembangan.",
      "Menjaga kualitas layanan platform.",
    ],
    icon: BarChart3,
  },
];

const ecosystemRoles = [
  {
    title: "Admin Platform",
    description:
      "Mengelola sistem, tenant, konten publik, konfigurasi, dan pengawasan platform secara global.",
  },
  {
    title: "Direktur BUMDes",
    description:
      "Mengelola BUMDes, unit usaha, pengguna, modal, laporan, dan kinerja usaha.",
  },
  {
    title: "Admin Unit Usaha",
    description:
      "Mencatat transaksi operasional seperti pembelian, penjualan, persediaan, kas-bank, dan laporan unit.",
  },
  {
    title: "Pendamping Kecamatan",
    description:
      "Membantu analisis, pendampingan, dan penilaian kesiapan rencana usaha atau proposal modal.",
  },
  {
    title: "Pengawas / Pemeriksa",
    description:
      "Melakukan pemantauan, evaluasi, dan pemeriksaan berdasarkan data dan jejak transaksi.",
  },
  {
    title: "Pemerintah Daerah / Desa",
    description:
      "Mendapatkan informasi agregat sesuai kewenangan untuk mendukung pembinaan dan pengambilan keputusan.",
  },
];

const governanceSteps = [
  {
    title: "Perencanaan Sistem",
    description:
      "Kebutuhan pengguna dan proses bisnis BUMDes dianalisis sebelum fitur dikembangkan.",
  },
  {
    title: "Pengembangan Modul",
    description:
      "Modul dibangun berdasarkan prinsip tenant, unit usaha, peran pengguna, dan jejak audit.",
  },
  {
    title: "Validasi dan Pengujian",
    description:
      "Setiap alur diuji agar transaksi, laporan, dan hak akses berjalan sesuai aturan.",
  },
  {
    title: "Implementasi Pengguna",
    description:
      "BUMDes mulai menggunakan sistem dengan pendampingan dan struktur akses yang jelas.",
  },
  {
    title: "Monitoring dan Evaluasi",
    description:
      "Pemanfaatan sistem dipantau untuk peningkatan fitur dan perbaikan layanan.",
  },
];

const trustCards = [
  {
    title: "Sistem Lebih Terkendali",
    description:
      "Setiap pengguna memiliki peran dan batas akses yang jelas sehingga ruang kerja lebih tertib.",
    icon: Layers3,
  },
  {
    title: "Data Lebih Dapat Dipercaya",
    description:
      "Transaksi dan laporan dibangun dari alur yang terdokumentasi dan dapat ditelusuri.",
    icon: CheckCircle2,
  },
  {
    title: "Pengembangan Lebih Terarah",
    description:
      "Fitur dikembangkan berdasarkan kebutuhan nyata BUMDes dan tata kelola desa.",
    icon: Sparkles,
  },
];

export default async function ManajemenPage() {
  const landingContent = await getPublicLandingContent();

  const managementSection = landingContent.sections.find(
    (section) => section.section_key === "manajemen",
  );

  const managementHeroImageUrl =
    managementSection?.image_url || "/images/hero-bumdes-governance.png";

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <PublicNavbar siteSettings={landingContent.siteSettings} />

      <section className="relative isolate overflow-hidden px-4 pb-20 pt-36 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.16),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]" />

        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-700">
              {managementSection?.eyebrow ?? "Manajemen Platform"}
            </p>

            <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              {managementSection?.title ??
                "Manajemen Platform yang Terstruktur untuk Ekosistem BUMDes yang Lebih Akuntabel."}
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
              {managementSection?.subtitle ??
                "ORVIA-BUMDES dikelola dengan pendekatan organisasi modern yang menggabungkan teknologi, tata kelola, pendampingan, dan monitoring agar proses bisnis BUMDes menjadi lebih transparan, terukur, dan berkelanjutan."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#struktur-manajemen"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                Lihat Struktur Manajemen
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="#tata-kelola"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Pelajari Tata Kelola
              </Link>
            </div>
          </div>

          <section className="relative min-h-[360px] sm:min-h-[430px] lg:min-h-[560px]">
            <div className="absolute -right-10 top-2 hidden h-72 w-72 rounded-full bg-emerald-100/80 lg:block" />
            <div className="absolute -right-20 top-64 hidden h-40 w-40 rounded-full bg-orange-100/90 lg:block" />
            <div className="absolute bottom-20 right-4 hidden h-32 w-32 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] [background-size:14px_14px] opacity-35 lg:block" />

            <div className="relative h-[360px] w-full sm:h-[430px] lg:absolute lg:right-[-96px] lg:top-[-80px] lg:h-[455px] lg:w-[820px] xl:right-[-230px] xl:h-[470px] xl:w-[900px]">
              <Image
                src={managementHeroImageUrl}
                alt="Visual manajemen platform ORVIA-BUMDES"
                fill
                unoptimized
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-contain object-center"
              />
            </div>
          </section>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
              Filosofi Manajemen
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Dikelola dengan prinsip tata kelola, bukan sekadar teknologi.
            </h2>
          </div>

          <div className="space-y-6 text-base leading-8 text-slate-600">
            <p>
              ORVIA-BUMDES memandang teknologi sebagai alat bantu tata kelola.
              Karena itu, pengelolaan platform tidak hanya berfokus pada fitur
              aplikasi, tetapi juga pada kejelasan peran, keamanan sistem,
              akuntabilitas data, pendampingan pengguna, serta kesinambungan
              pengembangan.
            </p>

            <p>
              Setiap modul dirancang untuk mendukung proses kerja BUMDes dari
              perencanaan, pelaksanaan, pencatatan, pelaporan, hingga
              pengawasan. Dengan cara ini, platform tidak berhenti sebagai
              aplikasi pencatatan, tetapi menjadi ruang kerja bersama untuk
              membangun kepercayaan publik desa.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
              Prinsip Utama
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Empat fondasi untuk menjaga kualitas pengelolaan platform.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {managementPrinciples.map((principle) => {
              const Icon = principle.icon;

              return (
                <div
                  key={principle.title}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/60"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-slate-950">
                    {principle.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {principle.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="struktur-manajemen"
        className="px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
                Struktur Pengelolaan Platform
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Lapisan kerja yang menjaga platform tetap stabil, responsif,
                dan bertanggung jawab.
              </h2>
            </div>
            <p className="text-base leading-8 text-slate-600">
              Pengelolaan ORVIA-BUMDES disusun dalam beberapa fungsi agar arah
              produk, teknologi, tata kelola, pendampingan, dan evaluasi dapat
              berjalan saling menguatkan.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {managementTeams.map((team) => {
              const Icon = team.icon;

              return (
                <div
                  key={team.title}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <Icon className="h-6 w-6" />
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-slate-950">
                        {team.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {team.description}
                      </p>

                      <div className="mt-5 grid gap-2">
                        {team.responsibilities.map((item) => (
                          <div key={item} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                            <p className="text-sm font-semibold leading-6 text-slate-700">
                              {item}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                Ekosistem Peran
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                Banyak aktor, satu ekosistem kerja yang saling terhubung.
              </h2>
            </div>

            <p className="text-base leading-8 text-slate-300">
              ORVIA-BUMDES dirancang untuk mendukung banyak aktor dalam
              ekosistem BUMDes. Setiap aktor memiliki ruang kerja, kewenangan,
              dan akses informasi yang berbeda sesuai tanggung jawabnya.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {ecosystemRoles.map((role) => (
              <div
                key={role.title}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-6"
              >
                <UsersRound className="h-6 w-6 text-emerald-300" />
                <h3 className="mt-5 text-xl font-black text-white">
                  {role.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {role.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tata-kelola" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
              Alur Tata Kelola
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Alur pengelolaan yang terukur dari perencanaan sampai evaluasi.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-5">
            {governanceSteps.map((step, index) => (
              <div
                key={step.title}
                className="relative rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-sm font-black text-orange-600">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-5 text-lg font-black text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
                Mengapa Ini Penting
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Sistem digital BUMDes harus dikelola dengan struktur yang dapat
                dipercaya.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                Platform tidak cukup hanya memiliki fitur pencatatan. Ia harus
                dikelola dengan struktur yang memastikan data aman, proses dapat
                diaudit, pengguna didampingi, dan pengembangan berjalan sesuai
                kebutuhan lapangan.
              </p>
            </div>

            <div className="grid gap-5">
              {trustCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.title}
                    className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-950">
                          {card.title}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
              Tata Kelola Modern
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Siap membangun tata kelola BUMDes yang lebih modern?
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              ORVIA-BUMDES membantu BUMDes, pendamping, pengawas, dan pemangku
              kepentingan lainnya bekerja dalam satu ekosistem digital yang
              lebih tertib, transparan, dan akuntabel.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-50"
            >
              Mulai Gunakan Platform
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/aplikasi"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              Pelajari Aplikasi
            </Link>
          </div>
        </div>
      </section>

      <PublicNewsPopup newsPosts={landingContent.newsPosts} />
    </main>
  );
}


