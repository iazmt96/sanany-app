import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../../src/admin/locale";
import { deleteAdminReview, getAdminReviewDetails } from "../../../../src/admin/reviews";
import { formatDateTime } from "../../../../src/admin/users";
import { AdminForbidden } from "../../../../src/components/admin/admin-forbidden";

type AdminReviewDetailsPageProps = {
  params: Promise<{ reviewId: string }>;
  searchParams: Promise<{ result?: string }>;
};

async function deleteReviewAction(formData: FormData) {
  "use server";

  const reviewId = String(formData.get("reviewId") ?? "");
  if (!reviewId) {
    redirect("/admin/reviews?result=delete-failed");
  }

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "reviews.manage")) {
    redirect(`/admin/reviews/${reviewId}?result=forbidden`);
  }

  try {
    await deleteAdminReview({ reviewId, actorUserId: auth.userId });
  } catch {
    redirect(`/admin/reviews/${reviewId}?result=delete-failed`);
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/admin/users");
  redirect("/admin/reviews?result=deleted");
}

export default async function AdminReviewDetailsPage({ params, searchParams }: AdminReviewDetailsPageProps) {
  const { reviewId } = await params;
  const search = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "reviews.manage")) {
    return <AdminForbidden language={language} />;
  }

  const details = await getAdminReviewDetails(reviewId);
  if (!details) {
    notFound();
  }

  return (
    <section className="space-y-4">
      {search.result === "delete-failed" || search.result === "forbidden" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {dictionary.admin.reviews.messages.deleteFailed}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.reviews.detailsTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {dictionary.admin.reviews.fields.reviewId}: {details.row.id}
            </p>
          </div>
          <Link href="/admin/reviews" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            {dictionary.admin.reviews.actions.back}
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reviews.columns.rating}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.row.rating}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reviews.columns.createdAt}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(details.row.createdAt, language)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reviews.fields.sellerCity}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.seller.city ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reviews.fields.raterCity}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{details.rater.city ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reviews.columns.seller}</p>
            <Link href={`/admin/users/${details.row.sellerId}`} className="mt-1 block text-sm font-semibold text-brand hover:underline">
              {details.row.sellerDisplayName}
            </Link>
            <p className="mt-1 text-xs text-slate-500">
              {dictionary.admin.users.columns.joinedAt}: {details.seller.joinedAt ? formatDateTime(details.seller.joinedAt, language) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reviews.columns.rater}</p>
            <Link href={`/admin/users/${details.row.raterId}`} className="mt-1 block text-sm font-semibold text-brand hover:underline">
              {details.row.raterDisplayName}
            </Link>
            <p className="mt-1 text-xs text-slate-500">
              {dictionary.admin.users.columns.joinedAt}: {details.rater.joinedAt ? formatDateTime(details.rater.joinedAt, language) : "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reviews.columns.comment}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{details.row.comment?.trim() || "—"}</p>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.reviews.columns.listing}</p>
          {details.listing ? (
            <div className="mt-2 space-y-1">
              <Link href={`/admin/listings/${details.listing.id}`} className="text-sm font-semibold text-brand hover:underline">
                {details.listing.title}
              </Link>
              <p className="text-xs text-slate-500">
                {dictionary.admin.listings.status[details.listing.status as keyof typeof dictionary.admin.listings.status] ?? details.listing.status}
              </p>
              <p className="text-xs text-slate-500">
                {dictionary.admin.listings.columns.createdAt}: {formatDateTime(details.listing.createdAt, language)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">—</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.reviews.moderation.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.reviews.moderation.subtitle}</p>
        <form action={deleteReviewAction} className="mt-4">
          <input type="hidden" name="reviewId" value={details.row.id} />
          <button type="submit" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
            {dictionary.admin.reviews.actions.delete}
          </button>
        </form>
      </div>
    </section>
  );
}
