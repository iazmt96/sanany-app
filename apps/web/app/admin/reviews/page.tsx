import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { deleteAdminReview, getAdminReviewsPageData } from "../../../src/admin/reviews";
import { formatDateTime } from "../../../src/admin/users";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

type AdminReviewsPageProps = {
  searchParams: Promise<{
    q?: string;
    min_rating?: string;
    page?: string;
    result?: string;
  }>;
};

async function deleteReviewAction(formData: FormData) {
  "use server";

  const reviewId = String(formData.get("reviewId") ?? "");
  if (!reviewId) {
    redirect("/admin/reviews?result=delete-failed");
  }

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "reviews.manage")) {
    redirect("/admin/reviews?result=forbidden");
  }

  try {
    await deleteAdminReview({ reviewId, actorUserId: auth.userId });
  } catch {
    redirect("/admin/reviews?result=delete-failed");
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/admin/users");
  redirect("/admin/reviews?result=deleted");
}

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "reviews.manage")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminReviewsPageData({
    q: params.q ?? null,
    minRating: params.min_rating ?? null,
    page: params.page ?? null
  });

  const pageBaseParams = new URLSearchParams();
  if (params.q) pageBaseParams.set("q", params.q);
  if (params.min_rating) pageBaseParams.set("min_rating", params.min_rating);

  return (
    <section className="space-y-4">
      {params.result === "deleted" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.reviews.messages.deleted}
        </div>
      ) : null}
      {params.result === "delete-failed" || params.result === "forbidden" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {dictionary.admin.reviews.messages.deleteFailed}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.reviews.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.reviews.subtitle}</p>

        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_auto]" action="/admin/reviews">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={dictionary.admin.reviews.filters.search}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          />
          <select
            name="min_rating"
            defaultValue={params.min_rating ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.reviews.filters.anyRating}</option>
            <option value="5">5+</option>
            <option value="4">4+</option>
            <option value="3">3+</option>
            <option value="2">2+</option>
            <option value="1">1+</option>
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.search.submit}
          </button>
        </form>

        {data.errorCode ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {dictionary.admin.reviews.dataSourceUnavailable}: {data.errorCode}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">{dictionary.admin.reviews.columns.rating}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.reviews.columns.comment}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.reviews.columns.rater}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.reviews.columns.seller}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.reviews.columns.listing}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.reviews.columns.createdAt}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.reviews.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{row.rating}</td>
                  <td className="px-3 py-2 text-slate-700">{row.comment ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <Link href={`/admin/users/${row.raterId}`} className="font-medium text-brand hover:underline">
                      {row.raterDisplayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <Link href={`/admin/users/${row.sellerId}`} className="font-medium text-brand hover:underline">
                      {row.sellerDisplayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.listingId ? (
                      <Link href={`/admin/listings/${row.listingId}`} className="font-medium text-brand hover:underline">
                        {row.listingTitle ?? row.listingId}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(row.createdAt, language)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/reviews/${row.id}`} className="text-xs font-semibold text-brand hover:underline">
                        {dictionary.admin.reviews.actions.view}
                      </Link>
                      <form action={deleteReviewAction}>
                        <input type="hidden" name="reviewId" value={row.id} />
                        <button type="submit" className="text-xs font-semibold text-rose-600 hover:underline">
                          {dictionary.admin.reviews.actions.delete}
                        </button>
                      </form>
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
              return `/admin/reviews?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.previous}
          </Link>
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.min(data.totalPages, data.page + 1)));
              return `/admin/reviews?${next.toString()}`;
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
