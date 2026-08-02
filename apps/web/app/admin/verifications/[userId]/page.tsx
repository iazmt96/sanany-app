import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../../src/admin/locale";
import { getAdminVerificationDetails, updateCompanyVerificationStatus, type VerificationStatus } from "../../../../src/admin/verifications";
import { formatDateTime } from "../../../../src/admin/users";
import { AdminForbidden } from "../../../../src/components/admin/admin-forbidden";

type AdminVerificationDetailsPageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ result?: string }>;
};

function parseVerificationAction(value: FormDataEntryValue | null): VerificationStatus | null {
  if (value === "unverified" || value === "pending" || value === "verified" || value === "rejected") {
    return value;
  }
  return null;
}

async function updateVerificationStatusAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") ?? "");
  const nextStatus = parseVerificationAction(formData.get("status"));
  if (!userId || !nextStatus) {
    redirect("/admin/verifications");
  }

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "companies.verify")) {
    redirect(`/admin/verifications/${userId}`);
  }

  await updateCompanyVerificationStatus({ userId, nextStatus, actorUserId: auth.userId });
  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${userId}`);
  revalidatePath("/admin/companies");
  redirect(`/admin/verifications/${userId}?result=updated`);
}

export default async function AdminVerificationDetailsPage({ params, searchParams }: AdminVerificationDetailsPageProps) {
  const { userId } = await params;
  const search = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "companies.verify")) {
    return <AdminForbidden language={language} />;
  }

  const details = await getAdminVerificationDetails(userId);
  if (!details) {
    notFound();
  }

  return (
    <section className="space-y-4">
      {search.result === "updated" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.verifications.messages.updated}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{details.row.companyName}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {dictionary.admin.verifications.fields.userId}: {details.row.userId}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/users/${details.row.userId}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              {dictionary.admin.verifications.actions.openUser}
            </Link>
            <Link href="/admin/verifications" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              {dictionary.admin.verifications.actions.back}
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.columns.status}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{dictionary.admin.verifications.status[details.row.verificationStatus]}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.columns.representative}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.row.representativeName}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.columns.businessType}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.row.businessType ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.columns.city}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.row.city ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.columns.listings}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.row.listingsCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.columns.requestedAt}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(details.row.requestedAt, language)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.fields.commercialRegistration}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.commercialRegistrationMasked}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.fields.taxNumber}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.taxNumberMasked ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.fields.website}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{details.website ?? "—"}</p>
        </div>

        {details.companyDescription ? (
          <div className="mt-4 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.verifications.fields.companyDescription}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{details.companyDescription}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.verifications.moderation.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.verifications.moderation.subtitle}</p>
        <form action={updateVerificationStatusAction} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="userId" value={details.row.userId} />
          {details.row.verificationStatus !== "verified" ? (
            <button
              type="submit"
              name="status"
              value="verified"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {dictionary.admin.verifications.actions.markVerified}
            </button>
          ) : null}
          {details.row.verificationStatus !== "rejected" ? (
            <button
              type="submit"
              name="status"
              value="rejected"
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              {dictionary.admin.verifications.actions.markRejected}
            </button>
          ) : null}
          {details.row.verificationStatus !== "pending" ? (
            <button
              type="submit"
              name="status"
              value="pending"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              {dictionary.admin.verifications.actions.markPending}
            </button>
          ) : null}
          {details.row.verificationStatus !== "unverified" ? (
            <button
              type="submit"
              name="status"
              value="unverified"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {dictionary.admin.verifications.actions.markUnverified}
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
}
