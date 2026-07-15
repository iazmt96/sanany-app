"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ListingSaleInvoice, ListingSalePayment, MarketplaceCommissionSettings, MarketplaceListing } from "@sanany/types";
import {
  calculateCommissionFromSaleAmount,
  DEFAULT_MARKETPLACE_PAYMENT_METHOD,
  formatCurrencySar,
  formatDateTimeFull,
  getPrimaryListingImageUrl
} from "@sanany/shared";
import { getWebListingsRepository } from "../lib/listings-repository";

type MyAdsSaleCompletionProps = {
  isOpen: boolean;
  language: string;
  listing: MarketplaceListing | null;
  sellerId: string | null;
  settings: MarketplaceCommissionSettings | null;
  payment: ListingSalePayment | null;
  onClose(): void;
  onPaymentUpdated(payment: ListingSalePayment): void;
  preview?: {
    amount: string;
    isConfirmed: boolean;
    uiState: SaleUiState;
    invoice: ListingSaleInvoice | null;
  } | null;
};

type SaleUiState = "idle" | "pending" | "failed" | "cancelled" | "success";

function buildInvoiceDocument(invoice: ListingSaleInvoice, language: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const title = invoice.listingTitle;
  return `<!doctype html>
<html lang="${language === "ar" ? "ar" : "en"}" dir="${language === "ar" ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 32px; }
      .card { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 28px; }
      .brand { font-size: 28px; font-weight: 700; color: #0f766e; }
      .muted { color: #64748b; font-size: 14px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 24px; }
      .item { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
      .label { color: #64748b; font-size: 13px; margin-bottom: 6px; }
      .value { font-size: 16px; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">SANANY</div>
      <p class="muted">${t("myAds.saleFlow.invoiceDescription")}</p>
      <div class="grid">
        <div class="item"><div class="label">${t("myAds.saleFlow.invoiceNumber")}</div><div class="value">${invoice.payment.invoiceNumber ?? "-"}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.invoiceStatus")}</div><div class="value">${t("myAds.saleFlow.invoiceStatusPaid")}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.paymentDate")}</div><div class="value">${invoice.payment.paymentDate ? formatDateTimeFull(invoice.payment.paymentDate, language) : "-"}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.paymentMethod")}</div><div class="value">${invoice.payment.paymentMethod ?? DEFAULT_MARKETPLACE_PAYMENT_METHOD}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.transactionReference")}</div><div class="value">${invoice.payment.transactionReference ?? "-"}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.amountLabel")}</div><div class="value">${formatCurrencySar(invoice.payment.finalSaleAmount, language)}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.commissionRate")}</div><div class="value">${invoice.payment.commissionRatePercent}%</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.commissionAmount")}</div><div class="value">${formatCurrencySar(invoice.payment.commissionAmount, language)}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.heading")}</div><div class="value">${invoice.listingTitle}</div></div>
        <div class="item"><div class="label">${t("admin.commissionPayments.columns.seller")}</div><div class="value">${invoice.sellerDisplayName}</div></div>
      </div>
    </div>
  </body>
</html>`;
}

export function MyAdsSaleCompletion({
  isOpen,
  language,
  listing,
  sellerId,
  settings,
  payment,
  onClose,
  onPaymentUpdated,
  preview = null
}: MyAdsSaleCompletionProps) {
  const { t } = useTranslation();
  const repository = useMemo(() => getWebListingsRepository(), []);
  const [amount, setAmount] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [uiState, setUiState] = useState<SaleUiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<ListingSaleInvoice | null>(null);
  const primaryImage = listing ? getPrimaryListingImageUrl(listing.imageUrl) : null;

  useEffect(() => {
    if (!isOpen || !listing) {
      return;
    }

    setAmount(preview?.amount ?? String(Math.max(1, payment?.finalSaleAmount ?? listing.price ?? 0)));
    setIsConfirmed(preview?.isConfirmed ?? false);
    setIsWorking(false);
    setUiState(preview?.uiState ?? (payment?.paymentStatus === "paid" ? "success" : "idle"));
    setErrorMessage(null);
    setInvoice(preview?.invoice ?? null);
  }, [isOpen, listing, payment, preview]);

  useEffect(() => {
    if (preview || !isOpen || !listing || !sellerId || payment?.paymentStatus !== "paid") {
      return;
    }

    let active = true;
    void repository.getSaleInvoice(listing.id, sellerId).then((result) => {
      if (active) {
        setInvoice(result);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, listing, payment?.paymentStatus, preview, repository, sellerId]);

  const parsedAmount = Number(amount);
  const calculation = calculateCommissionFromSaleAmount({
    finalSaleAmount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    commissionRatePercent: settings?.commissionRatePercent ?? 1
  });

  const preparePayment = async () => {
    if (!listing || !sellerId) {
      throw new Error(t("marketplace.loadError"));
    }
    const nextPayment = await repository.prepareSalePayment({
      listingId: listing.id,
      sellerId,
      finalSaleAmount: calculation.finalSaleAmount
    });
    onPaymentUpdated(nextPayment);
    return nextPayment;
  };

  const onPay = async () => {
    if (preview) {
      return;
    }
    if (!listing || !sellerId || !settings) {
      return;
    }
    if (!amount.trim()) {
      setErrorMessage(t("myAds.saleFlow.missingAmount"));
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage(t("myAds.saleFlow.invalidAmount"));
      return;
    }
    if (!isConfirmed) {
      setErrorMessage(t("myAds.saleFlow.confirmationRequired"));
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    setUiState("pending");

    try {
      await preparePayment();
      const result = await repository.finalizeSalePayment({
        listingId: listing.id,
        sellerId,
        outcome: "paid",
        paymentMethod: DEFAULT_MARKETPLACE_PAYMENT_METHOD
      });
      onPaymentUpdated(result);
      const nextInvoice = await repository.getSaleInvoice(listing.id, sellerId);
      setInvoice(nextInvoice);
      setUiState("success");
    } catch (error) {
      setUiState("failed");
      setErrorMessage(error instanceof Error ? error.message : t("marketplace.loadError"));
    } finally {
      setIsWorking(false);
    }
  };

  const onCancelPayment = async () => {
    if (preview) {
      return;
    }
    if (!listing || !sellerId) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      const nextPayment = payment ?? (await preparePayment());
      const result = await repository.finalizeSalePayment({
        listingId: listing.id,
        sellerId,
        outcome: "cancelled",
        paymentMethod: nextPayment.paymentMethod ?? DEFAULT_MARKETPLACE_PAYMENT_METHOD
      });
      onPaymentUpdated(result);
      setUiState("cancelled");
    } catch (error) {
      setUiState("failed");
      setErrorMessage(error instanceof Error ? error.message : t("marketplace.loadError"));
    } finally {
      setIsWorking(false);
    }
  };

  const downloadInvoice = async () => {
    if (!invoice) {
      return;
    }

    try {
      const blob = new Blob([buildInvoiceDocument(invoice, language, t)], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${invoice.payment.invoiceNumber ?? invoice.listingId}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage(t("myAds.saleFlow.invoiceSaveFailed"));
    }
  };

  const shareInvoice = async () => {
    if (!invoice) {
      return;
    }

    const shareText = [
      "SANANY",
      `${t("myAds.saleFlow.invoiceNumber")}: ${invoice.payment.invoiceNumber ?? "-"}`,
      `${t("myAds.saleFlow.transactionReference")}: ${invoice.payment.transactionReference ?? "-"}`,
      `${t("myAds.saleFlow.amountLabel")}: ${formatCurrencySar(invoice.payment.finalSaleAmount, language)}`,
      `${t("myAds.saleFlow.commissionAmount")}: ${formatCurrencySar(invoice.payment.commissionAmount, language)}`
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: invoice.listingTitle, text: shareText });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      }
    } catch {
      setErrorMessage(t("myAds.saleFlow.invoiceShareFailed"));
    }
  };

  if (!isOpen || !listing) {
    return null;
  }

  return (
    <div data-testid="sale-completion-modal" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t("myAds.saleFlow.heading")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("myAds.saleFlow.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600">
            {t("common.close")}
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row">
            <div className="h-28 w-full overflow-hidden rounded-2xl bg-slate-100 md:w-40">
              {primaryImage ? <img src={primaryImage} alt={listing.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">SANANY</div>}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-slate-500">{t("myAds.saleFlow.listedPrice")}</p>
              <h3 className="text-lg font-semibold text-slate-900">{listing.title}</h3>
              <p className="text-base font-bold text-brand">{formatCurrencySar(listing.price, language)}</p>
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-800">{t("myAds.saleFlow.amountLabel")}</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              placeholder={t("myAds.saleFlow.amountPlaceholder")}
              className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-base outline-none ring-brand/20 focus:border-brand focus:ring"
            />
            <p className="text-xs text-slate-500">{t("myAds.saleFlow.amountHelper")}</p>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">{t("myAds.saleFlow.calculationTitle")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">{t("myAds.saleFlow.amountLabel")}</p>
                <p className="text-base font-semibold text-slate-900">{formatCurrencySar(calculation.finalSaleAmount, language)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("myAds.saleFlow.commissionRate")}</p>
                <p className="text-base font-semibold text-slate-900">{calculation.commissionRatePercent}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("myAds.saleFlow.commissionAmount")}</p>
                <p className="text-base font-semibold text-slate-900">{formatCurrencySar(calculation.commissionAmount, language)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("myAds.saleFlow.totalToPay")}</p>
                <p className="text-base font-semibold text-slate-900">{formatCurrencySar(calculation.totalToPayNow, language)}</p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <input type="checkbox" checked={isConfirmed} onChange={(event) => setIsConfirmed(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            <span className="text-sm text-slate-700">{t("myAds.saleFlow.confirmLabel")}</span>
          </label>

          {uiState === "pending" ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("myAds.saleFlow.pendingHint")}</div> : null}
          {uiState === "failed" ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage ?? t("myAds.saleFlow.failedHint")}</div> : null}
          {uiState === "cancelled" ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{t("myAds.saleFlow.cancelledHint")}</div> : null}
          {uiState === "success" ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t("myAds.saleFlow.successBanner")}</div> : null}
          {errorMessage && uiState === "idle" ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}

          {invoice ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("myAds.saleFlow.invoiceTitle")}</p>
                <p className="mt-1 text-sm text-slate-600">{t("myAds.saleFlow.invoiceDescription")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">{t("myAds.saleFlow.invoiceNumber")}</p>
                  <p className="text-sm font-semibold text-slate-900">{invoice.payment.invoiceNumber ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("myAds.saleFlow.paymentDate")}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {invoice.payment.paymentDate ? formatDateTimeFull(invoice.payment.paymentDate, language) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("myAds.saleFlow.transactionReference")}</p>
                  <p className="text-sm font-semibold text-slate-900">{invoice.payment.transactionReference ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("myAds.saleFlow.paymentMethod")}</p>
                  <p className="text-sm font-semibold text-slate-900">{invoice.payment.paymentMethod ?? DEFAULT_MARKETPLACE_PAYMENT_METHOD}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void downloadInvoice()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  {t("myAds.saleFlow.invoiceDownload")}
                </button>
                <button type="button" onClick={() => void shareInvoice()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  {t("myAds.saleFlow.invoiceShare")}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={() => void onCancelPayment()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700" disabled={Boolean(preview) || isWorking || uiState === "success"}>
            {t("common.cancel")}
          </button>
          <button type="button" onClick={() => void onPay()} disabled={Boolean(preview) || isWorking || uiState === "success"} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {isWorking ? t("myAds.saleFlow.preparing") : t("myAds.saleFlow.payButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
