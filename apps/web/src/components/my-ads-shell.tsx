"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  CarAdType,
  CarCondition,
  CarFuelType,
  CarPriceMode,
  ListingCategory,
  ListingOfferType,
  ListingSalePayment,
  ListingStatus,
  MarketplaceCommissionSettings,
  MarketplaceListing,
  PaginatedResult
} from "@sanany/types";
import {
  CAR_AD_TYPES,
  CAR_CONDITIONS,
  CAR_FUEL_TYPES,
  CAR_PRICE_MODES,
  LISTING_OFFER_TYPES
} from "@sanany/types";
import {
  buildCarModelOptions,
  buildCarYearsRange,
  buildListingImageStoragePath,
  CAR_MAKE_IDS,
  clearDraftSyncOperations,
  formatCurrencySar,
  computeListingQualityScore,
  createDraftSyncOperation,
  createListingImageUploadItem,
  enqueueDraftSyncOperation,
  extractListingImageStoragePath,
  getFailedListingImageUploads,
  hasPendingDraftSyncOperations,
  hasPendingListingImageUploads,
  isListingActiveForSaleCompletion,
  isSectionBackedByMobileStatus,
  LISTING_MANAGEMENT_SECTIONS,
  markListingImageForRetry,
  matchesListingManagementSection,
  normalizeListingImageOrder,
  OTHER_CAR_MODEL_ID,
  parseListingImageUrls,
  serializeListingImageUrls,
  shouldShowSaleCompletionAction,
  shouldCreateDraftConflict,
  toCreateListingImageInputs,
  type DraftRemoteConflict,
  type DraftSyncOperation,
  type ListingImageUploadItem,
  type ListingManagementSection
} from "@sanany/shared";
import { Card } from "@sanany/ui";
import { defaultLanguage, isSupportedLanguage } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { RequireAuth } from "../auth/guards";
import { getWebListingsRepository } from "../lib/listings-repository";
import { getWebSupabaseClient } from "../lib/supabase-client";
import { ListingCard } from "./listing-card";
import { MyAdsSaleCompletion } from "./my-ads-sale-completion";

type MyAdsShellProps = {
  language: string;
  tapPaymentReturn?: {
    tapId: string;
    listingId: string;
  } | null;
};

type AddStep = "category" | "details" | "preview" | "agreement";
type SelectedImage = ListingImageUploadItem;
type ListingDraftSnapshot = {
  editingListingId: string | null;
  currentStepIndex: number;
  offerType: ListingOfferType | null;
  category: ListingCategory | null;
  title: string;
  description: string;
  extraDetails: string;
  price: string;
  carBrand: string | null;
  carModelOption: string | null;
  carModelOther: string;
  carYear: string | null;
  carLocation: string;
  carMileage: string;
  carAdType: CarAdType;
  carCondition: CarCondition;
  carFuelType: CarFuelType;
  carPriceMode: CarPriceMode;
  selectedImages: SelectedImage[];
  isAgreementAccepted: boolean;
  pendingSyncOperations: DraftSyncOperation[];
  lastSyncedRemoteAt: string | null;
  remoteConflict: DraftRemoteConflict | null;
  updatedAt: string;
};

const ADD_STEPS: AddStep[] = ["category", "details", "preview", "agreement"];
const LISTING_PAGE_SIZE = 12;
const MAX_IMAGE_COUNT = 10;
const MIN_IMAGE_COUNT = 1;
const IDEAL_IMAGE_COUNT = 5;
const DRAFT_STORAGE_KEY_PREFIX = "sanany:web-add-listing-draft";
const CATEGORIES_BY_TYPE: Record<ListingOfferType, ListingCategory[]> = {
  sell: [
    "carSale",
    "carPartsAndServices",
    "truckAndHeavy",
    "bikeSale",
    "propertySale",
    "deviceSale",
    "furnitureSale",
    "livestockSale",
    "mobileSale",
    "laptopSale",
    "homeAppliancesSale",
    "toolsEquipmentSale",
    "clothingSale",
    "kidsSuppliesSale",
    "electronicPartsSale",
    "generalGoods",
    "saleOther"
  ],
  rent: ["propertyRent", "truckAndHeavy", "carRent", "eventEquipmentRent", "constructionToolsRent", "chaletRent", "warehouseRent", "cameraGearRent", "rentOther"],
  service: [
    "serviceOffer",
    "carPartsAndServices",
    "cleaningService",
    "homeMaintenanceService",
    "electricalPlumbingService",
    "movingService",
    "designTechService",
    "photoVideoService",
    "deliveryService",
    "womenServices",
    "studentServices",
    "serviceOther"
  ],
  request: ["requestGoods", "requestPurchase", "requestRent", "requestHomeService", "requestTechService", "requestUrgentMaintenance", "requestOther"]
};

function buildDraftStorageKey(userId: string): string {
  return `${DRAFT_STORAGE_KEY_PREFIX}:${userId}`;
}

function clampStepIndex(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value >= ADD_STEPS.length) {
    return ADD_STEPS.length - 1;
  }
  return value;
}

function formatRelativeMinutes(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const savedAt = new Date(value).getTime();
  if (Number.isNaN(savedAt)) {
    return null;
  }
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.round((now - savedAt) / 60000));
  return String(diffMinutes);
}

function createImageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeImages(items: SelectedImage[]): SelectedImage[] {
  return normalizeListingImageOrder(items.map((item, index) => ({ ...item, isPrimary: index === 0, sortOrder: index })));
}

function updateSelectedImageState(items: SelectedImage[], localId: string, patch: Partial<SelectedImage>): SelectedImage[] {
  return normalizeImages(items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
}

function parseImageFilesToDataUrls(files: File[]): Promise<Array<{ uri: string; fileSize: number; mimeType: string }>> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<{ uri: string; fileSize: number; mimeType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("read-failed"));
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve({
                uri: reader.result,
                fileSize: file.size,
                mimeType: file.type || "image/jpeg"
              });
              return;
            }
            reject(new Error("invalid-image"));
          };
          reader.readAsDataURL(file);
        })
    )
  );
}

async function compressImageDataUrl(input: { dataUrl: string; mimeType?: string }) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("image-load-failed"));
    nextImage.src = input.dataUrl;
  });

  const maxDimension = 1600;
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas-context-missing");
  }
  context.drawImage(image, 0, 0, width, height);

  const mimeType = input.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error("image-compress-failed"));
          return;
        }
        resolve(nextBlob);
      },
      mimeType,
      mimeType === "image/png" ? undefined : 0.82
    );
  });

  return {
    blob,
    width,
    height,
    mimeType: blob.type || mimeType
  };
}

export function MyAdsShell({ language, tapPaymentReturn: initialTapPaymentReturn = null }: MyAdsShellProps) {
  const { t } = useTranslation();
  const { snapshot } = useAuth();
  const repository = useMemo(() => getWebListingsRepository(), []);
  const resolvedLanguage = isSupportedLanguage(language) ? language : defaultLanguage;
  const [section, setSection] = useState<ListingManagementSection>("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<PaginatedResult<MarketplaceListing>>({
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: LISTING_PAGE_SIZE,
    totalPages: 1
  });
  const [salePayments, setSalePayments] = useState<ListingSalePayment[]>([]);
  const [commissionSettings, setCommissionSettings] = useState<MarketplaceCommissionSettings | null>(null);
  const [selectedSaleListingId, setSelectedSaleListingId] = useState<string | null>(null);
  const [tapPaymentReturn, setTapPaymentReturn] = useState<{
    tapId: string;
    listingId: string;
  } | null>(initialTapPaymentReturn);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [offerType, setOfferType] = useState<ListingOfferType | null>(null);
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [extraDetails, setExtraDetails] = useState("");
  const [price, setPrice] = useState("");
  const [carBrand, setCarBrand] = useState<string | null>(null);
  const [carModelOption, setCarModelOption] = useState<string | null>(null);
  const [carModelOther, setCarModelOther] = useState("");
  const [carYear, setCarYear] = useState<string | null>(null);
  const [carLocation, setCarLocation] = useState("");
  const [carMileage, setCarMileage] = useState("");
  const [carAdType, setCarAdType] = useState<CarAdType>("sell");
  const [carCondition, setCarCondition] = useState<CarCondition>("new");
  const [carFuelType, setCarFuelType] = useState<CarFuelType>("hybrid");
  const [carPriceMode, setCarPriceMode] = useState<CarPriceMode>("fixed");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isAgreementAccepted, setIsAgreementAccepted] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [pendingSyncOperations, setPendingSyncOperations] = useState<DraftSyncOperation[]>([]);
  const [lastSyncedRemoteAt, setLastSyncedRemoteAt] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<DraftRemoteConflict | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [dragImageId, setDragImageId] = useState<string | null>(null);

  const currentStep = ADD_STEPS[currentStepIndex];
  const selectedTypeCategories = offerType ? CATEGORIES_BY_TYPE[offerType] : [];
  const parsedPrice = Number(price);
  const validPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;
  const isCarSaleCategory = category === "carSale";
  const shouldShowPriceInput = !isCarSaleCategory || carPriceMode === "fixed";
  const draftStorageKey = snapshot.user?.id ? buildDraftStorageKey(snapshot.user.id) : null;
  const qualityScore = computeListingQualityScore({
    title,
    description,
    imageCount: selectedImages.length,
    hasCategory: Boolean(category),
    hasOfferType: Boolean(offerType),
    hasPrice: shouldShowPriceInput ? validPrice > 0 : true,
    hasCarLocation: carLocation.trim().length > 0,
    isCarSaleCategory
  });
  const qualityTone =
    qualityScore >= 80 ? "bg-emerald-100 text-emerald-700" : qualityScore >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  const getStepLabel = (step: AddStep) => {
    if (step === "category") {
      return t("marketplace.create.flow.categoryTitle");
    }
    if (step === "details") {
      return t("marketplace.create.flow.detailsTitle");
    }
    if (step === "preview") {
      return t("marketplace.create.flow.previewTitle");
    }
    return t("marketplace.create.flow.agreementTitle");
  };
  const carModelOptions = useMemo(() => {
    if (!carBrand) {
      return [];
    }
    try {
      return buildCarModelOptions(carBrand as Parameters<typeof buildCarModelOptions>[0]);
    } catch {
      return [];
    }
  }, [carBrand]);
  const carYears = useMemo(() => buildCarYearsRange(), []);
  const selectedSaleListing = useMemo(
    () => data.items.find((item) => item.id === selectedSaleListingId) ?? null,
    [data.items, selectedSaleListingId]
  );
  const visibleListings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.items.filter((listing) => {
      if (!matchesListingManagementSection(listing, section)) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = `${listing.title} ${listing.description ?? ""} ${listing.locationName ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [data.items, search, section]);
  const visibleData = useMemo(() => {
    const totalItems = visibleListings.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / LISTING_PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * LISTING_PAGE_SIZE;
    return {
      items: visibleListings.slice(from, from + LISTING_PAGE_SIZE),
      totalItems,
      page: safePage,
      pageSize: LISTING_PAGE_SIZE,
      totalPages
    };
  }, [page, visibleListings]);
  const buildDraftSnapshot = (operations = pendingSyncOperations, conflict = draftConflict): ListingDraftSnapshot => ({
    editingListingId,
    currentStepIndex,
    offerType,
    category,
    title,
    description,
    extraDetails,
    price,
    carBrand,
    carModelOption,
    carModelOther,
    carYear,
    carLocation,
    carMileage,
    carAdType,
    carCondition,
    carFuelType,
    carPriceMode,
    selectedImages,
    isAgreementAccepted,
    pendingSyncOperations: operations,
    lastSyncedRemoteAt,
    remoteConflict: conflict,
    updatedAt: new Date().toISOString()
  });

  const listingDescriptionForSubmit = useMemo(() => {
    const base = description.trim();
    const meta: string[] = [];
    if (offerType) {
      meta.push(`${t("marketplace.create.typeLabel")}: ${t(`marketplace.create.offerTypes.${offerType}`)}`);
    }
    if (category) {
      meta.push(`${t("marketplace.create.flow.previewCategoryLabel")}: ${t(`marketplace.create.categories.${category}`)}`);
    }
    if (isCarSaleCategory) {
      meta.push(t("marketplace.create.carDetails.structuredTitle"));
      meta.push(`- ${t("marketplace.create.carDetails.locationLabel")}: ${carLocation.trim() || "-"}`);
      meta.push(`- ${t("marketplace.create.carDetails.mileageLabel")}: ${carMileage.trim() || "-"}`);
      meta.push(`- ${t("marketplace.create.carDetails.adTypeLabel")}: ${t(`marketplace.create.carDetails.adTypeOptions.${carAdType}`)}`);
      meta.push(`- ${t("marketplace.create.carDetails.conditionLabel")}: ${t(`marketplace.create.carDetails.conditionOptions.${carCondition}`)}`);
      meta.push(`- ${t("marketplace.create.carDetails.fuelLabel")}: ${t(`marketplace.create.carDetails.fuelOptions.${carFuelType}`)}`);
      meta.push(`- ${t("marketplace.create.carDetails.priceModeLabel")}: ${t(`marketplace.create.carDetails.priceModeOptions.${carPriceMode}`)}`);
    } else if (extraDetails.trim()) {
      meta.push(extraDetails.trim());
    }
    if (meta.length === 0) {
      return base;
    }
    if (!base) {
      return meta.join("\n");
    }
    return `${base}\n\n${meta.join("\n")}`;
  }, [carAdType, carCondition, carFuelType, carLocation, carMileage, carPriceMode, category, description, extraDetails, isCarSaleCategory, offerType, t]);

  const loadManagementData = useCallback(async () => {
    if (!snapshot.user?.id) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [listingsResult, paymentsResult, settingsResult] = await Promise.all([
        repository.listByOwner(snapshot.user.id, {
          search: "",
          status: "all",
          sort: "newest",
          page: 1,
          pageSize: 120
        }),
        repository.listSalePaymentsBySeller(snapshot.user.id),
        repository.getCommissionSettings()
      ]);

      setData(listingsResult);
      setSalePayments(paymentsResult);
      setCommissionSettings(settingsResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("marketplace.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [repository, snapshot.user?.id, t]);

  useEffect(() => {
    if (!snapshot.user?.id) {
      return;
    }
    if (!isSectionBackedByMobileStatus(section)) {
      setData({ items: [], totalItems: 0, page: 1, pageSize: LISTING_PAGE_SIZE, totalPages: 1 });
      setSalePayments([]);
      setCommissionSettings(null);
      setIsLoading(false);
      return;
    }

    void loadManagementData();
  }, [loadManagementData, section, snapshot.user?.id]);

  useEffect(() => {
    setTapPaymentReturn(initialTapPaymentReturn);
  }, [initialTapPaymentReturn]);

  useEffect(() => {
    if (!tapPaymentReturn?.listingId) {
      return;
    }
    setSelectedSaleListingId(tapPaymentReturn.listingId);
  }, [tapPaymentReturn]);

  useEffect(() => {
    setPage(1);
  }, [section]);

  useEffect(() => {
    if (!draftStorageKey) {
      return;
    }
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) {
      return;
    }
    try {
      const draft = JSON.parse(raw) as ListingDraftSnapshot;
      setEditingListingId(draft.editingListingId);
      setCurrentStepIndex(clampStepIndex(draft.currentStepIndex));
      setOfferType(draft.offerType);
      setCategory(draft.category);
      setTitle(draft.title);
      setDescription(draft.description);
      setExtraDetails(draft.extraDetails);
      setPrice(draft.price);
      setCarBrand(draft.carBrand);
      setCarModelOption(draft.carModelOption);
      setCarModelOther(draft.carModelOther);
      setCarYear(draft.carYear);
      setCarLocation(draft.carLocation);
      setCarMileage(draft.carMileage);
      setCarAdType(draft.carAdType);
      setCarCondition(draft.carCondition);
      setCarFuelType(draft.carFuelType);
      setCarPriceMode(draft.carPriceMode);
      // Restore images but reset failed ones so user can retry
      setSelectedImages(
        (draft.selectedImages ?? []).map((img) =>
          img.status === "failed" ? { ...img, status: "pending", error: undefined, progress: 0 } : img
        )
      );
      setIsAgreementAccepted(draft.isAgreementAccepted);
      setPendingSyncOperations(Array.isArray(draft.pendingSyncOperations) ? draft.pendingSyncOperations : []);
      setLastSyncedRemoteAt(draft.lastSyncedRemoteAt ?? null);
      setDraftConflict(draft.remoteConflict ?? null);
      setDraftSavedAt(draft.updatedAt);
      setActionMessage(t("myAds.form.draftRestored"));
    } catch {
      setActionMessage(null);
    }
  }, [draftStorageKey, t]);

  const resetForm = () => {
    setEditingListingId(null);
    setCurrentStepIndex(0);
    setOfferType(null);
    setCategory(null);
    setTitle("");
    setDescription("");
    setExtraDetails("");
    setPrice("");
    setCarBrand(null);
    setCarModelOption(null);
    setCarModelOther("");
    setCarYear(null);
    setCarLocation("");
    setCarMileage("");
    setCarAdType("sell");
    setCarCondition("new");
    setCarFuelType("hybrid");
    setCarPriceMode("fixed");
    setSelectedImages([]);
    setIsAgreementAccepted(false);
    setPendingSyncOperations([]);
    setLastSyncedRemoteAt(null);
    setDraftConflict(null);
    setDraftSavedAt(null);
  };

  const ensureUploadedImages = async () => {
    if (!snapshot.user?.id) {
      throw new Error(t("marketplace.create.errors.authRequired"));
    }

    const client = getWebSupabaseClient();
    let nextItems = normalizeImages(selectedImages);

    for (const item of nextItems) {
      if (item.status === "uploaded" && item.storagePath && item.publicUrl) {
        continue;
      }

      nextItems = updateSelectedImageState(nextItems, item.localId, { status: "compressing", error: undefined, progress: 10 });
      setSelectedImages(nextItems);

      try {
        const compressed = await compressImageDataUrl({
          dataUrl: item.localUri ?? item.previewUri,
          mimeType: item.mimeType
        });
        const storagePath = item.storagePath ?? buildListingImageStoragePath({
          ownerId: snapshot.user.id,
          localId: item.localId,
          mimeType: compressed.mimeType,
          uri: item.previewUri
        });

        nextItems = updateSelectedImageState(nextItems, item.localId, { status: "uploading", progress: 55, storagePath });
        setSelectedImages(nextItems);

        // Upload via server-side API route (bypasses storage RLS)
        const formData = new FormData();
        formData.append("file", compressed.blob, `image.${compressed.mimeType.split("/")[1] ?? "jpg"}`);
        formData.append("storagePath", storagePath);

        const uploadResponse = await fetch("/api/listings/upload-image", {
          method: "POST",
          body: formData
        });

        if (!uploadResponse.ok) {
          const errBody = await uploadResponse.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errBody.error ?? "Upload failed");
        }

        const uploadResult = await uploadResponse.json() as { publicUrl: string; storagePath: string };

        nextItems = updateSelectedImageState(nextItems, item.localId, {
          status: "uploaded",
          progress: 100,
          storagePath: uploadResult.storagePath,
          publicUrl: uploadResult.publicUrl,
          previewUri: uploadResult.publicUrl,
          width: compressed.width,
          height: compressed.height,
          fileSize: compressed.blob.size,
          mimeType: compressed.mimeType,
          error: undefined
        });
        setSelectedImages(nextItems);
      } catch (error) {
        const message = error instanceof Error
            ? error.message
            : t("marketplace.create.images.imagePickFailed");
        nextItems = updateSelectedImageState(nextItems, item.localId, {
          status: "failed",
          progress: 0,
          error: message
        });
        setSelectedImages(nextItems);
        throw new Error(message);
      }
    }

    return nextItems;
  };

  const persistDraftSnapshot = (snapshotPayload: ListingDraftSnapshot) => {
    if (draftStorageKey) {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(snapshotPayload));
    }
    setDraftSavedAt(snapshotPayload.updatedAt);
  };

  const fetchRemoteDraftUpdatedAt = async (listingId: string) => {
    const { data, error } = await getWebSupabaseClient().from("listings").select("updated_at").eq("id", listingId).maybeSingle();
    if (error) {
      throw error;
    }
    return typeof data?.updated_at === "string" ? data.updated_at : null;
  };

  const syncDraftToRemote = async (options?: { force?: boolean }) => {
    if (!snapshot.user?.id) {
      return null;
    }

    if (editingListingId && !options?.force) {
      const remoteUpdatedAt = await fetchRemoteDraftUpdatedAt(editingListingId);
      if (
        shouldCreateDraftConflict({
          remoteUpdatedAt,
          lastSyncedRemoteAt,
          pendingOperationsCount: pendingSyncOperations.length
        })
      ) {
        const conflictState: DraftRemoteConflict = {
          detectedAt: new Date().toISOString(),
          remoteUpdatedAt: remoteUpdatedAt as string,
          lastSyncedRemoteAt
        };
        setDraftConflict(conflictState);
        persistDraftSnapshot(buildDraftSnapshot(pendingSyncOperations, conflictState));
        return null;
      }
    }

    const uploadedImages = await ensureUploadedImages();
    const imageUrls = uploadedImages.map((item) => item.publicUrl).filter((value): value is string => typeof value === "string");
    const remoteDraft = await repository.saveDraft({
      id: editingListingId ?? undefined,
      ownerId: snapshot.user.id,
      offerType: offerType ?? null,
      categorySlug: category ?? null,
      title: title.trim() || t("marketplace.create.flow.previewFallbackTitle"),
      description: listingDescriptionForSubmit || "-",
      price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 1,
      imageUrl: serializeListingImageUrls(imageUrls) ?? undefined,
      images: toCreateListingImageInputs(uploadedImages),
      status: "draft",
      locationName: isCarSaleCategory ? carLocation.trim() || t("marketplace.create.defaultLocation") : t("marketplace.create.defaultLocation"),
      latitude: 24.7136,
      longitude: 46.6753
    });

    setEditingListingId(remoteDraft.id);
    setPendingSyncOperations(clearDraftSyncOperations());
    setLastSyncedRemoteAt(remoteDraft.updatedAt ?? new Date().toISOString());
    setDraftConflict(null);
    const syncedSnapshot = buildDraftSnapshot(clearDraftSyncOperations(), null);
    syncedSnapshot.editingListingId = remoteDraft.id;
    syncedSnapshot.lastSyncedRemoteAt = remoteDraft.updatedAt ?? syncedSnapshot.updatedAt;
    persistDraftSnapshot(syncedSnapshot);
    return remoteDraft;
  };

  const saveDraft = async () => {
    if (!snapshot.user?.id) {
      return;
    }
    setIsSavingDraft(true);
    setErrorMessage(null);
    setActionMessage(null);
    const queuedOperations = enqueueDraftSyncOperation(pendingSyncOperations, createDraftSyncOperation("saveDraft"));
    setPendingSyncOperations(queuedOperations);
    const payload = buildDraftSnapshot(queuedOperations, null);
    persistDraftSnapshot(payload);
    try {
      const remoteDraft = await syncDraftToRemote();
      setActionMessage(t("marketplace.create.draft.savedAt", { value: formatRelativeMinutes(payload.updatedAt) ?? "0" }));
      if (remoteDraft) {
        setEditingListingId(remoteDraft.id);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("marketplace.create.draft.saveFailed"));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const validateCurrentStep = (): string | null => {
    if (currentStep === "category") {
      if (!offerType) {
        return "marketplace.create.errors.offerTypeRequired";
      }
      if (!category) {
        return "marketplace.create.errors.categoryRequired";
      }
    }

    if (currentStep === "details") {
      if (!title.trim()) {
        return "marketplace.create.errors.titleRequired";
      }
      if (shouldShowPriceInput && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
        return "marketplace.create.errors.priceInvalid";
      }
      if (selectedImages.length < MIN_IMAGE_COUNT) {
        return "marketplace.create.errors.imagesMinimumRequired";
      }
      if (isCarSaleCategory && !carLocation.trim()) {
        return "marketplace.create.errors.carLocationRequired";
      }
      if (isCarSaleCategory && !carBrand) {
        return "marketplace.create.errors.carBrandRequired";
      }
      if (isCarSaleCategory && !carModelOption) {
        return "marketplace.create.errors.carModelOptionRequired";
      }
      if (isCarSaleCategory && carModelOption === OTHER_CAR_MODEL_ID && !carModelOther.trim()) {
        return "marketplace.create.errors.carModelOtherRequired";
      }
      if (isCarSaleCategory && !carYear) {
        return "marketplace.create.errors.carYearRequired";
      }
    }

    if (currentStep === "agreement" && !isAgreementAccepted) {
      return "marketplace.create.errors.agreementRequired";
    }

    return null;
  };

  const goNext = () => {
    const errorKey = validateCurrentStep();
    if (errorKey) {
      setErrorMessage(t(errorKey));
      return;
    }
    setErrorMessage(null);
    setCurrentStepIndex((current) => clampStepIndex(current + 1));
  };

  const goBack = () => {
    setErrorMessage(null);
    setCurrentStepIndex((current) => clampStepIndex(current - 1));
  };

  const onImageInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) {
      return;
    }
    try {
      const parsed = await parseImageFilesToDataUrls(files);
      setSelectedImages((current) => {
        const room = Math.max(0, MAX_IMAGE_COUNT - current.length);
        const accepted = parsed.slice(0, room);
        const merged = [
          ...current,
          ...accepted.map((item) =>
            createListingImageUploadItem({
              localId: createImageId(),
              localUri: item.uri,
              previewUri: item.uri,
              fileSize: item.fileSize,
              mimeType: item.mimeType
            })
          )
        ];
        return normalizeImages(merged);
      });
      if (files.length + selectedImages.length > MAX_IMAGE_COUNT) {
        setErrorMessage(t("marketplace.create.images.maxReached", { max: MAX_IMAGE_COUNT }));
      } else {
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage(t("marketplace.create.images.imagePickFailed"));
    } finally {
      event.target.value = "";
    }
  };

  const onDropImages = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      return;
    }
    try {
      const parsed = await parseImageFilesToDataUrls(files);
      setSelectedImages((current) => {
        const room = Math.max(0, MAX_IMAGE_COUNT - current.length);
        const accepted = parsed.slice(0, room);
        const merged = [
          ...current,
          ...accepted.map((item) =>
            createListingImageUploadItem({
              localId: createImageId(),
              localUri: item.uri,
              previewUri: item.uri,
              fileSize: item.fileSize,
              mimeType: item.mimeType
            })
          )
        ];
        return normalizeImages(merged);
      });
    } catch {
      setErrorMessage(t("marketplace.create.images.imagePickFailed"));
    }
  };

  const removeImage = (id: string) => {
    setSelectedImages((current) => normalizeImages(current.filter((item) => item.localId !== id)));
  };

  const retryImageUpload = (id: string) => {
    setSelectedImages((current) => markListingImageForRetry(current, id));
    setErrorMessage(null);
  };

  const setPrimaryImage = (id: string) => {
    setSelectedImages((current) => {
      const index = current.findIndex((item) => item.localId === id);
      if (index < 0) {
        return current;
      }
      const next = [...current];
      const [target] = next.splice(index, 1);
      if (!target) {
        return current;
      }
      next.unshift(target);
      return normalizeImages(next);
    });
  };

  const onDragStartImage = (id: string) => {
    setDragImageId(id);
  };

  const onDropImage = (targetId: string) => {
    if (!dragImageId || dragImageId === targetId) {
      return;
    }
    setSelectedImages((current) => {
      const from = current.findIndex((item) => item.localId === dragImageId);
      const to = current.findIndex((item) => item.localId === targetId);
      if (from < 0 || to < 0) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) {
        return current;
      }
      next.splice(to, 0, moved);
      return normalizeImages(next);
    });
    setDragImageId(null);
  };

  const submitListing = async (status: ListingStatus) => {
    if (!snapshot.user?.id) {
      return;
    }
    const errorKey = validateCurrentStep();
    if (currentStep !== "agreement") {
      setErrorMessage(t("myAds.form.reviewBeforePublish"));
      return;
    }
    if (errorKey) {
      setErrorMessage(t(errorKey));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setActionMessage(null);

    try {
      const uploadedImages = await ensureUploadedImages();
      const imageUrls = uploadedImages.map((item) => item.publicUrl).filter((value): value is string => typeof value === "string");
      await repository.publishDraft({
        id: editingListingId ?? undefined,
        ownerId: snapshot.user.id,
        offerType: offerType ?? null,
        categorySlug: category ?? null,
        title: title.trim(),
        description: listingDescriptionForSubmit || "-",
        price: shouldShowPriceInput ? parsedPrice : 1,
        imageUrl: serializeListingImageUrls(imageUrls) ?? undefined,
        images: toCreateListingImageInputs(uploadedImages),
        status,
        locationName: isCarSaleCategory ? carLocation.trim() || t("marketplace.create.defaultLocation") : t("marketplace.create.defaultLocation"),
        latitude: 24.7136,
        longitude: 46.6753
      });
      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      setActionMessage(t(status === "draft" ? "marketplace.create.draft.savedAt" : "marketplace.create.success", { value: "0" }));
      resetForm();
      setSection(status === "draft" ? "drafts" : "active");
      setPage(1);
      await loadManagementData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("marketplace.loadError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateFlow = () => {
    resetForm();
    setActionMessage(null);
    setErrorMessage(null);
  };

  const onEditListing = (listing: MarketplaceListing) => {
    setEditingListingId(listing.id);
    setCurrentStepIndex(1);
    setTitle(listing.title);
    setDescription(listing.description ?? "");
    setPrice(String(Math.max(1, listing.price)));
    setOfferType(listing.offerType ?? null);
    setCategory(listing.categorySlug ?? null);
    setExtraDetails("");
    const existingImages = parseListingImageUrls(listing.imageUrl).map((uri) => ({
      ...createListingImageUploadItem({
        localId: createImageId(),
        previewUri: uri,
        localUri: uri,
        publicUrl: uri,
        storagePath: extractListingImageStoragePath(uri) ?? undefined,
        status: "uploaded"
      })
    }));
    setSelectedImages(normalizeImages(existingImages));
    setLastSyncedRemoteAt(listing.updatedAt ?? null);
    setPendingSyncOperations([]);
    setDraftConflict(null);
    setActionMessage(t("myAds.management.editing", { title: listing.title }));
    setErrorMessage(null);
  };

  const updateListingStatus = async (listing: MarketplaceListing, status: ListingStatus) => {
    if (!snapshot.user?.id) {
      return;
    }
    try {
      await repository.publishDraft({
        id: listing.id,
        ownerId: snapshot.user.id,
        offerType: listing.offerType ?? null,
        categorySlug: listing.categorySlug ?? null,
        title: listing.title,
        description: listing.description ?? "-",
        price: listing.price,
        imageUrl: listing.imageUrl ?? undefined,
        status,
        locationName: listing.locationName ?? undefined,
        latitude: listing.latitude ?? undefined,
        longitude: listing.longitude ?? undefined
      });
      setData((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === listing.id ? { ...item, status } : item))
      }));
      setActionMessage(t(status === "sold" ? "myAds.management.markedSold" : "myAds.management.republished"));
      setPage(1);
      setSection(status === "sold" ? "sold" : "active");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("marketplace.loadError"));
    }
  };

  const deleteListing = async (listing: MarketplaceListing) => {
    if (!snapshot.user?.id) {
      return;
    }
    const confirmed = window.confirm(t("myAds.deleteConfirmMessage"));
    if (!confirmed) {
      return;
    }
    try {
      await repository.deleteById(listing.id, snapshot.user.id);
      setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== listing.id), totalItems: Math.max(0, current.totalItems - 1) }));
      setSalePayments((current) => current.filter((item) => item.listingId !== listing.id));
      setActionMessage(t("myAds.management.deleted"));
    } catch {
      setErrorMessage(t("myAds.deleteFailed"));
    }
  };

  const shareListing = async (listing: MarketplaceListing) => {
    const url = `${window.location.origin}/${resolvedLanguage}/listing/${listing.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setActionMessage(t("myAds.management.shared"));
    } catch {
      setErrorMessage(t("myAds.management.shareFailed"));
    }
  };

  const handleSalePaymentUpdated = (nextPayment: ListingSalePayment) => {
    setSalePayments((current) => {
      const next = current.filter((item) => item.listingId !== nextPayment.listingId);
      next.unshift(nextPayment);
      return next;
    });

    if (nextPayment.paymentStatus === "paid") {
      setData((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === nextPayment.listingId ? { ...item, status: "sold" } : item))
      }));
      setActionMessage(t("myAds.management.markedSold"));
      setSection("sold");
      setPage(1);
    }
  };

  const previewDescription = description.trim() || extraDetails.trim() || t("marketplace.detail.noDescription");

  const content = (
      <main dir={resolvedLanguage === "ar" ? "rtl" : "ltr"} className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Image src="/brand/sanany-logo.png" alt={t("app.title")} width={500} height={220} className="h-9 w-auto" priority />
            <h1 className="text-2xl font-bold text-slate-900">{t("myAds.pageTitle")}</h1>
            <p className="text-sm text-slate-600">{t("myAds.pageSubtitle")}</p>
          </div>
          <button type="button" onClick={openCreateFlow} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            {t("myAds.management.createNew")}
          </button>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {ADD_STEPS.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setCurrentStepIndex(index)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    index === currentStepIndex ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {getStepLabel(step)}
                </button>
              ))}
            </div>

            {currentStep === "category" ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">{t("marketplace.create.flow.categoryTitle")}</h2>
                <p className="text-sm text-slate-600">{t("marketplace.create.flow.categoryHint")}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {LISTING_OFFER_TYPES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setOfferType(item);
                        setCategory(null);
                      }}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        offerType === item ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {t(`marketplace.create.offerTypes.${item}`)}
                    </button>
                  ))}
                </div>
                {offerType ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedTypeCategories.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCategory(item)}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          category === item ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {t(`marketplace.create.categories.${item}`)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStep === "details" ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">{t("marketplace.create.flow.detailsTitle")}</h2>
                <div className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">{t("marketplace.create.images.title")}</span>
                  <label
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => void onDropImages(event)}
                    className="flex min-h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600"
                  >
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void onImageInput(event)} />
                    {t("myAds.form.dragDropHint")}
                  </label>
                </div>
                <p className="text-xs text-slate-500">{t("marketplace.create.images.selectedCount", { count: selectedImages.length })}</p>
                <p className="text-xs text-slate-500">{t("marketplace.create.images.idealCountHint", { count: IDEAL_IMAGE_COUNT })}</p>
                {getFailedListingImageUploads(selectedImages).length > 0 ? (
                  <p className="text-xs text-amber-700">{t("marketplace.create.images.uploadFailed")}</p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedImages.map((image) => (
                    <div
                      key={image.localId}
                      draggable
                      onDragStart={() => onDragStartImage(image.localId)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => onDropImage(image.localId)}
                      className="space-y-2 rounded-lg border border-slate-200 bg-white p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.previewUri} alt={t("marketplace.create.images.title")} className="h-32 w-full rounded-md object-cover" />
                      <div className="flex flex-wrap items-center gap-1 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            image.status === "uploaded"
                              ? "bg-emerald-100 text-emerald-700"
                              : image.status === "failed"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {t(`marketplace.create.images.status.${image.status}`)}
                        </span>
                        {typeof image.error === "string" && image.error.length > 0 ? <span className="text-rose-600">{image.error}</span> : null}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {image.isPrimary ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{t("marketplace.create.images.primaryBadge")}</span>
                        ) : (
                          <button type="button" onClick={() => setPrimaryImage(image.localId)} className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-700">
                            {t("marketplace.create.images.makePrimary")}
                          </button>
                        )}
                        {image.status === "failed" ? (
                          <button type="button" onClick={() => retryImageUpload(image.localId)} className="rounded-full border border-amber-300 px-2 py-0.5 text-xs text-amber-700">
                            {t("marketplace.create.images.retry")}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => removeImage(image.localId)} className="rounded-full border border-rose-300 px-2 py-0.5 text-xs text-rose-600">
                          {t("marketplace.create.images.remove")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">{t("marketplace.create.listingTitleLabel")}</span>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/40 focus:ring" />
                  </label>
                  {shouldShowPriceInput ? (
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">{t("marketplace.create.listingPriceLabel")}</span>
                      <input
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        inputMode="numeric"
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/40 focus:ring"
                      />
                    </label>
                  ) : null}
                </div>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">{t("marketplace.create.listingDescriptionLabel")}</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand/40 focus:ring" />
                </label>

                {!isCarSaleCategory ? (
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">{t(`marketplace.create.dynamicFields.${offerType ?? "default"}.label`)}</span>
                    <input value={extraDetails} onChange={(event) => setExtraDetails(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/40 focus:ring" />
                  </label>
                ) : null}

                {isCarSaleCategory ? (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <h3 className="text-sm font-semibold text-slate-900">{t("marketplace.create.carDetails.title")}</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.brandLabel")}</span>
                        <select
                          value={carBrand ?? ""}
                          onChange={(event) => {
                            setCarBrand(event.target.value || null);
                            setCarModelOption(null);
                            setCarModelOther("");
                            setCarYear(null);
                          }}
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        >
                          <option value="">{t("marketplace.create.carDetails.selectBrandFirst")}</option>
                          {CAR_MAKE_IDS.map((brand) => (
                            <option key={brand} value={brand}>
                              {t(`marketplace.create.carDetails.brands.${brand}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.modelOptionLabel")}</span>
                        <select value={carModelOption ?? ""} onChange={(event) => setCarModelOption(event.target.value || null)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                          <option value="">{t("marketplace.create.carDetails.modelSearchPlaceholder")}</option>
                          {carModelOptions.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.label}
                            </option>
                          ))}
                          <option value={OTHER_CAR_MODEL_ID}>{t("marketplace.create.carDetails.modelOtherOption")}</option>
                        </select>
                      </label>
                      {carModelOption === OTHER_CAR_MODEL_ID ? (
                        <label className="space-y-1">
                          <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.modelOtherLabel")}</span>
                          <input value={carModelOther} onChange={(event) => setCarModelOther(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
                        </label>
                      ) : null}
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.yearLabel")}</span>
                        <select value={carYear ?? ""} onChange={(event) => setCarYear(event.target.value || null)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                          <option value="">{t("marketplace.create.carDetails.yearSearchPlaceholder")}</option>
                          {carYears.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.locationLabel")}</span>
                        <input value={carLocation} onChange={(event) => setCarLocation(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.mileageLabel")}</span>
                        <input value={carMileage} onChange={(event) => setCarMileage(event.target.value.replace(/[^\d]/g, ""))} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.adTypeLabel")}</span>
                        <select value={carAdType} onChange={(event) => setCarAdType(event.target.value as CarAdType)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                          {CAR_AD_TYPES.map((item) => (
                            <option key={item} value={item}>
                              {t(`marketplace.create.carDetails.adTypeOptions.${item}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.conditionLabel")}</span>
                        <select value={carCondition} onChange={(event) => setCarCondition(event.target.value as CarCondition)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                          {CAR_CONDITIONS.map((item) => (
                            <option key={item} value={item}>
                              {t(`marketplace.create.carDetails.conditionOptions.${item}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.fuelLabel")}</span>
                        <select value={carFuelType} onChange={(event) => setCarFuelType(event.target.value as CarFuelType)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                          {CAR_FUEL_TYPES.map((item) => (
                            <option key={item} value={item}>
                              {t(`marketplace.create.carDetails.fuelOptions.${item}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm text-slate-700">{t("marketplace.create.carDetails.priceModeLabel")}</span>
                        <select value={carPriceMode} onChange={(event) => setCarPriceMode(event.target.value as CarPriceMode)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                          {CAR_PRICE_MODES.map((item) => (
                            <option key={item} value={item}>
                              {t(`marketplace.create.carDetails.priceModeOptions.${item}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStep === "preview" ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">{t("marketplace.create.flow.previewTitle")}</h2>
                <p className="text-sm text-slate-600">{t("marketplace.create.flow.previewHint")}</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-base font-semibold text-slate-900">{title.trim() || t("marketplace.create.flow.previewFallbackTitle")}</p>
                  <p className="text-sm text-slate-600">{t("marketplace.create.flow.previewType", { value: offerType ? t(`marketplace.create.offerTypes.${offerType}`) : "-" })}</p>
                  <p className="text-sm text-slate-600">{t("marketplace.create.flow.previewCategory", { value: category ? t(`marketplace.create.categories.${category}`) : "-" })}</p>
                  <p className="text-sm text-slate-600">
                    {shouldShowPriceInput
                      ? t("marketplace.create.flow.previewPrice", { value: validPrice })
                      : t("marketplace.create.flow.previewPriceMode", { value: t(`marketplace.create.carDetails.priceModeOptions.${carPriceMode}`) })}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{previewDescription}</p>
                </div>
              </div>
            ) : null}

            {currentStep === "agreement" ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">{t("marketplace.create.flow.agreementTitle")}</h2>
                <p className="text-sm text-slate-600">{t("marketplace.create.flow.agreementHint")}</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">{t("marketplace.create.flow.agreementCommitSecondary")}</p>
                  <p className="mt-2 text-xs text-slate-600">{t("marketplace.create.flow.agreementNoteBody")}</p>
                </div>
                <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3">
                  <input type="checkbox" checked={isAgreementAccepted} onChange={(event) => setIsAgreementAccepted(event.target.checked)} />
                  <span className="text-sm text-slate-700">{t("marketplace.create.flow.agreementCommitPrimary")}</span>
                </label>
              </div>
            ) : null}

            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
            {actionMessage ? <p className="text-sm text-emerald-700">{actionMessage}</p> : null}
            {isSavingDraft ? <p className="text-xs text-slate-500">{t("marketplace.create.draft.saving")}</p> : null}
            {draftSavedAt ? <p className="text-xs text-slate-500">{t("myAds.form.lastDraftMinutes", { value: formatRelativeMinutes(draftSavedAt) ?? "0" })}</p> : null}
            {hasPendingDraftSyncOperations(pendingSyncOperations) ? <p className="text-xs text-slate-500">{t("marketplace.create.draft.queuePending", { count: pendingSyncOperations.length })}</p> : null}
            {hasPendingListingImageUploads(selectedImages) ? <p className="text-xs text-slate-500">{t("marketplace.create.images.uploadPending")}</p> : null}
            {draftConflict ? (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">{t("marketplace.create.draft.conflictDetected")}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void syncDraftToRemote({ force: true })} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800">
                    {t("marketplace.create.draft.overwriteRemote")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftConflict(null);
                      const cleared = clearDraftSyncOperations();
                      setPendingSyncOperations(cleared);
                      persistDraftSnapshot(buildDraftSnapshot(cleared, null));
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    {t("marketplace.create.draft.keepLocalOnly")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={currentStepIndex === 0 || isSubmitting}
                onClick={goBack}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                {t("marketplace.create.flow.back")}
              </button>
              {currentStep === "agreement" ? (
                <button type="button" disabled={isSubmitting} onClick={() => void submitListing("available")} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {isSubmitting ? t("common.loading") : t("marketplace.create.submit")}
                </button>
              ) : (
                <button type="button" disabled={isSubmitting} onClick={goNext} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {t("marketplace.create.flow.next")}
                </button>
              )}
              <button
                type="button"
                disabled={isSubmitting || isSavingDraft}
                onClick={() => void saveDraft()}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                {t("marketplace.create.draft.saveAndExit")}
              </button>
            </div>
          </Card>

          <Card className="space-y-3 xl:sticky xl:top-24 xl:h-fit">
            <h3 className="text-base font-semibold text-slate-900">{t("myAds.form.summaryTitle")}</h3>
            <p className="text-sm text-slate-600">{t("marketplace.create.flow.stepProgress", { current: currentStepIndex + 1, total: ADD_STEPS.length })}</p>
            <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${qualityTone}`}>
              {t("myAds.form.qualityScore", { value: qualityScore })}
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>{t("myAds.form.summaryType", { value: offerType ? t(`marketplace.create.offerTypes.${offerType}`) : "-" })}</li>
              <li>{t("myAds.form.summaryCategory", { value: category ? t(`marketplace.create.categories.${category}`) : "-" })}</li>
              <li>{t("myAds.form.summaryImages", { count: selectedImages.length })}</li>
              <li>{t("myAds.form.summaryPrice", { value: shouldShowPriceInput ? validPrice : 0 })}</li>
            </ul>
          </Card>
        </section>

        <div data-testid="my-ads-management">
          <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {LISTING_MANAGEMENT_SECTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSection(item)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  section === item ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {t(`myAds.sections.${item}`)}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("myAds.searchPlaceholder")}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none ring-brand/40 focus:ring"
            />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              {t("search.clearFilters")}
            </button>
          </div>

          {!isSectionBackedByMobileStatus(section) ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{t("myAds.management.mobileStatusOnlyHint")}</p>
          ) : null}

          {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}
          {!isLoading && visibleData.items.length === 0 ? <p className="text-sm text-slate-600">{t("myAds.emptyState")}</p> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleData.items.map((listing) => {
              const salePayment = salePayments.find((item) => item.listingId === listing.id) ?? null;
              const canCompleteSale = shouldShowSaleCompletionAction(listing, salePayments);
              const isPaymentProcessing = salePayment?.paymentStatus === "pending";
              const saleActionLabel =
                salePayment && salePayment.paymentStatus !== "paid" ? t("myAds.saleFlow.resumePaymentAction") : t("myAds.saleFlow.action");
              const paymentStatusTone =
                salePayment?.paymentStatus === "paid"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : salePayment?.paymentStatus === "failed" || salePayment?.paymentStatus === "cancelled"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-amber-200 bg-amber-50 text-amber-800";
              return (
              <div key={listing.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
                <ListingCard listing={listing} language={resolvedLanguage} />
                {salePayment ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 font-semibold ${paymentStatusTone}`}>{t(`myAds.saleFlow.paymentStates.${salePayment.paymentStatus}`)}</span>
                      <span className="font-semibold text-slate-900">
                        {salePayment.paymentStatus === "paid"
                          ? t("marketplace.status.sold")
                          : isListingActiveForSaleCompletion(listing.status)
                            ? t("myAds.saleFlow.activeTabTitle")
                            : t(`marketplace.status.${listing.status}`)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] text-slate-500">{t("myAds.saleFlow.amountLabel")}</p>
                        <p className="font-semibold text-slate-900">{formatCurrencySar(salePayment.finalSaleAmount, resolvedLanguage)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">{t("myAds.saleFlow.commissionAmount")}</p>
                        <p className="font-semibold text-slate-900">{formatCurrencySar(salePayment.commissionAmount, resolvedLanguage)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">{t("myAds.saleFlow.soldDate")}</p>
                        <p className="font-semibold text-slate-900">{salePayment.paymentDate ? new Date(salePayment.paymentDate).toLocaleDateString(resolvedLanguage === "ar" ? "ar-SA" : "en-US") : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">{t("myAds.saleFlow.invoiceNumber")}</p>
                        <p className="font-semibold text-slate-900">{salePayment.invoiceNumber ?? "—"}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] text-slate-500">{t("myAds.saleFlow.paymentMethod")}</p>
                        <p className="font-semibold text-slate-900">{salePayment.paymentMethod ?? "—"}</p>
                      </div>
                    </div>
                    {(salePayment.paymentStatus === "failed" || salePayment.paymentStatus === "cancelled") && salePayment.failureReason ? (
                      <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                        {t("myAds.saleFlow.failureReasonLabel")}: {salePayment.failureReason}
                      </p>
                    ) : null}
                    {salePayment.paymentStatus === "paid" ? (
                      <button
                        type="button"
                        onClick={() => setSelectedSaleListingId(listing.id)}
                        className="mt-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        {t("myAds.saleFlow.invoiceView")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => onEditListing(listing)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50" disabled={isPaymentProcessing}>
                    {t("myAds.management.actions.edit")}
                  </button>
                  <button type="button" onClick={() => void deleteListing(listing)} className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50" disabled={isPaymentProcessing}>
                    {t("myAds.management.actions.delete")}
                  </button>
                  <Link href={`/${resolvedLanguage}/listing/${listing.id}`} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs font-medium text-slate-700">
                    {t("myAds.management.actions.preview")}
                  </Link>
                  {listing.status === "sold" || listing.status === "inactive" ? (
                    <button type="button" onClick={() => void updateListingStatus(listing, "available")} className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700">
                      {t("myAds.management.actions.republish")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedSaleListingId(listing.id)}
                      className="rounded-lg bg-brand px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      disabled={!canCompleteSale || !commissionSettings || isPaymentProcessing}
                    >
                      {saleActionLabel}
                    </button>
                  )}
                  <button type="button" onClick={() => void shareListing(listing)} className="col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                    {t("myAds.management.actions.share")}
                  </button>
                </div>
                {isPaymentProcessing ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">{t("myAds.saleFlow.processingLockHint")}</p> : null}
              </div>
              );
            })}
          </div>

          {isSectionBackedByMobileStatus(section) && visibleData.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={visibleData.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
              >
                {t("common.previous")}
              </button>
              <p className="text-xs text-slate-500">{t("common.page", { current: visibleData.page, total: visibleData.totalPages })}</p>
              <button
                type="button"
                disabled={visibleData.page >= visibleData.totalPages}
                onClick={() => setPage((current) => Math.min(visibleData.totalPages, current + 1))}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
              >
                {t("common.next")}
              </button>
            </div>
          ) : null}
          </Card>
        </div>
        <MyAdsSaleCompletion
          isOpen={selectedSaleListing !== null}
          language={resolvedLanguage}
          listing={selectedSaleListing}
          sellerId={snapshot.user?.id ?? null}
          settings={commissionSettings}
          payment={selectedSaleListing ? salePayments.find((item) => item.listingId === selectedSaleListing.id) ?? null : null}
          onClose={() => setSelectedSaleListingId(null)}
          onPaymentUpdated={handleSalePaymentUpdated}
          tapPaymentReturn={tapPaymentReturn}
          onTapPaymentHandled={() => setTapPaymentReturn(null)}
        />
      </main>
  );

  return <RequireAuth language={resolvedLanguage}>{content}</RequireAuth>;
}
