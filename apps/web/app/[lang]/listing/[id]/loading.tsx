export default function ListingDetailsLoading() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="h-80 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
    </section>
  );
}
