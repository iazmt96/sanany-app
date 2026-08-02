import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../../src/admin/locale";
import { getAdminReportDetails, updateAdminReportStatus } from "../../../../src/admin/reports";
import { formatDateTime } from "../../../../src/admin/users";
import { AdminForbidden } from "../../../../src/components/admin/admin-forbidden";

type AdminReportDetailsPageProps = {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ result?: string }>;
};

type ReportAction = "reviewed" | "closed" | "reopened";

function parseReportAction(value: FormDataEntryValue | null): ReportAction | null {
  if (value === "reviewed" || value === "closed" || value === "reopened") {
    return value;
  }
  return null;
}

async function updateReportStatusAction(formData: FormData) {
  "use server";

  const reportId = String(formData.get("reportId") ?? "");
  const action = parseReportAction(formData.get("action"));
  if (!reportId || !action) {
    redirect("/admin/reports");
  }

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "reports.manage")) {
    redirect(`/admin/reports/${reportId}`);
  }

  await updateAdminReportStatus({
    reportId,
    nextStatus: action === "reopened" ? "open" : action,
    actorUserId: auth.userId
  });

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${reportId}`);
  redirect(`/admin/reports/${reportId}?result=${action}`);
}

export default async function AdminReportDetailsPage({ params, searchParams }: AdminReportDetailsPageProps) {
  const { reportId } = await params;
  const search = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "reports.manage")) {
    return <AdminForbidden language={language} />;
  }

  const details = await getAdminReportDetails(reportId);
  if (!details) {
    notFound();
  }

  const row = details.row;

  return (
    <section className="space-y-4">
      {search.result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.reports.messages.updated}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.reports.detailsTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {dictionary.admin.reports.fields.reportId}: {row.id}
            </p>
          </div>
          <Link href="/admin/reports" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            {dictionary.admin.reports.actions.back}
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reports.columns.type}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{row.reportType}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reports.columns.status}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{dictionary.admin.reports.status[row.status as keyof typeof dictionary.admin.reports.status] ?? row.status}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reports.columns.createdAt}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(row.createdAt, language)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reports.columns.reporter}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{row.reporterDisplayName ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reports.columns.targetUser}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{row.reportedUserDisplayName ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reports.columns.targetListing}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{row.reportedListingTitle ?? "—"}</p>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reports.columns.reason}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{row.reason ?? "—"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.reports.moderation.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.reports.moderation.subtitle}</p>
        <form action={updateReportStatusAction} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="reportId" value={row.id} />
          {row.status !== "reviewed" ? (
            <button
              type="submit"
              name="action"
              value="reviewed"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              {dictionary.admin.reports.actions.markReviewed}
            </button>
          ) : null}
          {row.status !== "closed" ? (
            <button
              type="submit"
              name="action"
              value="closed"
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              {dictionary.admin.reports.actions.close}
            </button>
          ) : null}
          {row.status !== "open" ? (
            <button
              type="submit"
              name="action"
              value="reopened"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {dictionary.admin.reports.actions.reopen}
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
}
