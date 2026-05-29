import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { updatePublicContentItem } from "../../../actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PublicContentItem = {
  id: string;
  section_id: string;
  item_key: string | null;
  title: string;
  description: string | null;
  icon_key: string | null;
  link_label: string | null;
  link_href: string | null;
  display_order: number;
  is_published: boolean;
};

type PublicContentSection = {
  id: string;
  section_key: string;
  section_label: string;
};

const iconOptions = [
  { value: "", label: "Default" },
  { value: "dashboard", label: "Dashboard" },
  { value: "users", label: "Pengguna / Multi Peran" },
  { value: "shield", label: "Tata Kelola / Keamanan" },
  { value: "report", label: "Laporan / Analitik" },
  { value: "governance", label: "Governance / Proses" },
  { value: "tenant", label: "BUMDes / Tenant" },
  { value: "security", label: "Akses Aman" },
];

export default async function EditPublicContentItemPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: itemData, error: itemError } = await supabase
    .from("public_content_items")
    .select(
      "id, section_id, item_key, title, description, icon_key, link_label, link_href, display_order, is_published"
    )
    .eq("id", id)
    .single();

  if (itemError || !itemData) {
    notFound();
  }

  const item = itemData as PublicContentItem;

  const { data: sectionData } = await supabase
    .from("public_content_sections")
    .select("id, section_key, section_label")
    .eq("id", item.section_id)
    .maybeSingle();

  const section = sectionData as PublicContentSection | null;
  const isApplicationItem = section?.section_key === "aplikasi";

  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / Konten Publik / Edit Aplikasi"
        title={
          isApplicationItem
            ? `Edit Aplikasi: ${item.title}`
            : `Edit Item Konten: ${item.title}`
        }
        description="Atur nama aplikasi, deskripsi, ikon, tombol, dan link domain yang tampil di halaman publik."
      />

      <Card>
        <CardHeader
          title={isApplicationItem ? "Form Aplikasi Publik" : "Form Item Konten Publik"}
          description={`Section: ${section?.section_label ?? "Tidak diketahui"}`}
          action={
            item.is_published ? (
              <Badge variant="success">Published</Badge>
            ) : (
              <Badge variant="warning">Draft</Badge>
            )
          }
        />

        <form action={updatePublicContentItem} className="space-y-5 px-5 pb-5">
          <input type="hidden" name="id" value={item.id} />

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Nama Aplikasi
              </label>
              <input
                name="title"
                defaultValue={item.title}
                placeholder="Contoh: Kasir"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Kode Internal
              </label>
              <input
                name="item_key"
                defaultValue={item.item_key ?? ""}
                placeholder="Contoh: kasir"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Deskripsi Singkat
            </label>
            <textarea
              name="description"
              defaultValue={item.description ?? ""}
              rows={4}
              placeholder="Contoh: Aplikasi kasir untuk mencatat transaksi penjualan unit usaha BUMDes secara cepat dan rapi."
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Icon Tampilan
              </label>
              <select
                name="icon_key"
                defaultValue={item.icon_key ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {iconOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Urutan Tampil
              </label>
              <input
                name="display_order"
                type="number"
                defaultValue={item.display_order}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Label Tombol
              </label>
              <input
                name="link_label"
                defaultValue={item.link_label ?? ""}
                placeholder="Contoh: Buka Kasir"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Link Domain / URL Aplikasi
              </label>
              <input
                name="link_href"
                defaultValue={item.link_href ?? ""}
                placeholder="Contoh: https://kasir.domainanda.id"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              name="is_published"
              type="checkbox"
              defaultChecked={item.is_published}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Tampilkan aplikasi ini di halaman publik
          </label>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            Super Admin cukup mengisi nama aplikasi dan link domain. Jika link
            belum diisi, halaman publik akan menampilkan status bahwa link belum
            diatur.
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <Link
              href="/platform/dashboard/public-content"
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </Link>

            <button
              type="submit"
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              Simpan Aplikasi
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
