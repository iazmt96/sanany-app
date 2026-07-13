import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../../src/admin/auth";
import { resolveAdminLanguage } from "../../../../src/admin/locale";
import { getAdminListingDetails, moderateAdminListingStatus } from "../../../../src/admin/listings";
import { formatDateTime } from "../../../../src/admin/users";
import { AdminForbidden } from "../../../../src/components/admin/admin-forbidden";

type AdminListingDetailsPageProps = {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ result?: string }>;
};

type ModerationAction = "approve" | "reject";

function parseModerationAction(value: FormDataEntryValue | null): ModerationAction | null {
  if (value === "approve" || value === "reject") {
    return value;
  }
  return null;
}

async function moderateListingAction(formData: FormData) {
  "use server";

  const listingId = String(formData.get("listingId") ?? "");
  const action = parseModerationAction(formData.get("action"));
  if (!listingId || !action) {
    redirect("/admin/listings");
  }

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized") {
    redirect("/admin/listings");
  }

  if (action === "approve" && !hasAdminPermission(auth.role, "listings.approve")) {
    redirect(`/admin/listings/${listingId}`);
  }
  if (action === "reject" && !hasAdminPermission(auth.role, "listings.reject")) {
    redirect(`/admin/listings/${listingId}`);
  }

  await moderateAdminListingStatus({
    listingId,
    nextStatus: action === "approve" ? "available" : "inactive",
    actorUserId: auth.userId
  });

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${listingId}`);
  redirect(`/admin/listings/${listingId}?result=${action}`);
}

export default async function AdminListingDetailsPage({ params, searchParams }: AdminListingDetailsPageProps) {
  const { listingId } = await params;
  const search = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "listings.view")) {
    return <AdminForbidden language={language} />;
  }

  const listing = await getAdminListingDetails(listingId);
  if (!listing) {
    notFound();
  }

  const canApprove = hasAdminPermission(auth.role, "listings.approve") && listing.status !== "available";
  const canReject = hasAdminPermission(auth.role, "listings.reject") && listing.status !== "inactive";

  return (
    <section className="space-y-4">
      {search.result === "approve" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {dictionary.admin.listings.messages.approved}
        </div>
      ) : null}
      {search.result === "reject" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {dictionary.admin.listings.messages.rejected}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{listing.title}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {dictionary.admin.listings.fields.listingId}: {listing.id}
            </p>
          </div>
          <Link href="/admin/listings" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            {dictionary.admin.listings.actions.back}
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.listings.columns.status}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{dictionary.admin.listings.status[listing.status]}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.listings.columns.owner}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{listing.ownerDisplayName}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.listings.columns.price}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{listing.price.toLocaleString(language === "ar" ? "ar-SA" : "en-US")}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.listings.columns.createdAt}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(listing.createdAt, language)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.listings.columns.location}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{listing.locationName ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.listings.fields.coordinates}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {listing.latitude === null || listing.longitude === null ? "—" : `${listing.latitude}, ${listing.longitude}`}
            </p>
          </div>
        </div>

        {listing.description ? (
          <div className="mt-4 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dictionary.admin.listings.fields.description}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{listing.description}</p>
          </div>
        ) : null}
      </div>

      {canApprove || canReject ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.listings.moderation.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{dictionary.admin.listings.moderation.subtitle}</p>
          <form action={moderateListingAction} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="listingId" value={listing.id} />
            {canApprove ? (
              <button
                type="submit"
                name="action"
                value="approve"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                {dictionary.admin.listings.actions.approve}
              </button>
            ) : null}
            {canReject ? (
              <button
                type="submit"
                name="action"
                value="reject"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                {dictionary.admin.listings.actions.reject}
              </button>
            ) : null}
          </form>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.listings.fields.images}</h3>
          {listing.images.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{dictionary.admin.dashboard.unavailable}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {listing.images.map((image) => (
                <li key={image.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{image.storagePath}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dictionary.admin.listings.fields.sortOrder}: {image.sortOrder} · {image.isPrimary ? dictionary.admin.listings.fields.primaryImage : dictionary.admin.listings.fields.secondaryImage}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {listing.imageUrl ? (
            <div className="mt-3 rounded-lg border border-slate-200 p-3 text-xs text-slate-500">
              {dictionary.admin.listings.fields.legacyImageUrl}: {listing.imageUrl}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.listings.fields.statusHistory}</h3>
          {listing.statusEvents.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{dictionary.admin.dashboard.unavailable}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {listing.statusEvents.map((event) => (
                <li key={event.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">
                    {dictionary.admin.listings.status[event.oldStatus as keyof typeof dictionary.admin.listings.status] ?? event.oldStatus} {"→"}{" "}
                    {dictionary.admin.listings.status[event.newStatus as keyof typeof dictionary.admin.listings.status] ?? event.newStatus}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.createdAt, language)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
