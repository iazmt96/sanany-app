import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { getAdminNotificationsPageData, isNotificationAudience, sendAdminNotification } from "../../../src/admin/notifications";
import { formatDateTime } from "../../../src/admin/users";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

type AdminNotificationsPageProps = {
  searchParams: Promise<{
    q?: string;
    kind?: string;
    unread?: string;
    page?: string;
    result?: string;
  }>;
};

async function sendAdminAnnouncementAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "notifications.send")) {
    redirect("/admin/notifications?result=forbidden");
  }

  const audienceValue = formData.get("audience");
  if (!isNotificationAudience(audienceValue)) {
    redirect("/admin/notifications?result=invalid-audience");
  }

  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  if (audienceValue === "user" && targetUserId.length === 0) {
    redirect("/admin/notifications?result=missing-target-user");
  }

  try {
    await sendAdminNotification({
      actorUserId: auth.userId,
      audience: audienceValue,
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      targetUserId: targetUserId || null
    });
  } catch {
    redirect("/admin/notifications?result=send-failed");
  }

  revalidatePath("/admin/notifications");
  redirect("/admin/notifications?result=sent");
}

export default async function AdminNotificationsPage({ searchParams }: AdminNotificationsPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "notifications.send")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminNotificationsPageData({
    q: params.q ?? null,
    kind: params.kind ?? null,
    unread: params.unread ?? null,
    page: params.page ?? null
  });

  const pageBaseParams = new URLSearchParams();
  if (params.q) pageBaseParams.set("q", params.q);
  if (params.kind) pageBaseParams.set("kind", params.kind);
  if (params.unread) pageBaseParams.set("unread", params.unread);

  return (
    <section className="space-y-4">
      {params.result === "sent" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.notificationsPanel.messages.sent}
        </div>
      ) : null}
      {params.result === "invalid-audience" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {dictionary.admin.notificationsPanel.messages.invalidAudience}
        </div>
      ) : null}
      {params.result === "missing-target-user" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {dictionary.admin.notificationsPanel.messages.missingTargetUser}
        </div>
      ) : null}
      {params.result === "send-failed" || params.result === "forbidden" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {dictionary.admin.notificationsPanel.messages.failed}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.notificationsPanel.composer.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.notificationsPanel.composer.subtitle}</p>

        <form action={sendAdminAnnouncementAction} className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.notificationsPanel.composer.audienceLabel}</span>
              <select
                name="audience"
                defaultValue="all"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              >
                <option value="all">{dictionary.admin.notificationsPanel.composer.audienceOptions.all}</option>
                <option value="individual">{dictionary.admin.notificationsPanel.composer.audienceOptions.individual}</option>
                <option value="company">{dictionary.admin.notificationsPanel.composer.audienceOptions.company}</option>
                <option value="user">{dictionary.admin.notificationsPanel.composer.audienceOptions.user}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700">{dictionary.admin.notificationsPanel.composer.audienceUserIdLabel}</span>
              <input
                name="targetUserId"
                placeholder={dictionary.admin.notificationsPanel.composer.placeholders.userId}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.notificationsPanel.composer.titleLabel}</span>
            <input
              name="title"
              required
              placeholder={dictionary.admin.notificationsPanel.composer.placeholders.title}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">{dictionary.admin.notificationsPanel.composer.bodyLabel}</span>
            <textarea
              name="body"
              required
              rows={4}
              placeholder={dictionary.admin.notificationsPanel.composer.placeholders.body}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
            />
          </label>

          <div>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              {dictionary.admin.notificationsPanel.composer.submit}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.notificationsPanel.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.notificationsPanel.subtitle}</p>

        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_220px_auto]" action="/admin/notifications">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={dictionary.admin.notificationsPanel.filters.search}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          />
          <select
            name="kind"
            defaultValue={params.kind ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.notificationsPanel.filters.anyKind}</option>
            <option value="follow">{dictionary.admin.notificationsPanel.kinds.follow}</option>
            <option value="rating">{dictionary.admin.notificationsPanel.kinds.rating}</option>
            <option value="listing_status">{dictionary.admin.notificationsPanel.kinds.listing_status}</option>
            <option value="admin_announcement">{dictionary.admin.notificationsPanel.kinds.admin_announcement}</option>
          </select>
          <select
            name="unread"
            defaultValue={params.unread ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.notificationsPanel.filters.allReadStates}</option>
            <option value="yes">{dictionary.admin.notificationsPanel.filters.unreadOnly}</option>
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.search.submit}
          </button>
        </form>

        {data.errorCode ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {dictionary.admin.notificationsPanel.dataSourceUnavailable}: {data.errorCode}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.summary.map((item) => (
          <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.notificationsPanel.kinds[item.key]}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{item.total.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}</p>
            <p className="mt-1 text-xs text-slate-600">
              {dictionary.admin.notificationsPanel.labels.read}: {item.read.toLocaleString(language === "ar" ? "ar-SA" : "en-US")} ·{" "}
              {dictionary.admin.notificationsPanel.labels.unread}: {item.unread.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">{dictionary.admin.notificationsPanel.columns.kind}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.notificationsPanel.columns.recipient}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.notificationsPanel.columns.actor}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.notificationsPanel.columns.target}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.notificationsPanel.columns.readState}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.notificationsPanel.columns.createdAt}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.notificationsPanel.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{dictionary.admin.notificationsPanel.kinds[row.kind]}</td>
                  <td className="px-3 py-2 text-slate-700">{row.recipientName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.actorName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.targetLabel}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.isRead ? dictionary.admin.notificationsPanel.readStates.read : dictionary.admin.notificationsPanel.readStates.unread}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(row.createdAt, language)}</td>
                  <td className="px-3 py-2">
                    <Link href={row.href} className="text-xs font-semibold text-brand hover:underline">
                      {dictionary.admin.notificationsPanel.actions.open}
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
              return `/admin/notifications?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.previous}
          </Link>
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.min(data.totalPages, data.page + 1)));
              return `/admin/notifications?${next.toString()}`;
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
