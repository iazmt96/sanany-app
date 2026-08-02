import Link from "next/link";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { getAdminAuditLogsPageData } from "../../../src/admin/audit-logs";
import { formatDateTime } from "../../../src/admin/users";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

type AdminAuditLogsPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    page?: string;
  }>;
};

export default async function AdminAuditLogsPage({ searchParams }: AdminAuditLogsPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "audit_logs.view")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminAuditLogsPageData({
    q: params.q ?? null,
    type: params.type ?? null,
    page: params.page ?? null
  });

  const pageBaseParams = new URLSearchParams();
  if (params.q) pageBaseParams.set("q", params.q);
  if (params.type) pageBaseParams.set("type", params.type);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.auditLogs.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.auditLogs.subtitle}</p>

        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_auto]" action="/admin/audit-logs">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={dictionary.admin.auditLogs.filters.search}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          />
          <select
            name="type"
            defaultValue={params.type ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.auditLogs.filters.anyType}</option>
            <option value="listing_status">{dictionary.admin.auditLogs.types.listing_status}</option>
            <option value="report_created">{dictionary.admin.auditLogs.types.report_created}</option>
            <option value="rating_created">{dictionary.admin.auditLogs.types.rating_created}</option>
            <option value="admin_announcement_sent">{dictionary.admin.auditLogs.types.admin_announcement_sent}</option>
            <option value="report_status_updated">{dictionary.admin.auditLogs.types.report_status_updated}</option>
            <option value="verification_status_updated">{dictionary.admin.auditLogs.types.verification_status_updated}</option>
            <option value="user_role_updated">{dictionary.admin.auditLogs.types.user_role_updated}</option>
            <option value="user_access_updated">{dictionary.admin.auditLogs.types.user_access_updated}</option>
            <option value="review_deleted">{dictionary.admin.auditLogs.types.review_deleted}</option>
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.search.submit}
          </button>
        </form>

        {data.errorCode ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {dictionary.admin.auditLogs.dataSourceUnavailable}: {data.errorCode}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">{dictionary.admin.auditLogs.columns.type}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.auditLogs.columns.title}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.auditLogs.columns.actor}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.auditLogs.columns.target}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.auditLogs.columns.createdAt}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.auditLogs.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{dictionary.admin.auditLogs.types[row.type]}</td>
                  <td className="px-3 py-2 text-slate-700">{row.title}</td>
                  <td className="px-3 py-2 text-slate-700">{row.actorName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.targetLabel}</td>
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(row.createdAt, language)}</td>
                  <td className="px-3 py-2">
                    <Link href={row.href} className="text-xs font-semibold text-brand hover:underline">
                      {dictionary.admin.auditLogs.actions.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.rows.length === 0 ? <p className="p-4 text-sm text-slate-500">{dictionary.admin.search.noResults}</p> : null}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <span>
          {dictionary.common.page
            .replace("{{current}}", String(data.page))
            .replace("{{total}}", String(data.totalPages))}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.max(1, data.page - 1)));
              return `/admin/audit-logs?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.previous}
          </Link>
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.min(data.totalPages, data.page + 1)));
              return `/admin/audit-logs?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page >= data.totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.next}
          </Link>
        </div>
      </div>
    </section>
  );
}
