import * as FileSystem from "expo-file-system";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ListingSaleInvoice, ListingSalePayment, MarketplaceCommissionSettings, MarketplaceListing } from "@sanany/types";
import { calculateCommissionFromSaleAmount, DEFAULT_MARKETPLACE_PAYMENT_METHOD, formatCurrencySar, formatDateTimeFull } from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { getMobileListingsRepository } from "../lib/listings-repository";

type MyAdsSaleSheetProps = {
  visible: boolean;
  direction: Direction;
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

function buildInvoiceText(invoice: ListingSaleInvoice, language: string, t: ReturnType<typeof useTranslation>["t"]) {
  return [
    "SANANY",
    `${t("myAds.saleFlow.invoiceNumber")}: ${invoice.payment.invoiceNumber ?? "-"}`,
    `${t("myAds.saleFlow.paymentDate")}: ${invoice.payment.paymentDate ? formatDateTimeFull(invoice.payment.paymentDate, language) : "-"}`,
    `${t("myAds.saleFlow.transactionReference")}: ${invoice.payment.transactionReference ?? "-"}`,
    `${t("myAds.saleFlow.amountLabel")}: ${formatCurrencySar(invoice.payment.finalSaleAmount, language)}`,
    `${t("myAds.saleFlow.commissionRate")}: ${invoice.payment.commissionRatePercent}%`,
    `${t("myAds.saleFlow.commissionAmount")}: ${formatCurrencySar(invoice.payment.commissionAmount, language)}`,
    `${t("myAds.saleFlow.saleSourceLabel")}: ${t(`myAds.saleFlow.saleSources.${invoice.payment.saleSource}`)}`,
    `${t("myAds.saleFlow.buyerNameLabel")}: ${invoice.payment.buyerName ?? "-"}`,
    `${t("myAds.saleFlow.buyerPhoneLabel")}: ${invoice.payment.buyerPhone ?? "-"}`
  ].join("\n");
}

export function MyAdsSaleSheet({
  visible,
  direction,
  language,
  listing,
  sellerId,
  settings,
  payment,
  onClose,
  onPaymentUpdated,
  preview = null
}: MyAdsSaleSheetProps) {
  const { t } = useTranslation();
  const repository = useMemo(() => getMobileListingsRepository(), []);
  const [amount, setAmount] = useState("");
  const [saleSource, setSaleSource] = useState<"sanany_chat" | "outside_sanany" | "cancelled" | "other">("outside_sanany");
  const [saleSourceOther, setSaleSourceOther] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [uiState, setUiState] = useState<SaleUiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<ListingSaleInvoice | null>(null);
  const isRtl = direction === "rtl";

  useEffect(() => {
    if (!visible || !listing) {
      return;
    }
    setAmount(preview?.amount ?? String(Math.max(1, payment?.finalSaleAmount ?? listing.price ?? 0)));
    setSaleSource(payment?.saleSource ?? "outside_sanany");
    setSaleSourceOther(payment?.saleSourceOther ?? "");
    setBuyerName(payment?.buyerName ?? "");
    setBuyerPhone(payment?.buyerPhone ?? "");
    setIsConfirmed(preview?.isConfirmed ?? false);
    setUiState(preview?.uiState ?? (payment?.paymentStatus === "paid" ? "success" : "idle"));
    setIsWorking(false);
    setErrorMessage(null);
    setInvoice(preview?.invoice ?? null);
  }, [listing, payment, preview, visible]);

  useEffect(() => {
    if (preview || !visible || !listing || !sellerId || payment?.paymentStatus !== "paid") {
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
  }, [listing, payment?.paymentStatus, preview, repository, sellerId, visible]);

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
      saleSource,
      saleSourceOther: saleSourceOther.trim() || null,
      buyerName: buyerName.trim() || null,
      buyerPhone: buyerPhone.trim() || null
    });
    onPaymentUpdated(nextPayment);
    return nextPayment;
  };

  const completePayment = async () => {
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
    if (saleSource === "other" && !saleSourceOther.trim()) {
      setErrorMessage(t("myAds.saleFlow.missingOtherSaleSource"));
      return;
    }

    setIsWorking(true);
    setUiState("pending");
    setErrorMessage(null);

    try {
      if (saleSource === "cancelled") {
        await preparePayment();
        const nextPayment = await repository.finalizeSalePayment({
          listingId: listing.id,
          sellerId,
          outcome: "cancelled",
          paymentMethod: DEFAULT_MARKETPLACE_PAYMENT_METHOD
        });
        onPaymentUpdated(nextPayment);
        setUiState("cancelled");
      } else {
        const nextPayment = await preparePayment();
        onPaymentUpdated(nextPayment);
        setUiState("idle");
        setErrorMessage(t("myAds.saleFlow.tapWebOnlyHint"));
      }
    } catch (error) {
      setUiState("failed");
      setErrorMessage(error instanceof Error ? error.message : t("marketplace.loadError"));
    } finally {
      setIsWorking(false);
    }
  };

  const cancelPayment = async () => {
    if (preview) {
      return;
    }
    if (!listing || !sellerId) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      await (payment ?? preparePayment());
      const nextPayment = await repository.finalizeSalePayment({
        listingId: listing.id,
        sellerId,
        outcome: "cancelled",
        paymentMethod: DEFAULT_MARKETPLACE_PAYMENT_METHOD
      });
      onPaymentUpdated(nextPayment);
      setUiState("cancelled");
    } catch (error) {
      setUiState("failed");
      setErrorMessage(error instanceof Error ? error.message : t("marketplace.loadError"));
    } finally {
      setIsWorking(false);
    }
  };

  const downloadInvoice = async () => {
    if (!invoice || !FileSystem.documentDirectory) {
      return;
    }

    try {
      const fileUri = `${FileSystem.documentDirectory}${invoice.payment.invoiceNumber ?? invoice.listingId}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, buildInvoiceText(invoice, language, t));
      setErrorMessage(t("myAds.saleFlow.invoiceSaved"));
    } catch {
      setErrorMessage(t("myAds.saleFlow.invoiceSaveFailed"));
    }
  };

  const shareInvoice = async () => {
    if (!invoice) {
      return;
    }
    try {
      await Share.share({ message: buildInvoiceText(invoice, language, t), title: invoice.listingTitle });
    } catch {
      setErrorMessage(t("myAds.saleFlow.invoiceShareFailed"));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="sale-completion-modal">
          <View style={[styles.header, isRtl ? styles.headerRtl : undefined]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.heading")}</Text>
              <Text style={[styles.subtitle, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.subtitle")}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeLabel}>{t("common.close")}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {listing ? (
              <>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryLabel, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.listedPrice")}</Text>
                  <Text style={[styles.summaryTitle, { textAlign: isRtl ? "right" : "left" }]}>{listing.title}</Text>
                  <Text style={[styles.summaryValue, { textAlign: isRtl ? "right" : "left" }]}>{formatCurrencySar(listing.price, language)}</Text>
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={[styles.fieldLabel, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.saleSourceLabel")}</Text>
                  <View style={[styles.saleSourceGrid, isRtl ? styles.headerRtl : undefined]}>
                    {(["sanany_chat", "outside_sanany", "cancelled", "other"] as const).map((source) => (
                      <Pressable
                        key={source}
                        style={[styles.saleSourceButton, saleSource === source ? styles.saleSourceButtonActive : undefined]}
                        onPress={() => setSaleSource(source)}
                      >
                        <Text style={[styles.saleSourceLabel, saleSource === source ? styles.saleSourceLabelActive : undefined]}>
                          {t(`myAds.saleFlow.saleSources.${source}`)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {saleSource === "other" ? (
                    <TextInput
                      value={saleSourceOther}
                      onChangeText={setSaleSourceOther}
                      placeholder={t("myAds.saleFlow.otherSaleSourcePlaceholder")}
                      style={[styles.input, { textAlign: isRtl ? "right" : "left" }]}
                    />
                  ) : null}
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={[styles.fieldLabel, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.amountLabel")}</Text>
                  <TextInput
                    value={amount}
                    onChangeText={(value) => setAmount(value.replace(/[^\d.]/g, ""))}
                    keyboardType="decimal-pad"
                    placeholder={t("myAds.saleFlow.amountPlaceholder")}
                    style={[styles.input, { textAlign: isRtl ? "right" : "left" }]}
                  />
                  <Text style={[styles.helperText, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.amountHelper")}</Text>
                </View>
                <View style={styles.fieldBlock}>
                  <Text style={[styles.fieldLabel, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.buyerNameLabel")}</Text>
                  <TextInput value={buyerName} onChangeText={setBuyerName} placeholder={t("myAds.saleFlow.buyerNamePlaceholder")} style={[styles.input, { textAlign: isRtl ? "right" : "left" }]} />
                </View>
                <View style={styles.fieldBlock}>
                  <Text style={[styles.fieldLabel, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.buyerPhoneLabel")}</Text>
                  <TextInput
                    value={buyerPhone}
                    onChangeText={setBuyerPhone}
                    placeholder={t("myAds.saleFlow.buyerPhonePlaceholder")}
                    keyboardType="phone-pad"
                    style={[styles.input, { textAlign: isRtl ? "right" : "left" }]}
                  />
                </View>

                <View style={styles.summaryGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{t("myAds.saleFlow.amountLabel")}</Text>
                    <Text style={styles.metricValue}>{formatCurrencySar(calculation.finalSaleAmount, language)}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{t("myAds.saleFlow.commissionRate")}</Text>
                    <Text style={styles.metricValue}>{calculation.commissionRatePercent}%</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{t("myAds.saleFlow.commissionAmount")}</Text>
                    <Text style={styles.metricValue}>{formatCurrencySar(calculation.commissionAmount, language)}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{t("myAds.saleFlow.totalToPay")}</Text>
                    <Text style={styles.metricValue}>{formatCurrencySar(calculation.totalToPayNow, language)}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{t("myAds.saleFlow.youWillReceive")}</Text>
                    <Text style={styles.metricValue}>{formatCurrencySar(calculation.sellerNetAmount, language)}</Text>
                  </View>
                </View>

                <Pressable style={[styles.confirmRow, isRtl ? styles.headerRtl : undefined]} onPress={() => setIsConfirmed((current) => !current)}>
                  <View style={[styles.checkbox, isConfirmed ? styles.checkboxActive : undefined]} />
                  <Text style={[styles.confirmLabel, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.confirmLabel")}</Text>
                </Pressable>

                {uiState === "pending" ? <Text style={[styles.pendingText, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.pendingHint")}</Text> : null}
                {uiState === "cancelled" ? <Text style={[styles.infoText, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.cancelledHint")}</Text> : null}
                {uiState === "success" ? <Text style={[styles.successText, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.successBanner")}</Text> : null}
                {errorMessage ? (
                  <Text
                    style={[
                      uiState === "success" ? styles.successText : uiState === "failed" ? styles.errorText : styles.infoText,
                      { textAlign: isRtl ? "right" : "left" }
                    ]}
                  >
                    {errorMessage}
                  </Text>
                ) : null}

                {invoice ? (
                  <View style={styles.invoiceCard}>
                    <Text style={[styles.summaryTitle, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.invoiceTitle")}</Text>
                    <Text style={[styles.helperText, { textAlign: isRtl ? "right" : "left" }]}>{t("myAds.saleFlow.invoiceDescription")}</Text>
                    <Text style={[styles.helperText, { textAlign: isRtl ? "right" : "left" }]}>{`${t("myAds.saleFlow.invoiceNumber")}: ${invoice.payment.invoiceNumber ?? "-"}`}</Text>
                    <Text style={[styles.helperText, { textAlign: isRtl ? "right" : "left" }]}>{`${t("myAds.saleFlow.transactionReference")}: ${invoice.payment.transactionReference ?? "-"}`}</Text>
                    <View style={[styles.actionsRow, isRtl ? styles.headerRtl : undefined]}>
                      <Pressable style={styles.secondaryButton} onPress={() => void downloadInvoice()}>
                        <Text style={styles.secondaryLabel}>{t("myAds.saleFlow.invoiceDownload")}</Text>
                      </Pressable>
                      <Pressable style={styles.secondaryButton} onPress={() => void shareInvoice()}>
                        <Text style={styles.secondaryLabel}>{t("myAds.saleFlow.invoiceShare")}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, isRtl ? styles.headerRtl : undefined]}>
            <Pressable style={styles.secondaryButton} onPress={() => void cancelPayment()} disabled={Boolean(preview) || isWorking || uiState === "success"}>
              <Text style={styles.secondaryLabel}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, Boolean(preview) || isWorking || uiState === "success" ? styles.primaryButtonDisabled : undefined]}
              onPress={() => void completePayment()}
              disabled={Boolean(preview) || isWorking || uiState === "success"}
            >
              <Text style={styles.primaryLabel}>
                {isWorking
                  ? t("myAds.saleFlow.preparing")
                  : saleSource === "cancelled"
                    ? t("myAds.saleFlow.saveCancellation")
                    : t("myAds.saleFlow.completeOnWebButton")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.38)"
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#ffffff"
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 18
  },
  headerRtl: {
    flexDirection: "row-reverse"
  },
  headerCopy: {
    flex: 1
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: "#475569"
  },
  closeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  closeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 22
  },
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b"
  },
  summaryTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: "800",
    color: "#0f766e"
  },
  fieldBlock: {
    gap: 8
  },
  saleSourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  saleSourceButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  saleSourceButtonActive: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5"
  },
  saleSourceLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  saleSourceLabelActive: {
    color: "#0f766e"
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a"
  },
  input: {
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0f172a"
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 14
  },
  metricLabel: {
    fontSize: 11,
    color: "#64748b"
  },
  metricValue: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14
  },
  checkbox: {
    marginTop: 2,
    height: 18,
    width: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#94a3b8",
    backgroundColor: "#ffffff"
  },
  checkboxActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  confirmLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#334155"
  },
  pendingText: {
    borderRadius: 18,
    backgroundColor: "#fffbeb",
    padding: 14,
    fontSize: 13,
    lineHeight: 20,
    color: "#92400e"
  },
  errorText: {
    borderRadius: 18,
    backgroundColor: "#fef2f2",
    padding: 14,
    fontSize: 13,
    lineHeight: 20,
    color: "#b91c1c"
  },
  successText: {
    borderRadius: 18,
    backgroundColor: "#ecfdf5",
    padding: 14,
    fontSize: 13,
    lineHeight: 20,
    color: "#047857"
  },
  infoText: {
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    padding: 14,
    fontSize: 13,
    lineHeight: 20,
    color: "#334155"
  },
  invoiceCard: {
    gap: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    padding: 18
  },
  secondaryButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  secondaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569"
  },
  primaryButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#0f766e",
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryLabel: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff"
  }
});
