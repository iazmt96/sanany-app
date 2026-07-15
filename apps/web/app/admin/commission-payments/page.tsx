import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCurrencySar, formatDateTimeFull, hasAdminPermission, resources } from "@sanany/shared";
import { getAdminAuthContext } from "../../../src/admin/auth";
import {
  getAdminCommissionPaymentsData,
  refundCommissionPayment,
  updateMarketplaceCommissionRate
} from "../../../src/admin/commission-payments";
import { resolveAdminLanguage } from "../../../src/admin/locale";
import { AdminForbidden } from "../../../src/components/admin/admin-forbidden";

function normalizeResult(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function updateCommissionRateAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "finance.manage")) {
    redirect("/admin/commission-payments?result=forbidden");
  }

  const ratePercent = normalizeResult(formData.get("ratePercent"));
  if (ratePercent === null) {
    redirect("/admin/commission-payments?result=invalid-rate");
  }

  await updateMarketplaceCommissionRate({
    ratePercent,
    actorUserId: auth.userId
  });

  redirect("/admin/commission-payments?result=rate-updated");
}

async function refundCommissionPaymentAction(formData: FormData) {
  "use server";

  const auth = await getAdminAuthContext();
  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "finance.manage")) {
    redirect("/admin/commission-payments?result=forbidden");
  }

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!paymentId || !reason) {
    redirect("/admin/commission-payments?result=invalid-refund");
  }

  await refundCommissionPayment({
    paymentId,
    actorUserId: auth.userId,
    reason
  });

  redirect("/admin/commission-payments?result=refunded");
}

type AdminCommissionPaymentsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    result?: string;
  }>;
};

export default async function AdminCommissionPaymentsPage({ searchParams }: AdminCommissionPaymentsPageProps) {
  const params = await searchParams;
  const language = await resolveAdminLanguage();
  const dictionary = resources[language].translation;
  const auth = await getAdminAuthContext();

  if (auth.status !== "authorized" || !hasAdminPermission(auth.role, "finance.manage")) {
    return <AdminForbidden language={language} />;
  }

  const data = await getAdminCommissionPaymentsData({
    q: params.q ?? null,
    status: params.status ?? null,
    page: params.page ?? null
  });

  const pageBaseParams = new URLSearchParams();
  if (params.q) pageBaseParams.set("q", params.q);
  if (params.status) pageBaseParams.set("status", params.status);

  return (
    <section className="space-y-4">
      {params.result === "rate-updated" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {dictionary.admin.commissionPayments.messages.rateUpdated}
        </div>
      ) : null}
      {params.result === "refunded" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {dictionary.admin.commissionPayments.messages.refunded}
        </div>
      ) : null}
      {params.result === "invalid-rate" || params.result === "invalid-refund" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {dictionary.admin.commissionPayments.messages.invalidInput}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{dictionary.admin.commissionPayments.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{dictionary.admin.commissionPayments.subtitle}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.commissionPayments.analyticsTitle}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {dictionary.admin.commissionPayments.analytics.totalRevenue}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrencySar(data.analytics.totalRevenue, language)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {dictionary.admin.commissionPayments.analytics.paid}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.analytics.paidCount.toLocaleString(language)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {dictionary.admin.commissionPayments.analytics.pending}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.analytics.pendingCount.toLocaleString(language)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {dictionary.admin.commissionPayments.analytics.failed}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.analytics.failedCount.toLocaleString(language)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {dictionary.admin.commissionPayments.analytics.refunded}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.analytics.refundedCount.toLocaleString(language)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {dictionary.admin.commissionPayments.analytics.cancelled}
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.analytics.cancelledCount.toLocaleString(language)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{dictionary.admin.commissionPayments.rateCard.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{dictionary.admin.commissionPayments.rateCard.subtitle}</p>
          <p className="mt-4 text-3xl font-bold text-slate-900">{data.currentRatePercent.toLocaleString(language)}%</p>
          <form action={updateCommissionRateAction} className="mt-4 space-y-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">{dictionary.admin.commissionPayments.rateCard.inputLabel}</span>
              <input
                name="ratePercent"
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                defaultValue={data.currentRatePercent}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
              />
            </label>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              {dictionary.admin.commissionPayments.rateCard.submit}
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-2 md:grid-cols-[1fr_220px_auto]" action="/admin/commission-payments">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={dictionary.admin.commissionPayments.filters.search}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          />
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand/30 focus:border-brand focus:ring"
          >
            <option value="">{dictionary.admin.commissionPayments.filters.anyStatus}</option>
            <option value="paid">{dictionary.admin.commissionPayments.status.paid}</option>
            <option value="pending">{dictionary.admin.commissionPayments.status.pending}</option>
            <option value="failed">{dictionary.admin.commissionPayments.status.failed}</option>
            <option value="cancelled">{dictionary.admin.commissionPayments.status.cancelled}</option>
            <option value="refunded">{dictionary.admin.commissionPayments.status.refunded}</option>
          </select>
          <button type="submit" className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            {dictionary.admin.search.submit}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.listing}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.seller}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.saleAmount}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.rate}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.commission}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.status}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.paymentDate}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.invoiceNumber}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.transactionReference}</th>
                <th className="px-3 py-2 text-start">{dictionary.admin.commissionPayments.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{row.listingTitle}</p>
                      <p className="text-xs text-slate-500">{row.listingId}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{row.sellerDisplayName}</p>
                      <p className="text-xs text-slate-500">{row.sellerUsername ?? row.sellerId}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{formatCurrencySar(row.finalSaleAmount, language)}</td>
                  <td className="px-3 py-3 text-slate-700">{row.commissionRatePercent}%</td>
                  <td className="px-3 py-3 text-slate-700">{formatCurrencySar(row.commissionAmount, language)}</td>
                  <td className="px-3 py-3 text-slate-700">{dictionary.admin.commissionPayments.status[row.paymentStatus]}</td>
                  <td className="px-3 py-3 text-slate-700">{row.paymentDate ? formatDateTimeFull(row.paymentDate, language) : "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{row.invoiceNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{row.transactionReference ?? "—"}</td>
                  <td className="px-3 py-3">
                    <div className="space-y-2">
                      <Link href={`/admin/listings/${row.listingId}`} className="block text-xs font-semibold text-brand hover:underline">
                        {dictionary.admin.commissionPayments.actions.review}
                      </Link>
                      {row.invoiceNumber ? (
                        <Link
                          href={`/api/admin/commission-payments/${row.id}/invoice`}
                          className="block text-xs font-semibold text-slate-700 hover:underline"
                        >
                          {dictionary.myAds.saleFlow.invoiceDownload}
                        </Link>
                      ) : null}
                      {row.paymentStatus === "paid" ? (
                        <form action={refundCommissionPaymentAction} className="space-y-2">
                          <input type="hidden" name="paymentId" value={row.id} />
                          <input
                            name="reason"
                            placeholder={dictionary.admin.commissionPayments.refundReasonPlaceholder}
                            className="h-9 w-48 rounded-lg border border-slate-300 px-3 text-xs outline-none ring-brand/30 focus:border-brand focus:ring"
                          />
                          <button type="submit" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                            {dictionary.admin.commissionPayments.actions.refund}
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
              return `/admin/commission-payments?${next.toString()}`;
            })()}
            className={`rounded-lg border px-3 py-1 ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {dictionary.common.previous}
          </Link>
          <Link
            href={(() => {
              const next = new URLSearchParams(pageBaseParams.toString());
              next.set("page", String(Math.min(data.totalPages, data.page + 1)));
              return `/admin/commission-payments?${next.toString()}`;
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
