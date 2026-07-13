import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">404</p>
      <h1 className="text-2xl font-bold text-slate-900">الصفحة غير موجودة</h1>
      <p className="text-sm text-slate-600">الرابط الذي طلبته غير متوفر حاليًا.</p>
      <h2 className="pt-2 text-xl font-semibold text-slate-900">Page not found</h2>
      <p className="text-sm text-slate-600">The page you requested is not available.</p>
      <Link href="/ar" className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
        العودة للرئيسية / Back to home
      </Link>
    </main>
  );
}

