"use client";

import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function LocalizedError({ error, reset }: ErrorPageProps) {
  return (
    <section className="rounded-xl border border-red-200 bg-white p-6 text-center">
      <p className="text-xs font-semibold text-red-700">500</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">تعذر تحميل الصفحة</h1>
      <p className="mt-1 text-sm text-slate-600">حدث خطأ غير متوقع، يمكنك إعادة المحاولة.</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={reset} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
          إعادة المحاولة
        </button>
        <Link href="/ar" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          الرئيسية
        </Link>
      </div>
      {error.digest ? <p className="mt-3 text-xs text-slate-400">Digest: {error.digest}</p> : null}
    </section>
  );
}

