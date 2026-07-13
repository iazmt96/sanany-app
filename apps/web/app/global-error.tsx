"use client";

import Link from "next/link";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">500</p>
          <h1 className="text-2xl font-bold text-slate-900">حدث خطأ غير متوقع</h1>
          <p className="text-sm text-slate-600">حاول تحديث الصفحة أو الرجوع للرئيسية.</p>
          <h2 className="pt-2 text-xl font-semibold text-slate-900">Unexpected error occurred</h2>
          <p className="text-sm text-slate-600">Try refreshing the page or go back home.</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={reset} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
              إعادة المحاولة / Retry
            </button>
            <Link href="/ar" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              الرئيسية / Home
            </Link>
          </div>
          {error.digest ? <p className="pt-2 text-xs text-slate-400">Digest: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}

