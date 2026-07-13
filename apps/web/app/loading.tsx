export default function RootLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-3 py-6 sm:px-4 lg:px-6">
      <div className="animate-pulse space-y-4">
        <div className="h-12 w-full rounded-xl bg-slate-200" />
        <div className="h-8 w-2/3 rounded-lg bg-slate-200" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="h-48 rounded-xl bg-slate-200" />
          <div className="h-48 rounded-xl bg-slate-200" />
          <div className="h-48 rounded-xl bg-slate-200" />
        </div>
      </div>
    </main>
  );
}

