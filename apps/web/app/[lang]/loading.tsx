export default function LanguageLoading() {
  return (
    <section className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="h-7 w-1/3 rounded bg-slate-200" />
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-44 rounded-xl bg-slate-200" />
        <div className="h-44 rounded-xl bg-slate-200" />
        <div className="h-44 rounded-xl bg-slate-200" />
      </div>
    </section>
  );
}

