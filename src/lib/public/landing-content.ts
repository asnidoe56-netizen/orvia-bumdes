import { createClient } from "@/lib/supabase/server";

export type PublicLandingSection = {
  id: string;
  section_key: string;
  section_label: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url?: string | null;
  display_order: number;
};

export type PublicLandingItem = {
  id: string;
  section_id: string;
  section_key: string;
  item_key: string | null;
  title: string;
  description: string | null;
  icon_key: string | null;
  link_label: string | null;
  link_href: string | null;
  display_order: number;
};

export type PublicNewsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  published_at: string | null;
  display_order: number;
  link_href: string | null;
  popup_enabled: boolean;
  popup_delay_seconds: number;
  popup_position: string;
};

export type PublicLandingContent = {
  sections: PublicLandingSection[];
  items: PublicLandingItem[];
  newsPosts: PublicNewsPost[];
};

const fallbackContent: PublicLandingContent = {
  sections: [
    {
      id: "fallback-aplikasi",
      section_key: "aplikasi",
      section_label: "Aplikasi",
      eyebrow: "Aplikasi",
      title: "Satu ekosistem kerja untuk banyak peran.",
      subtitle:
        "Platform ERP BUMDes yang menyatukan tenant, unit usaha, transaksi, laporan, dan pengawasan.",
      body:
        "Bagian ini nanti dapat diatur dari database Super Admin Platform: headline, deskripsi, daftar fitur, icon, urutan tampil, dan status publikasi.",
      cta_label: null,
      cta_href: null,
      display_order: 10,
    },
    {
      id: "fallback-manajemen",
      section_key: "manajemen",
      section_label: "Manajemen",
      eyebrow: "Manajemen Platform",
      title:
        "Manajemen Platform yang Terstruktur untuk Ekosistem BUMDes yang Lebih Akuntabel.",
      subtitle:
        "ORVIA-BUMDES dikelola dengan pendekatan organisasi modern yang menggabungkan teknologi, tata kelola, pendampingan, dan monitoring agar proses bisnis BUMDes menjadi lebih transparan, terukur, dan berkelanjutan.",
      body:
        "Halaman ini menjelaskan bagaimana ORVIA-BUMDES dikelola sebagai sebuah organisasi platform: mulai dari pengelola platform, tim teknologi dan sistem, tata kelola dan akuntansi, pendampingan implementasi, sampai monitoring dan evaluasi.",
      cta_label: "Lihat Struktur Manajemen",
      cta_href: "/manajemen#struktur-manajemen",
      display_order: 20,
    },
    {
      id: "fallback-tentang",
      section_key: "tentang",
      section_label: "Tentang",
      eyebrow: "Tentang ORVIA-BUMDES",
      title: "Platform tata kelola yang menjaga kepercayaan publik desa.",
      subtitle:
        "ORVIA-BUMDES dibangun untuk membantu BUMDes bekerja lebih tertib, transparan, dan akuntabel.",
      body:
        "Konten tentang platform, filosofi, tata kelola, dan visi produk dapat diperbarui dari database platform agar mudah diperbarui.",
      cta_label: "Mulai Registrasi",
      cta_href: "/register",
      display_order: 40,
    },
  ],
  items: [
    {
      id: "fallback-multi-tenant",
      section_id: "fallback-aplikasi",
      section_key: "aplikasi",
      item_key: "multi-tenant",
      title: "Multi-Tenant",
      description:
        "Satu sistem melayani banyak BUMDes dengan scope tenant dan unit yang terpisah.",
      icon_key: "users",
      link_label: null,
      link_href: null,
      display_order: 10,
    },
    {
      id: "fallback-role-dashboard",
      section_id: "fallback-aplikasi",
      section_key: "aplikasi",
      item_key: "role-dashboard",
      title: "Role-Based Dashboard",
      description:
        "Dashboard berbeda untuk Platform, BUMDes, Unit, Pengawas, Pendamping, Dinas PMD, Inspektorat, dan Bupati.",
      icon_key: "dashboard",
      link_label: null,
      link_href: null,
      display_order: 20,
    },
    {
      id: "fallback-governance-engine",
      section_id: "fallback-aplikasi",
      section_key: "aplikasi",
      item_key: "governance-engine",
      title: "Governance Engine",
      description:
        "Transaksi, jurnal, koreksi, closing, dan audit dikendalikan melalui database RPC yang aman.",
      icon_key: "shield",
      link_label: null,
      link_href: null,
      display_order: 30,
    },
  ],
  newsPosts: [
    {
      id: "fallback-news",
      slug: "ruang-publikasi-perkembangan-bumdes",
      title: "Ruang publikasi perkembangan BUMDes.",
      excerpt:
        "Artikel, pengumuman, dan informasi publik nanti dapat dimasukkan melalui database dan halaman Super Admin Platform.",
      cover_image_url: null,
      author_name: "ORVIA-BUMDES",
      published_at: null,
      display_order: 10,
      link_href: null,
      popup_enabled: false,
      popup_delay_seconds: 5,
      popup_position: "top-right",
    },
  ],
};

export async function getPublicLandingContent(): Promise<PublicLandingContent> {
  try {
    const supabase = await createClient();

    const [sectionsResult, itemsResult, newsResult] = await Promise.all([
      supabase
        .from("v_public_landing_sections")
        .select(
          "id, section_key, section_label, eyebrow, title, subtitle, body, cta_label, cta_href, image_url, display_order",
        )
        .order("display_order", { ascending: true }),

      supabase
        .from("v_public_landing_items")
        .select(
          "id, section_id, section_key, item_key, title, description, icon_key, link_label, link_href, display_order",
        )
        .order("display_order", { ascending: true }),

      supabase
        .from("v_public_news_posts")
        .select(
          "id, slug, title, excerpt, cover_image_url, author_name, published_at, display_order, link_href, popup_enabled, popup_delay_seconds, popup_position",
        )
        .order("published_at", { ascending: false, nullsFirst: false }),
    ]);

    if (sectionsResult.error || itemsResult.error || newsResult.error) {
      return fallbackContent;
    }

    const sections = sectionsResult.data ?? [];
    const items = itemsResult.data ?? [];
    const newsPosts = newsResult.data ?? [];

    return {
      sections: sections.length > 0 ? sections : fallbackContent.sections,
      items: items.length > 0 ? items : fallbackContent.items,
      newsPosts: newsPosts.length > 0 ? newsPosts : fallbackContent.newsPosts,
    };
  } catch {
    return fallbackContent;
  }
}

