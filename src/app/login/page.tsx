import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            ERP BUMDes
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Masuk ke Sistem
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Gunakan akun sesuai role dan unit kerja.
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
