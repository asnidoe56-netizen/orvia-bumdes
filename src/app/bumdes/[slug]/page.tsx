import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,

  Clock3,
  Download,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";
import { PublicBumdesMobileMenu } from "./public-bumdes-mobile-menu";

export const dynamic = "force-dynamic";

type PublicBumdesProfile = {
  public_slug: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  tagline: string | null;
  profile_description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  about_history: string | null;
  vision: string | null;
  mission: string | null;
  service_goals: string | null;
  nama_bumdes: string;
  kode_bumdes: string;
  nama_desa: string;
  nama_kecamatan: string;
};

type PublicBumdesSlugStatus = {
  public_slug: string;
  is_published: boolean;
  nama_bumdes: string;
  kode_bumdes: string;
  nama_desa: string;
  nama_kecamatan: string;
};

type PublicOrgMember = {
  id: string;
  name: string;
  position: string;
  role_group: string;
};

type PublicUnit = {
  unit_id: string;
  kode_unit: string;
  nama_unit: string;
  jenis_unit: string;
  public_description: string | null;
};

type PublicPpid = {
  officer_name: string | null;
  officer_position: string | null;
  service_phone: string | null;
  service_email: string | null;
  service_address: string | null;
  service_hours: string | null;
  request_procedure: string | null;
  objection_procedure: string | null;
};

type PublicDocument = {
  id: string;
  title: string;
  file_url: string;
};

function roleLabel(roleGroup: string) {
  const labels: Record<string, string> = {
    penasihat: "Penasihat",
    pelaksana_operasional: "Pelaksana Operasional",
    pengawas: "Pengawas",
    manager_unit: "Manager Unit",
    pengurus: "Pengurus",
    lainnya: "Lainnya",
  };

  return labels[roleGroup] ?? roleGroup;
}

function SectionTitle({
  eyebrow,
  accent,
  title,
  description,
  dark = false,
}: {
  eyebrow?: string;
  accent: string;
  title: string;
  description?: string;
  dark?: boolean;
}) {
  return (
    <div className={styles.sectionHead}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2 style={dark ? { color: "white" } : undefined}>
        <span className={styles.accent}>{accent}</span> {title}
      </h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function PublicBumdesNavbar() {
  const navItems = [
    { label: "Beranda", href: "#beranda" },
    { label: "Profil", href: "#profil" },
    { label: "Tentang", href: "#tentang" },
    { label: "Unit Aktif", href: "#unit" },
    { label: "PPID", href: "#ppid" },
  ];

  return (
    <header className={styles.navShell}>
      <div className={styles.navbar}>
        <Link href="#beranda" className={styles.brand}>
          <span className={styles.brandIcon}>
            <Landmark size={22} />
          </span>
          <span>
            <span className={styles.brandTitle}>BUMDes</span>
            <span className={styles.brandSub}>Informasi Publik</span>
          </span>
        </Link>

        <nav className={styles.navLinks}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.navActions}>
          <Link href="/login" className={styles.loginButton}>
            Login
          </Link>
          <Link href="/register" className={styles.signupButton}>
            Signup
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <PublicBumdesMobileMenu navItems={navItems} />
    </header>
  );
}

function InactivePublicServicePage({
  status,
}: {
  status: PublicBumdesSlugStatus;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-16">
        <div className="w-full rounded-[2rem] border border-cyan-100 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,118,110,0.12)] backdrop-blur md:p-12">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white">
              <Landmark className="h-6 w-6" />
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
              <ShieldCheck className="h-4 w-4" />
              Layanan Publik Add-on
            </span>
          </div>

          <h1 className="max-w-3xl text-3xl font-black leading-tight text-slate-950 md:text-5xl">
            Halaman publik BUMDes belum aktif.
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
            Tautan ini sudah terdaftar di ORVIA-BUMDES, tetapi fitur halaman
            publik untuk BUMDes ini belum diaktifkan. Layanan publik ini
            merupakan add-on terpisah yang dapat digunakan setelah mendapat
            aktivasi dari Super Admin Platform.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                BUMDes
              </p>
              <p className="mt-2 font-black text-slate-950">
                {status.nama_bumdes}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Wilayah
              </p>
              <p className="mt-2 font-black text-slate-950">
                {status.nama_desa}, {status.nama_kecamatan}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                Status Layanan
              </p>
              <p className="mt-2 font-black text-amber-800">
                Belum Aktif
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-cyan-100 bg-cyan-50 p-5 text-sm leading-7 text-cyan-900">
            Untuk menggunakan layanan profil publik ini, silakan hubungi Super
            Admin Platform ORVIA-BUMDES agar fitur publikasi BUMDes dapat
            diaktifkan.
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Kembali ke Beranda
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Login BUMDes
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function PublicBumdesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("v_public_bumdes_profiles")
    .select("*")
    .eq("public_slug", slug)
    .maybeSingle<PublicBumdesProfile>();

  if (!profile) {
    const { data: slugStatus } = await supabase
      .from("v_public_bumdes_slug_status")
      .select("*")
      .eq("public_slug", slug)
      .maybeSingle<PublicBumdesSlugStatus>();

    if (!slugStatus) notFound();

    return <InactivePublicServicePage status={slugStatus} />;
  }

  const [
    { data: members },
    { data: units },
    { data: ppid },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("v_public_bumdes_organizational_members")
      .select("*")
      .eq("public_slug", slug)
      .order("display_order", { ascending: true })
      .returns<PublicOrgMember[]>(),
    supabase
      .from("v_public_bumdes_units")
      .select("*")
      .eq("public_slug", slug)
      .order("display_order", { ascending: true })
      .returns<PublicUnit[]>(),
    supabase
      .from("v_public_bumdes_ppid")
      .select("*")
      .eq("public_slug", slug)
      .maybeSingle<PublicPpid>(),
    supabase
      .from("v_public_bumdes_documents")
      .select("*")
      .eq("public_slug", slug)
      .order("display_order", { ascending: true })
      .returns<PublicDocument[]>(),
  ]);

  const title = profile.hero_title ?? profile.nama_bumdes;
  const subtitle =
    profile.hero_subtitle ??
    `Desa ${profile.nama_desa}, Kecamatan ${profile.nama_kecamatan}`;
  const unitCount = units?.length ?? 0;
  const memberCount = members?.length ?? 0;
  const documentCount = documents?.length ?? 0;

  return (
    <main className={styles.page}>
      <PublicBumdesNavbar />

      <section id="beranda" className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.eyebrow}>Profil Publik BUMDes</p>
            <h1 className={styles.heroTitle}>{title}</h1>
            <p className={styles.heroSubtitle}>{subtitle}</p>
            <p className={styles.heroText}>
              {profile.tagline ??
                profile.profile_description ??
                "Halaman informasi resmi BUMDes untuk profil kelembagaan, unit usaha, dan layanan informasi publik."}
            </p>

            <div className={styles.heroActions}>
              <a href="#profil" className={styles.primaryButton}>
                Lihat Profil <ArrowRight size={16} />
              </a>
              <a href="#ppid" className={styles.secondaryButton}>
                PPID <ShieldCheck size={16} />
              </a>
            </div>
          </div>

          <div className={styles.heroCard}>
            <div className={styles.heroCardInner}>
              <div className={styles.heroMark}>
                <Landmark size={48} />
              </div>
              <p className={styles.heroCardName}>{profile.nama_bumdes}</p>
              <p className={styles.heroCode}>{profile.kode_bumdes}</p>

              <div className={styles.heroInfo}>
                <p>
                  <MapPin size={16} /> Desa {profile.nama_desa}, Kecamatan{" "}
                  {profile.nama_kecamatan}
                </p>
                <p>
                  <Phone size={16} /> {profile.contact_phone ?? "-"}
                </p>
                <p>
                  <Mail size={16} /> {profile.contact_email ?? "-"}
                </p>
              </div>
            </div>
            <div className={styles.badge}>Publik</div>
          </div>
        </div>
      </section>

      <section className={styles.softSection}>
        <div className={styles.container}>
          <SectionTitle
            accent="Ringkasan"
            title="BUMDes"
            description="Informasi ringkas yang aman untuk publik, tanpa membuka data transaksi dan laporan internal."
          />

          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{unitCount}</div>
              <div className={styles.statLabel}>Unit usaha dipublikasikan</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{memberCount}</div>
              <div className={styles.statLabel}>Pengurus dipublikasikan</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{documentCount}</div>
              <div className={styles.statLabel}>Dokumen publik tersedia</div>
            </div>
          </div>
        </div>
      </section>

      <section id="profil" className={styles.section}>
        <div className={styles.container}>
          <SectionTitle
            eyebrow="Profil BUMDes"
            accent="Identitas"
            title="dan Struktur"
            description="Informasi dasar BUMDes, kontak publik, dan struktur pengurus yang dipublikasikan."
          />

          <div className={styles.infoGrid}>
            {[
              { icon: Building2, label: "BUMDes", value: profile.nama_bumdes },
              {
                icon: MapPin,
                label: "Wilayah",
                value: `Desa ${profile.nama_desa}, Kecamatan ${profile.nama_kecamatan}`,
              },
              { icon: Phone, label: "Telepon", value: profile.contact_phone ?? "-" },
              { icon: Mail, label: "Email", value: profile.contact_email ?? "-" },
            ].map((item) => (
              <div key={item.label} className={styles.infoCard}>
                <item.icon className={styles.infoIcon} size={28} />
                <div className={styles.infoLabel}>{item.label}</div>
                <div className={styles.infoValue}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className={styles.textPanel}>
            <h3>Deskripsi Singkat</h3>
            <p>
              {profile.profile_description ??
                "Deskripsi profil BUMDes belum dipublikasikan."}
            </p>
            <p>
              <strong>Alamat:</strong> {profile.contact_address ?? "-"}
            </p>
          </div>

          <div className={styles.section} style={{ paddingLeft: 0, paddingRight: 0 }}>
            <SectionTitle accent="Struktur" title="Pengurus" />
            {members && members.length > 0 ? (
              <div className={styles.memberGrid}>
                {members.map((member) => (
                  <div key={member.id} className={styles.memberCard}>
                    <div className={styles.memberVisual}>
                      <UsersRound size={78} />
                    </div>
                    <h3>{member.name}</h3>
                    <p>{member.position}</p>
                    <span className={styles.rolePill}>
                      {roleLabel(member.role_group)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>Struktur pengurus belum dipublikasikan.</div>
            )}
          </div>
        </div>
      </section>

      <section id="tentang" className={styles.section}>
        <div className={styles.container}>
          <SectionTitle
            accent="Tentang"
            title="BUMDes"
            description="Sejarah singkat, visi, misi, dan tujuan layanan yang dipublikasikan."
          />

          <div className={styles.aboutGrid}>
            <div className={styles.timeline}>
              <div className={styles.timelineItem}>
                <span className={styles.timelineDot} />
                <div className={styles.timelineTitle}>Profil</div>
                <div className={styles.timelineText}>
                  {profile.about_history ??
                    "Sejarah singkat BUMDes belum dipublikasikan."}
                </div>
              </div>
              <div className={styles.timelineItem}>
                <span className={styles.timelineDot} />
                <div className={styles.timelineTitle}>Layanan</div>
                <div className={styles.timelineText}>
                  {profile.service_goals ??
                    "Tujuan layanan belum dipublikasikan."}
                </div>
              </div>
            </div>

            <div className={styles.valueGrid}>
              <div className={styles.valueCard}>
                <Target color="#0284c7" size={36} />
                <h3>Visi</h3>
                <p>{profile.vision ?? "Visi belum dipublikasikan."}</p>
              </div>
              <div className={styles.valueCard}>
                <ShieldCheck color="#0284c7" size={36} />
                <h3>Misi</h3>
                <p>{profile.mission ?? "Misi belum dipublikasikan."}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="unit" className={styles.cyanSection}>
        <div className={styles.container}>
          <SectionTitle
            accent="Unit"
            title="Aktif"
            description="Daftar unit usaha aktif BUMDes yang tersedia untuk informasi publik."
          />

          {units && units.length > 0 ? (
            <div className={styles.unitGrid}>
              {units.map((unit) => (
                <div key={unit.unit_id} className={styles.unitCard}>
                  <div className={styles.unitVisual}>
                    <Building2 size={78} />
                  </div>
                  <h3>{unit.nama_unit}</h3>
                  <span className={styles.unitPill}>
                    {unit.kode_unit} Ã‚Â· {unit.jenis_unit}
                  </span>
                  <p>
                    {unit.public_description ??
                      "Deskripsi unit usaha belum dipublikasikan."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>Belum ada unit aktif yang dipublikasikan.</div>
          )}
        </div>
      </section>

      <section id="ppid" className={styles.darkSection}>
        <div className={styles.darkInner}>
          <SectionTitle
            dark
            eyebrow="PPID"
            accent="Keterbukaan"
            title="Informasi Publik"
            description="Kanal layanan informasi publik BUMDes untuk mendukung transparansi dan akuntabilitas."
          />

          <div className={styles.ppidGrid}>
            <div className={styles.darkCard}>
              <h3>Layanan Informasi</h3>
              <div className={styles.darkList}>
                <p>
                  <UsersRound size={18} />{" "}
                  {ppid?.officer_name
                    ? `${ppid.officer_name} - ${ppid.officer_position ?? "PPID"}`
                    : "Penanggung jawab informasi belum dipublikasikan."}
                </p>
                <p>
                  <Phone size={18} /> {ppid?.service_phone ?? profile.contact_phone ?? "-"}
                </p>
                <p>
                  <Mail size={18} /> {ppid?.service_email ?? profile.contact_email ?? "-"}
                </p>
                <p>
                  <MapPin size={18} />{" "}
                  {ppid?.service_address ?? profile.contact_address ?? "-"}
                </p>
                <p>
                  <Clock3 size={18} />{" "}
                  {ppid?.service_hours ?? "Jam layanan belum dipublikasikan."}
                </p>
              </div>
            </div>

            <div className={styles.darkCard}>
              <h3>Prosedur Informasi</h3>
              <div className={styles.procedureGrid}>
                <div className={styles.procedureBox}>
                  <h4>Permohonan Informasi</h4>
                  <p>
                    {ppid?.request_procedure ??
                      "Prosedur permohonan informasi belum dipublikasikan."}
                  </p>
                </div>
                <div className={styles.procedureBox}>
                  <h4>Keberatan Informasi</h4>
                  <p>
                    {ppid?.objection_procedure ??
                      "Prosedur keberatan informasi belum dipublikasikan."}
                  </p>
                </div>
              </div>

              {documents && documents.length > 0 ? (
                <div className={styles.documentList}>
                  {documents.map((document) => (
                    <Link
                      key={document.id}
                      href={document.file_url}
                      className={styles.documentLink}
                    >
                      <span>
                        <FileText size={16} /> {document.title}
                      </span>
                      <Download size={16} />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <footer className={styles.footer}>
            <div className={styles.footerGrid}>
              <div className={styles.footerLogo}>
                <Landmark color="#7dd3fc" size={44} />
                <div>
                  <div className={styles.footerName}>{profile.nama_bumdes}</div>
                  <div className={styles.footerText}>Profil Publik BUMDes</div>
                </div>
              </div>

              <div className={styles.footerText}>
                <div className={styles.footerTitle}>Kontak Publik</div>
                <p>{profile.contact_address ?? "-"}</p>
                <p>{profile.contact_phone ?? "-"}</p>
                <p>{profile.contact_email ?? "-"}</p>
              </div>

              <div>
                <div className={styles.footerTitle}>Navigasi</div>
                <div className={styles.footerNav}>
                  <a href="#beranda">Beranda</a>
                  <a href="#profil">Profil</a>
                  <a href="#tentang">Tentang</a>
                  <a href="#unit">Unit Aktif</a>
                  <a href="#ppid">PPID</a>
                </div>
              </div>
            </div>

            <p className={styles.disclaimer}>
              Informasi pada halaman ini bersifat publik dan tidak menampilkan
              data transaksi, jurnal, kas-bank, pelanggan, supplier, atau data
              personal internal.
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}