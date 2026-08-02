import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ADMIN_ROLES, hasAdminPermission, resources, type AdminRole } from "@sanany/shared";
import { getAdminAuthContext } from "../../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../../src/admin/locale";
import { formatDateTime, getAdminUserDetails, updateAdminUserRole, updateAdminUserSuspension } from "../../../../src/admin/users";
import { maskPhone } from "../../../../src/admin/privacy";
import { AdminForbidden } from "../../../../src/components/admin/admin-forbidden";

type AdminUserDetailsPageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ result?: string }>;
};

function parseAdminRoleValue(value: FormDataEntryValue | null): AdminRole | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return ADMIN_ROLES.find((role) => role === value) ?? null;
}

function parseSuspensionIntent(value: FormDataEntryValue | null): boolean | null {
  if (value === "suspend") {
    return true;
  }
  if (value === "restore") {
    return false;
  }
  return null;
}

async function updateUserRoleAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") ?? "");
  if (!userId) {
    redirect("/admin/users");
  }

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || auth.role !== "super_admin" || auth.userId === userId) {
    redirect(`/admin/users/${userId}?result=forbidden`);
  }

  const nextRole = parseAdminRoleValue(formData.get("role"));
  await updateAdminUserRole({ userId, nextRole, actorUserId: auth.userId });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?result=role-updated`);
}

async function updateUserSuspensionAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") ?? "");
  const suspended = parseSuspensionIntent(formData.get("intent"));
  if (!userId || suspended === null) {
    redirect("/admin/users");
  }

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "users.suspend") || auth.userId === userId) {
    redirect(`/admin/users/${userId}?result=forbidden`);
  }

  await updateAdminUserSuspension({ userId, suspended, actorUserId: auth.userId });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?result=${suspended ? "suspended" : "restored"}`);
}

export default async function AdminUserDetailsPage({ params, searchParams }: AdminUserDetailsPageProps) {
  const { userId } = await params;
  const search = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "users.view")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminUserDetails(userId);
  if (!data) {
    notFound();
  }

  const canManageRole = auth.role === "super_admin" && auth.userId !== data.profile.id;
  const canManageSuspension = hasAdminPermission(auth.role, "users.suspend") && auth.userId !== data.profile.id;

  return (
    <section className="space-y-4">
      {search.result === "role-updated" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.userAccess.messages.roleUpdated}
        </div>
      ) : null}
      {search.result === "suspended" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {dictionary.admin.userAccess.messages.suspended}
        </div>
      ) : null}
      {search.result === "restored" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.userAccess.messages.restored}
        </div>
      ) : null}
      {search.result === "forbidden" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {dictionary.admin.userAccess.messages.forbidden}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{data.profile.displayName}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {dictionary.admin.users.columns.accountType}: {dictionary.admin.users.accountType[data.profile.accountType]}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.userDetails.account}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{dictionary.admin.userAccess.fields.email}</dt>
              <dd className="font-medium text-slate-900">{data.access.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{dictionary.admin.users.columns.username}</dt>
              <dd className="font-medium text-slate-900">{data.profile.username ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{dictionary.admin.users.columns.phone}</dt>
              <dd className="font-medium text-slate-900">{maskPhone(data.profile.phone)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{dictionary.admin.users.columns.city}</dt>
              <dd className="font-medium text-slate-900">{data.profile.city ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{dictionary.admin.users.columns.joinedAt}</dt>
              <dd className="font-medium text-slate-900">{formatDateTime(data.profile.joinedAt, language)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{dictionary.admin.userDetails.lastSeenAt}</dt>
              <dd className="font-medium text-slate-900">{data.profile.lastSeenAt ? formatDateTime(data.profile.lastSeenAt, language) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{dictionary.admin.userAccess.fields.lastSignInAt}</dt>
              <dd className="font-medium text-slate-900">{data.access.lastSignInAt ? formatDateTime(data.access.lastSignInAt, language) : "—"}</dd>
            </div>
          </dl>
          {data.bio ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{data.bio}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.userDetails.company}</h3>
          {data.company ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{dictionary.admin.companies.columns.companyName}</dt>
                <dd className="font-medium text-slate-900">{data.company.companyName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{dictionary.admin.companies.columns.representative}</dt>
                <dd className="font-medium text-slate-900">{data.company.representativeName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{dictionary.admin.companies.columns.verification}</dt>
                <dd className="font-medium text-slate-900">{data.company.verificationStatus}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{dictionary.admin.userDetails.commercialRegistration}</dt>
                <dd className="font-medium text-slate-900">{data.company.commercialRegistrationMasked}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{dictionary.admin.userDetails.taxNumber}</dt>
                <dd className="font-medium text-slate-900">{data.company.taxNumberMasked ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{dictionary.admin.dashboard.unavailable}</p>
          )}
        </div>
      </div>

      {canManageRole || canManageSuspension ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.userAccess.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{dictionary.admin.userAccess.subtitle}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.userAccess.fields.adminRole}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {data.access.adminRole ? dictionary.admin.userAccess.roles[data.access.adminRole] : dictionary.admin.userAccess.roles.none}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.userAccess.fields.accessState}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {data.access.isSuspended ? dictionary.admin.userAccess.states.suspended : dictionary.admin.userAccess.states.active}
                </p>
                {data.access.bannedUntil ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {dictionary.admin.userAccess.fields.bannedUntil}: {formatDateTime(data.access.bannedUntil, language)}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">{dictionary.admin.userAccess.notes.tokenRefresh}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.userAccess.actions.title}</h3>
            <div className="mt-4 space-y-4">
              {canManageRole ? (
                <form action={updateUserRoleAction} className="space-y-3">
                  <input type="hidden" name="userId" value={data.profile.id} />
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-700">{dictionary.admin.userAccess.fields.adminRole}</span>
                    <select
                      name="role"
                      defaultValue={data.access.adminRole ?? ""}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/30 focus:border-brand focus:ring"
                    >
                      <option value="">{dictionary.admin.userAccess.roles.none}</option>
                      {ADMIN_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {dictionary.admin.userAccess.roles[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
                    {dictionary.admin.userAccess.actions.saveRole}
                  </button>
                </form>
              ) : null}

              {canManageSuspension ? (
                <form action={updateUserSuspensionAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="userId" value={data.profile.id} />
                  {data.access.isSuspended ? (
                    <button
                      type="submit"
                      name="intent"
                      value="restore"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      {dictionary.admin.userAccess.actions.restoreAccess}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      name="intent"
                      value="suspend"
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                    >
                      {dictionary.admin.userAccess.actions.suspendAccess}
                    </button>
                  )}
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.userDetails.listings}</h3>
          {data.listings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{dictionary.admin.search.noResults}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.listings.map((listing) => (
                <li key={listing.id} className="rounded-lg border border-slate-200 p-3">
                  <Link href={`/admin/listings/${listing.id}`} className="text-sm font-medium text-brand hover:underline">
                    {listing.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {listing.status} · {formatDateTime(listing.createdAt, language)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.userDetails.ratings}</h3>
          {data.ratings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{dictionary.admin.search.noResults}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.ratings.map((rating) => (
                <li key={rating.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {dictionary.admin.search.ratingLabel}: {rating.rating}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(rating.createdAt, language)}</p>
                  {rating.comment ? <p className="mt-1 text-sm text-slate-700">{rating.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
