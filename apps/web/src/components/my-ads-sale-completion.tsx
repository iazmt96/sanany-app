"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  tapPaymentReturn?: {
    tapId: string;
    listingId: string;
  } | null;
  onTapPaymentHandled?: () => void;
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
        <div class="item"><div class="label">${t("myAds.saleFlow.saleSourceLabel")}</div><div class="value">${t(`myAds.saleFlow.saleSources.${invoice.payment.saleSource}`)}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.buyerNameLabel")}</div><div class="value">${invoice.payment.buyerName ?? "-"}</div></div>
        <div class="item"><div class="label">${t("myAds.saleFlow.buyerPhoneLabel")}</div><div class="value">${invoice.payment.buyerPhone ?? "-"}</div></div>
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
  tapPaymentReturn = null,
  onTapPaymentHandled
}: MyAdsSaleCompletionProps) {
  const { t } = useTranslation();
  const repository = useMemo(() => getWebListingsRepository(), []);
  const [amount, setAmount] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [uiState, setUiState] = useState<SaleUiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<ListingSaleInvoice | null>(null);
  const handledTapPaymentRef = useRef<string | null>(null);
  const primaryImage = listing ? getPrimaryListingImageUrl(listing.imageUrl) : null;

  useEffect(() => {
    if (!isOpen || !listing) {
      return;
    }

    setAmount(String(Math.max(1, payment?.finalSaleAmount ?? listing.price ?? 0)));
    setIsConfirmed(false);
    setIsWorking(false);
    setUiState(payment?.paymentStatus === "paid" ? "success" : "idle");
    setErrorMessage(null);
    setInvoice(null);
  }, [isOpen, listing, payment]);

  useEffect(() => {
    if (!isOpen || !listing || !sellerId || !tapPaymentReturn) {
      return;
    }
    if (tapPaymentReturn.listingId !== listing.id) {
      return;
    }
    if (handledTapPaymentRef.current === tapPaymentReturn.tapId) {
      return;
    }

    handledTapPaymentRef.current = tapPaymentReturn.tapId;
    let active = true;

    const cleanTapQueryParams = () => {
      if (typeof window === "undefined") {
        return;
      }
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("tap_id");
      currentUrl.searchParams.delete("tapId");
      currentUrl.searchParams.delete("tapCheckout");
      currentUrl.searchParams.delete("listingId");
      window.history.replaceState({}, "", currentUrl.toString());
    };

    const verifyTapPayment = async () => {
      setIsWorking(true);
      setUiState("pending");
      setErrorMessage(t("myAds.saleFlow.tapVerificationInProgress"));

      try {
        const response = await fetch("/api/payments/tap/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: listing.id,
            tapId: tapPaymentReturn.tapId
          })
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          outcome?: "paid" | "failed" | "cancelled" | "pending";
          failureReason?: string | null;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? t("myAds.saleFlow.tapVerificationFailed"));
        }

        const outcome = payload.outcome ?? "pending";
        const refreshedPayments = await repository.listSalePaymentsBySeller(sellerId);
        const latestPayment = refreshedPayments.find((item) => item.listingId === listing.id) ?? null;
        if (latestPayment) {
          onPaymentUpdated(latestPayment);
        }

        if (outcome === "paid") {
          const nextInvoice = await repository.getSaleInvoice(listing.id, sellerId);
          if (active) {
            setInvoice(nextInvoice);
            setErrorMessage(null);
            setUiState("success");
          }
          return;
        }
        if (outcome === "failed") {
          if (active) {
            setUiState("failed");
            setErrorMessage(payload.failureReason ?? t("myAds.saleFlow.failedHint"));
          }
          return;
        }
        if (outcome === "cancelled") {
          if (active) {
            setUiState("cancelled");
            setErrorMessage(null);
          }
          return;
        }
        if (active) {
          setUiState("pending");
          setErrorMessage(t("myAds.saleFlow.tapVerificationPending"));
        }
      } catch (error) {
        if (active) {
          setUiState("failed");
          setErrorMessage(error instanceof Error ? error.message : t("myAds.saleFlow.tapVerificationFailed"));
        }
      } finally {
        if (active) {
          setIsWorking(false);
          cleanTapQueryParams();
          onTapPaymentHandled?.();
        }
      }
    };

    void verifyTapPayment();
    return () => {
      active = false;
    };
  }, [isOpen, listing, onPaymentUpdated, onTapPaymentHandled, repository, sellerId, t, tapPaymentReturn]);

  useEffect(() => {
    if (!isOpen || !listing || !sellerId || payment?.paymentStatus !== "paid") {
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
  }, [isOpen, listing, payment?.paymentStatus, repository, sellerId]);

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
      finalSaleAmount: calculation.finalSaleAmount,
      saleSource: payment?.saleSource ?? "outside_sanany",
      saleSourceOther: payment?.saleSourceOther ?? null,
      buyerName: payment?.buyerName ?? null,
      buyerPhone: payment?.buyerPhone ?? null
    });
    onPaymentUpdated(nextPayment);
    return nextPayment;
  };

  const onPay = async () => {
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
      const nextPayment = await preparePayment();
      setErrorMessage(t("myAds.saleFlow.redirectingToTap"));
      const checkoutResponse = await fetch("/api/payments/tap/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          amount: nextPayment.commissionAmount,
          language
        })
      });
      const checkoutPayload = (await checkoutResponse.json().catch(() => ({}))) as { error?: string; checkoutUrl?: string };
      if (!checkoutResponse.ok || !checkoutPayload.checkoutUrl) {
        throw new Error(checkoutPayload.error ?? t("myAds.saleFlow.tapVerificationFailed"));
      }
      window.location.assign(checkoutPayload.checkoutUrl);
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

  const isPaid = payment?.paymentStatus === "paid" || uiState === "success";
  const isStickyCtaDisabled = isWorking || isPaid;

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
              {primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={primaryImage} alt={listing.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">SANANY</div>
              )}
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
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">{t("myAds.saleFlow.youWillReceive")}</p>
                <p className="text-base font-semibold text-emerald-700">{formatCurrencySar(calculation.sellerNetAmount, language)}</p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <input type="checkbox" checked={isConfirmed} onChange={(event) => setIsConfirmed(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            <span className="text-sm text-slate-700">{t("myAds.saleFlow.confirmLabel")}</span>
          </label>

          {uiState === "pending" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage ?? t("myAds.saleFlow.pendingHint")}
            </div>
          ) : null}
          {uiState === "failed" ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage ?? t("myAds.saleFlow.failedHint")}</div> : null}
          {uiState === "cancelled" ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{t("myAds.saleFlow.cancelledHint")}</div> : null}
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

        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={() => void onPay()}
            disabled={isStickyCtaDisabled}
            className={`flex min-h-14 w-full items-center justify-center rounded-2xl px-5 py-3 text-center text-sm font-semibold transition disabled:cursor-default ${
              isPaid
                ? "border border-emerald-300 bg-emerald-50 text-emerald-800 disabled:opacity-100"
                : "bg-brand text-white disabled:opacity-60"
            }`}
          >
            {isPaid ? (
              <span className="flex flex-col leading-5">
                <span>{t("myAds.saleFlow.paidButtonTitle")}</span>
                <span className="text-xs font-medium">{t("myAds.saleFlow.paidButtonSubtitle")}</span>
              </span>
            ) : (
              <span>{isWorking ? t("myAds.saleFlow.preparing") : t("myAds.saleFlow.action")}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
