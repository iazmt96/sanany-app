import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { formatDateTime, getAdminUsersPageData, updateAdminUserSuspension } from "../../../src/admin/users";
import { maskPhone } from "../../../src/admin/privacy";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

type AdminUsersPageProps = {
  searchParams: Promise<{
    q?: string;
    account_type?: string;
    verified?: string;
    suspended?: string;
    city?: string;
    page?: string;
    result?: string;
  }>;
};

function parseSuspensionIntent(value: FormDataEntryValue | null): boolean | null {
  if (value === "suspend") {
    return true;
  }
  if (value === "restore") {
    return false;
  }
  return null;
}

async function updateUserSuspensionAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") ?? "");
  const suspended = parseSuspensionIntent(formData.get("intent"));
  if (!userId || suspended === null) {
    redirect("/admin/users?result=failed");
  }

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "users.suspend") || auth.userId === userId) {
    redirect("/admin/users?result=forbidden");
  }

  try {
    await updateAdminUserSuspension({ userId, suspended, actorUserId: auth.userId });
  } catch {
    redirect("/admin/users?result=failed");
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users?result=${suspended ? "suspended" : "restored"}`);
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "users.view")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminUsersPageData({
    q: params.q ?? null,
    accountType: params.account_type ?? null,
    verified: params.verified ?? null,
    suspended: params.suspended ?? null,
    city: params.city ?? null,
    page: params.page ?? null
  });

  const pageBaseParams = new URLSearchParams();
  if (params.q) pageBaseParams.set("q", params.q);
  if (params.account_type) pageBaseParams.set("account_type", params.account_type);
  if (params.verified) pageBaseParams.set("verified", params.verified);
  if (params.suspended) pageBaseParams.set("suspended", params.suspended);
  if (params.city) pageBaseParams.set("city", params.city);
  const canSuspend = hasAdminPermission(auth.role, "users.suspend");

  return (
    <section className="space-y-4">
      {params.result === "suspended" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {dictionary.admin.users.messages.suspended}
        </div>
      ) : null}
      {params.result === "restored" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.users.messages.restored}
        </div>
      ) : null}
      {params.result === "failed" || params.result === "forbidden" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {dictionary.admin.users.messages.suspensionFailed}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.users.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.users.subtitle}</p>

        <form className="mt-4 grid gap-2 md:grid-cols-5" action="/admin/users">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={dictionary.admin.users.filters.search}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          />
          <select
            name="account_type"
            defaultValue={params.account_type ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.users.filters.anyAccountType}</option>
            <option value="individual">{dictionary.admin.users.accountType.individual}</option>
            <option value="company">{dictionary.admin.users.accountType.company}</option>
          </select>
          <select
            name="verified"
            defaultValue={params.verified ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.users.filters.anyVerification}</option>
            <option value="yes">{dictionary.admin.users.verification.verified}</option>
            <option value="no">{dictionary.admin.users.verification.unverified}</option>
          </select>
          <select
            name="suspended"
            defaultValue={params.suspended ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.users.filters.anyAccessState}</option>
            <option value="no">{dictionary.admin.users.access.active}</option>
            <option value="yes">{dictionary.admin.users.access.suspended}</option>
          </select>
          <div className="flex gap-2">
            <input
              name="city"
              defaultValue={params.city ?? ""}
              placeholder={dictionary.admin.users.filters.city}
              className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
            />
            <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
              {dictionary.admin.search.submit}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.name}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.username}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.phone}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.accountType}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.city}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.listings}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.verification}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.accessState}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.joinedAt}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.users.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.displayName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.username ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{maskPhone(row.phone)}</td>
                  <td className="px-3 py-2 text-slate-700">{dictionary.admin.users.accountType[row.accountType]}</td>
                  <td className="px-3 py-2 text-slate-700">{row.city ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{row.listingsCount}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.isVerified ? dictionary.admin.users.verification.verified : dictionary.admin.users.verification.unverified}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.isSuspended ? dictionary.admin.users.access.suspended : dictionary.admin.users.access.active}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(row.joinedAt, language)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/users/${row.id}`} className="text-xs font-semibold text-brand hover:underline">
                        {dictionary.admin.users.actions.view}
                      </Link>
                      {canSuspend && auth.userId !== row.id ? (
                        <form action={updateUserSuspensionAction}>
                          <input type="hidden" name="userId" value={row.id} />
                          <button
                            type="submit"
                            name="intent"
                            value={row.isSuspended ? "restore" : "suspend"}
                            className={`text-xs font-semibold ${row.isSuspended ? "text-emerald-600 hover:underline" : "text-rose-600 hover:underline"}`}
                          >
                            {row.isSuspended ? dictionary.admin.users.actions.restore : dictionary.admin.users.actions.suspend}
                          </button>
                        </form>
                      ) : null}
                    </div>
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
              return `/admin/users?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.previous}
          </Link>
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.min(data.totalPages, data.page + 1)));
              return `/admin/users?${next.toString()}`;
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
