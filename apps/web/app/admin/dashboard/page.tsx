import Link from "next/link";
import { resources } from "@sanany/shared";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { getAdminDashboardData } from "../../../src/admin/dashboard";

type AdminDashboardPageProps = {
  searchParams: Promise<{ range?: string; from?: string }>;
};

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const data = await getAdminDashboardData({
    language,
    rangeParam: params.range ?? null,
    customFrom: params.from ?? null
  });
  const maxSeries = Math.max(1, ...data.chartPoints.map((point) => Math.max(point.users, point.listings)));
  const ranges = [
    { key: "today", label: dictionary.admin.range.today },
    { key: "7d", label: dictionary.admin.range.days7 },
    { key: "30d", label: dictionary.admin.range.days30 },
    { key: "3m", label: dictionary.admin.range.months3 },
    { key: "1y", label: dictionary.admin.range.year1 }
  ] as const;
  const activityLabelByType = {
    user_signup: dictionary.admin.activities.types.user_signup,
    listing_created: dictionary.admin.activities.types.listing_created,
    listing_status: dictionary.admin.activities.types.listing_status
  } as const;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.dashboard.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.dashboard.subtitle}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ranges.map((item) => (
            <Link
              key={item.key}
              href={`/admin/dashboard?range=${item.key}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                data.range === item.key ? "bg-brand text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.cards.map((card) => (
          <Link key={card.key} href={card.href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dictionary.admin.dashboard.cards[card.key]}
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {card.value === null ? dictionary.admin.dashboard.unavailable : card.value.toLocaleString(language)}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">{dictionary.admin.charts.usersAndListings}</h3>
          {data.chartPoints.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{dictionary.admin.dashboard.unavailable}</p>
          ) : (
            <div className="mt-4 space-y-2">
              {data.chartPoints.slice(-14).map((point) => (
                <div key={point.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{point.label}</span>
                    <span>
                      {dictionary.admin.charts.usersShort}: {point.users} · {dictionary.admin.charts.listingsShort}: {point.listings}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr] gap-1">
                    <div className="h-2 rounded bg-brand/20">
                      <div className="h-2 rounded bg-brand" style={{ width: `${Math.max(2, (point.users / maxSeries) * 100)}%` }} />
                    </div>
                    <div className="h-2 rounded bg-emerald-200">
                      <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.max(2, (point.listings / maxSeries) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">{dictionary.admin.activities.title}</h3>
          {data.recentActivities.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{dictionary.admin.dashboard.unavailable}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentActivities.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-500">{activityLabelByType[item.type]}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{item.title}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(item.at).toLocaleString(language === "ar" ? "ar-SA" : "en-US")}</span>
                    <Link href={item.href} className="font-semibold text-brand hover:underline">
                      {dictionary.admin.activities.view}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
