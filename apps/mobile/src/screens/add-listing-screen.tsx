import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MarketplaceListing } from "@sanany/types";
import { createListingsRepository } from "@sanany/api";
import {
  buildListingImageStoragePath,
  buildCarModelOptions,
  buildCarYearsRange,
  CAR_MAKE_IDS,
  clearDraftSyncOperations,
  createDraftSyncOperation,
  createListingImageUploadItem,
  enqueueDraftSyncOperation,
  extractListingImageStoragePath,
  formatHourMinute,
  formatWholeNumber,
  getFailedListingImageUploads,
  hasPendingDraftSyncOperations,
  hasPendingListingImageUploads,
  LISTING_IMAGES_BUCKET,
  markListingImageForRetry,
  normalizeListingImageOrder,
  OTHER_CAR_MODEL_ID,
  readMetadataPhone,
  serializeListingImageUrls,
  shouldCreateDraftConflict,
  toCreateListingImageInputs,
  searchCarMakes,
  searchCarModels,
  type DraftRemoteConflict,
  type DraftSyncOperation,
  type ListingImageUploadItem,
  type CarMakeId,
  validateCarListingDraft
} from "@sanany/shared";
import { type Direction } from "@sanany/utils";
import { useAuth } from "../auth/auth-context";
import { getMobileSupabaseEnv } from "../config/env";
import { getMobileListingsRepository } from "../lib/listings-repository";
import { getMobileSupabaseClient } from "../lib/supabase-client";
import { MobileIcon } from "../components/mobile-icons";
import { MobileSectionHeader } from "../components/mobile-section-header";

type AddListingScreenProps = {
  direction: Direction;
  onCreated(listing: MarketplaceListing): void;
  onExit(): void;
};

type ListingOfferType = "service" | "request" | "sell" | "rent";
type CarAdType = "sell" | "transfer" | "lease";
type CarCondition = "new" | "likeNew" | "used";
type CarFuelType = "gasoline" | "diesel" | "hybrid" | "electric";
type CarPriceMode = "fixed" | "bid" | "byWork";
type ListingCategory =
  | "carSale"
  | "carPartsAndServices"
  | "truckAndHeavy"
  | "bikeSale"
  | "propertySale"
  | "propertyRent"
  | "deviceSale"
  | "furnitureSale"
  | "livestockSale"
  | "generalGoods"
  | "serviceOffer"
  | "requestGoods"
  | "mobileSale"
  | "laptopSale"
  | "homeAppliancesSale"
  | "toolsEquipmentSale"
  | "clothingSale"
  | "kidsSuppliesSale"
  | "electronicPartsSale"
  | "saleOther"
  | "carRent"
  | "eventEquipmentRent"
  | "constructionToolsRent"
  | "chaletRent"
  | "warehouseRent"
  | "cameraGearRent"
  | "rentOther"
  | "cleaningService"
  | "homeMaintenanceService"
  | "electricalPlumbingService"
  | "movingService"
  | "designTechService"
  | "photoVideoService"
  | "deliveryService"
  | "womenServices"
  | "studentServices"
  | "serviceOther"
  | "requestPurchase"
  | "requestRent"
  | "requestHomeService"
  | "requestTechService"
  | "requestUrgentMaintenance"
  | "requestOther";
type AddStep = "category" | "agreement" | "details" | "preview";

const FLOW_STEPS: AddStep[] = ["category", "details", "preview", "agreement"];
const COMMISSION_PERCENTAGE = 0.01;
const MINIMUM_COMMISSION = 5;
const MAX_VIDEO_DURATION_SECONDS = 60;
const MAX_VIDEO_SIZE_MB = 20;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_COUNT = 10;
const MIN_IMAGE_COUNT = 1;
const IDEAL_IMAGE_COUNT = 5;
const MAX_IMAGE_SIZE_MB = 8;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const OFFER_TYPES: ListingOfferType[] = ["sell", "rent", "service", "request"];
const CAR_AD_TYPES: CarAdType[] = ["sell", "transfer", "lease"];
const CAR_CONDITIONS: CarCondition[] = ["new", "likeNew", "used"];
const CAR_FUEL_TYPES: CarFuelType[] = ["gasoline", "diesel", "hybrid", "electric"];
const CAR_PRICE_MODES: CarPriceMode[] = ["fixed", "bid", "byWork"];
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

const OFFER_TYPE_KEYWORDS: Record<ListingOfferType, string[]> = {
  request: ["مطلوب", "طلب", "ابحث", "أبحث", "احتاج", "أحتاج", "looking for", "wanted", "need"],
  sell: ["للبيع", "بيع", "تنازل", "for sale", "sell"],
  rent: ["للايجار", "للإيجار", "ايجار", "إيجار", "استئجار", "rent", "rental"],
  service: ["خدمة", "صيانة", "تنظيف", "تركيب", "نقل", "service", "maintenance"]
};

const CATEGORY_KEYWORDS: Record<ListingCategory, string[]> = {
  carSale: ["سيارة", "سيارات", "car", "sedan", "suv"],
  carPartsAndServices: ["قطع", "اكسسوارات", "إكسسوارات", "زيت", "بطارية", "tire", "tyre", "spare"],
  truckAndHeavy: ["شاحنة", "قلاب", "معدات ثقيلة", "truck", "heavy"],
  bikeSale: ["دباب", "دراجة", "bike", "motorcycle"],
  propertySale: ["عقار", "فيلا", "عمارة", "ارض", "أرض", "property", "villa", "land"],
  propertyRent: ["شقة", "ايجار", "إيجار", "استديو", "studio", "apartment", "rent"],
  deviceSale: ["جهاز", "تابلت", "device", "tablet"],
  furnitureSale: ["أثاث", "كنب", "طاولة", "furniture", "sofa"],
  livestockSale: ["غنم", "حلال", "ماعز", "livestock", "sheep"],
  generalGoods: ["سلعة", "أغراض", "بضاعة", "item", "goods"],
  serviceOffer: ["أقدم خدمة", "خدمة متاحة", "offer service"],
  requestGoods: ["مطلوب", "ابحث", "طلب سلعة", "wanted", "looking for"],
  mobileSale: ["جوال", "ايفون", "آيفون", "iphone", "mobile", "phone"],
  laptopSale: ["لابتوب", "ماكبوك", "laptop", "macbook"],
  homeAppliancesSale: ["مكيف", "ثلاجة", "غسالة", "appliance", "ac", "fridge"],
  toolsEquipmentSale: ["عدة", "معدات", "أدوات", "tools", "equipment"],
  clothingSale: ["ملابس", "ثوب", "عباية", "clothing"],
  kidsSuppliesSale: ["أطفال", "حفاض", "عربة", "kids", "baby"],
  electronicPartsSale: ["قطع الكترونية", "قطع إلكترونية", "electronic parts"],
  saleOther: ["اخرى", "أخرى", "other"],
  carRent: ["سيارة ايجار", "سيارة للإيجار", "car rent"],
  eventEquipmentRent: ["مناسبة", "كراسي", "طاولات", "event", "wedding"],
  constructionToolsRent: ["سقالة", "حفار", "معدات بناء", "construction"],
  chaletRent: ["شاليه", "استراحة", "chalet"],
  warehouseRent: ["مستودع", "warehouse"],
  cameraGearRent: ["كاميرا", "تصوير", "camera"],
  rentOther: ["ايجار اخرى", "إيجار أخرى", "other rent"],
  cleaningService: ["تنظيف", "cleaning"],
  homeMaintenanceService: ["صيانة منزل", "سباكة", "كهرباء", "home maintenance"],
  electricalPlumbingService: ["كهرباء", "سباكة", "electrical", "plumbing"],
  movingService: ["نقل عفش", "moving", "relocation"],
  designTechService: ["تصميم", "موقع", "برمجة", "design", "tech", "website"],
  photoVideoService: ["تصوير", "مونتاج", "video", "photo"],
  deliveryService: ["توصيل", "delivery"],
  womenServices: ["نسائي", "صالون", "مشغل", "women"],
  studentServices: ["طلاب", "واجب", "تدريس", "student", "tutoring"],
  serviceOther: ["خدمة اخرى", "خدمة أخرى", "other service"],
  requestPurchase: ["شراء", "ابي اشتري", "أبي أشتري", "buy"],
  requestRent: ["استئجار", "ابغى ايجار", "أبغى إيجار", "rent request"],
  requestHomeService: ["خدمة منزلية", "سباك", "كهربائي", "home service"],
  requestTechService: ["موقع", "تطبيق", "برمجة", "technical", "developer"],
  requestUrgentMaintenance: ["عاجل", "طارئ", "urgent", "emergency"],
  requestOther: ["طلب اخرى", "طلب أخرى", "other request"]
};

function normalizeForAi(value: string): string {
  return value.trim().toLowerCase();
}

function inferOfferTypeFromText(text: string): ListingOfferType | null {
  const normalized = normalizeForAi(text);
  if (!normalized) {
    return null;
  }

  let bestMatch: { type: ListingOfferType; score: number } | null = null;
  for (const type of OFFER_TYPES) {
    const score = OFFER_TYPE_KEYWORDS[type].reduce((acc, keyword) => (normalized.includes(keyword) ? acc + 1 : acc), 0);
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { type, score };
    }
  }

  return bestMatch?.type ?? null;
}

function inferCategoryFromText(type: ListingOfferType, text: string): ListingCategory | null {
  const normalized = normalizeForAi(text);
  const candidates = CATEGORIES_BY_TYPE[type];
  let bestMatch: { category: ListingCategory; score: number } | null = null;

  for (const category of candidates) {
    const score = CATEGORY_KEYWORDS[category].reduce((acc, keyword) => (normalized.includes(keyword) ? acc + 1 : acc), 0);
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { category, score };
    }
  }

  return bestMatch?.category ?? null;
}

function normalizeArabicDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - "٠".charCodeAt(0)))
    .replace(/[٫٬]/g, ".");
}

function extractBudgetFromText(text: string): string | null {
  const normalized = normalizeArabicDigits(text);
  const match = normalized.match(/(?:ميزانية|budget|price|بسعر|بحدود)?\s*[:\-]?\s*(\d{2,7})/i);
  return match ? match[1] : null;
}

function deriveSmartTitle(text: string, prefix: string): string {
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  const compact = firstLine.replace(/\s+/g, " ").slice(0, 64).trim();
  if (!compact) {
    return "";
  }
  return compact.startsWith(prefix) ? compact : `${prefix}: ${compact}`;
}

function resolveCreateErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

function isRlsInsertError(error: unknown): boolean {
  const message = resolveCreateErrorMessage(error, "").toLowerCase();
  return message.includes("row-level security") || message.includes("violates row-level security");
}

async function createListingViaRest(params: {
  sessionToken: string;
  ownerId: string;
  ownerPhone: string | null;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
}): Promise<MarketplaceListing> {
  const env = getMobileSupabaseEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/listings?select=id,owner_id,owner_phone,title,description,price,status,image_url,location_name,latitude,longitude,created_at`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${params.sessionToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      owner_id: params.ownerId,
      owner_phone: params.ownerPhone,
      title: params.title,
      description: params.description || null,
      price: params.price,
      image_url: params.imageUrl,
      location_name: params.locationName,
      latitude: params.latitude,
      longitude: params.longitude,
      status: "available"
    })
  });

  const payload = (await response.json()) as
    | Array<{
        id: string;
        owner_id: string | null;
        owner_phone: string | null;
        title: string;
        description: string | null;
        price: number;
        status: "available" | "reserved";
        image_url: string | null;
        location_name: string | null;
        latitude: number | null;
        longitude: number | null;
        created_at: string;
      }>
    | { message?: string };

  if (!response.ok || !Array.isArray(payload) || !payload[0]) {
    const message = !Array.isArray(payload) && payload.message ? payload.message : "Failed to create listing.";
    throw new Error(message);
  }

  const row = payload[0];
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerPhone: row.owner_phone,
    title: row.title,
    description: row.description,
    price: row.price,
    status: row.status,
    imageUrl: row.image_url,
    locationName: row.location_name,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at
  };
}

function createLocalListing(input: {
  ownerId: string;
  ownerPhone: string | null;
  title: string;
  description: string;
  price: number;
  locationName: string;
  imageUrl: string | null;
}): MarketplaceListing {
  return {
    id: `local-${Date.now()}`,
    ownerId: input.ownerId,
    ownerPhone: input.ownerPhone,
    title: input.title,
    description: input.description,
    price: input.price,
    status: "available",
    imageUrl: input.imageUrl,
    locationName: input.locationName,
    latitude: 24.7136,
    longitude: 46.6753,
    createdAt: new Date().toISOString()
  };
}

function calculateCommissionFee(price: number): number {
  if (price <= 0) {
    return 0;
  }

  return Math.max(MINIMUM_COMMISSION, Math.round(price * COMMISSION_PERCENTAGE));
}

function formatFileSizeMb(sizeBytes: number): string {
  return (sizeBytes / (1024 * 1024)).toFixed(1);
}

function inferImageMimeType(uri: string): string {
  const lowerUri = uri.toLowerCase();
  if (lowerUri.endsWith(".png")) {
    return "image/png";
  }
  if (lowerUri.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowerUri.endsWith(".gif")) {
    return "image/gif";
  }
  if (lowerUri.endsWith(".heic")) {
    return "image/heic";
  }
  if (lowerUri.endsWith(".heif")) {
    return "image/heif";
  }
  return "image/jpeg";
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Failed to read image file."));
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.startsWith("data:image/")) {
        reject(new Error("Invalid image file format."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

async function convertFileUriToDataUrl(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${inferImageMimeType(uri)};base64,${base64}`;
}

async function resolvePersistableImageUri(uri: string): Promise<string | null> {
  const trimmed = uri.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  if (trimmed.startsWith("file://")) {
    return await convertFileUriToDataUrl(trimmed);
  }
  return null;
}

async function buildSerializedImageUrl(imageItems: Array<{ uri: string }>): Promise<string | null> {
  const urls: string[] = [];
  for (const image of imageItems) {
    const persistableUri = await resolvePersistableImageUri(image.uri);
    if (persistableUri) {
      urls.push(persistableUri);
    }
  }
  return serializeListingImageUrls(urls);
}

function normalizeSelectedImages(items: SelectedImage[]): SelectedImage[] {
  return normalizeListingImageOrder(items.map((item, index) => ({ ...item, isPrimary: index === 0, sortOrder: index })));
}

function isStorageRlsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.toLowerCase().includes("row-level security policy");
}

async function uploadMobileListingImage(input: {
  ownerId: string;
  image: SelectedImage;
}) {
  const response = await fetch(input.image.localUri ?? input.image.previewUri);
  const blob = await response.blob();
  const storagePath =
    input.image.storagePath ??
    buildListingImageStoragePath({
      ownerId: input.ownerId,
      localId: input.image.localId,
      mimeType: blob.type || input.image.mimeType,
      uri: input.image.previewUri
    });
  const uploadResult = await getMobileSupabaseClient().storage.from(LISTING_IMAGES_BUCKET).upload(storagePath, blob, {
    upsert: true,
    contentType: blob.type || input.image.mimeType || "image/jpeg",
    cacheControl: "3600"
  });
  if (uploadResult.error) {
    throw uploadResult.error;
  }
  const { data } = getMobileSupabaseClient().storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    publicUrl: data.publicUrl,
    fileSize: blob.size,
    mimeType: blob.type || input.image.mimeType || "image/jpeg"
  };
}

type SelectedVideo = {
  uri: string;
  durationSeconds: number;
  sizeBytes: number | null;
};

type SelectedImage = ListingImageUploadItem;

type ListingDraftSnapshot = {
  draftId: string | null;
  currentStepIndex: number;
  offerType: ListingOfferType | null;
  category: ListingCategory | null;
  title: string;
  description: string;
  extraDetails: string;
  price: string;
  carBrand: CarMakeId | null;
  carModelSearch: string;
  carModelOption: string | null;
  carModelOther: string;
  carYear: string | null;
  carLocation: string;
  carMileage: string;
  carLatitude: number | null;
  carLongitude: number | null;
  carAdType: CarAdType;
  carCondition: CarCondition;
  carFuelType: CarFuelType;
  carPriceMode: CarPriceMode;
  selectedImages: SelectedImage[];
  selectedVideo: SelectedVideo | null;
  isCommissionAccepted: boolean;
  pendingSyncOperations: DraftSyncOperation[];
  lastSyncedRemoteAt: string | null;
  remoteConflict: DraftRemoteConflict | null;
  updatedAt: string;
};

const DRAFT_STORAGE_KEY_PREFIX = "sanany:add-listing-draft";

export function AddListingScreen({ direction, onCreated, onExit }: AddListingScreenProps) {
  const { t, i18n } = useTranslation();
  const { snapshot } = useAuth();
  const listingsRepository = useMemo(() => getMobileListingsRepository(), []);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [offerType, setOfferType] = useState<ListingOfferType | null>(null);
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [extraDetails, setExtraDetails] = useState("");
  const [price, setPrice] = useState("");
  const [carBrand, setCarBrand] = useState<CarMakeId | null>(null);
  const [carBrandSearch, setCarBrandSearch] = useState("");
  const [carModelSearch, setCarModelSearch] = useState("");
  const [carModelOption, setCarModelOption] = useState<string | null>(null);
  const [carModelOther, setCarModelOther] = useState("");
  const [recentCarBrands, setRecentCarBrands] = useState<CarMakeId[]>([]);
  const [carYear, setCarYear] = useState<string | null>(null);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [carLocation, setCarLocation] = useState("");
  const [carMileage, setCarMileage] = useState("");
  const [carLatitude, setCarLatitude] = useState<number | null>(null);
  const [carLongitude, setCarLongitude] = useState<number | null>(null);
  const [carAdType, setCarAdType] = useState<CarAdType>("sell");
  const [carCondition, setCarCondition] = useState<CarCondition>("new");
  const [carFuelType, setCarFuelType] = useState<CarFuelType>("hybrid");
  const [carPriceMode, setCarPriceMode] = useState<CarPriceMode>("fixed");
  const [isLocatingCar, setIsLocatingCar] = useState(false);
  const [isMapEditorOpen, setIsMapEditorOpen] = useState(false);
  const [mapDraftLocation, setMapDraftLocation] = useState("");
  const [mapDraftLatitude, setMapDraftLatitude] = useState("24.7136");
  const [mapDraftLongitude, setMapDraftLongitude] = useState("46.6753");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiApplying, setIsAiApplying] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isImagePicking, setIsImagePicking] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);
  const [isVideoProcessing, setIsVideoProcessing] = useState(false);
  const [isCommissionAccepted, setIsCommissionAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [draftListingId, setDraftListingId] = useState<string | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [pendingSyncOperations, setPendingSyncOperations] = useState<DraftSyncOperation[]>([]);
  const [lastSyncedRemoteAt, setLastSyncedRemoteAt] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<DraftRemoteConflict | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const draftHydratedRef = useRef(false);
  const draftSyncRetryRequestedRef = useRef(false);
  const textAlign = direction === "rtl" ? "right" : "left";
  const currentStep = FLOW_STEPS[currentStepIndex];
  const parsedPrice = Number(price);
  const validPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;
  const commissionFee = calculateCommissionFee(validPrice);
  const selectedOfferTypeLabel = offerType ? t(`marketplace.create.offerTypes.${offerType}`) : "";
  const selectedCategoryLabel = category ? t(`marketplace.create.categories.${category}`) : "";
  const extraLabel = offerType ? t(`marketplace.create.dynamicFields.${offerType}.label`) : t("marketplace.create.dynamicFields.default.label");
  const extraPlaceholder = offerType
    ? t(`marketplace.create.dynamicFields.${offerType}.placeholder`)
    : t("marketplace.create.dynamicFields.default.placeholder");
  const selectedTypeCategories = offerType ? CATEGORIES_BY_TYPE[offerType] : [];
  const isCarSaleCategory = category === "carSale";
  const isRequestOffer = offerType === "request";
  const shouldShowPriceInput = !isCarSaleCategory || carPriceMode === "fixed";
  const defaultLocationName = t("marketplace.create.defaultLocation");
  const defaultLatitude = 24.7136;
  const defaultLongitude = 46.6753;
  const mapPreviewLatitude = Number(mapDraftLatitude);
  const mapPreviewLongitude = Number(mapDraftLongitude);
  const mapImageLatitude = Number.isFinite(mapPreviewLatitude) ? mapPreviewLatitude : defaultLatitude;
  const mapImageLongitude = Number.isFinite(mapPreviewLongitude) ? mapPreviewLongitude : defaultLongitude;
  const mapPreviewUrl = `https://static-maps.yandex.ru/1.x/?ll=${mapImageLongitude},${mapImageLatitude}&z=13&l=map&size=900,420&pt=${mapImageLongitude},${mapImageLatitude},pm2rdm`;
  const selectedImagesCount = selectedImages.length;
  const canAddMoreImages = selectedImagesCount < MAX_IMAGE_COUNT;
  const carMakeLabelById = useMemo(
    () =>
      Object.fromEntries(
        CAR_MAKE_IDS.map((makeId) => [makeId, t(`marketplace.create.carDetails.brands.${makeId}`)])
      ) as Record<CarMakeId, string>,
    [t]
  );
  const filteredCarMakes = useMemo(
    () =>
      searchCarMakes({
        query: carBrandSearch,
        recentMakeIds: recentCarBrands,
        resolveMakeLabel: (makeId) => carMakeLabelById[makeId]
      }),
    [carBrandSearch, carMakeLabelById, recentCarBrands]
  );
  const selectedCarModelOptions = useMemo(() => {
    if (!carBrand) {
      return [];
    }

    return buildCarModelOptions(carBrand).map((option) => {
      const modelToken = option.id.split(":")[1] ?? "";
      const translationKey = `marketplace.create.carDetails.models.${carBrand}.${modelToken}`;
      const localizedLabel = t(translationKey);
      const hasLocalizedLabel = localizedLabel !== translationKey;
      return {
        ...option,
        searchValues: hasLocalizedLabel ? [localizedLabel] : undefined
      };
    });
  }, [carBrand, t]);
  const filteredCarModels = useMemo(() => searchCarModels(selectedCarModelOptions, carModelSearch), [carModelSearch, selectedCarModelOptions]);
  const carYears = useMemo(() => buildCarYearsRange(), []);
  const selectedCarModelLabel = useMemo(() => {
    if (carModelOption === OTHER_CAR_MODEL_ID) {
      return carModelOther.trim();
    }
    return selectedCarModelOptions.find((item) => item.id === carModelOption)?.label ?? "";
  }, [carModelOption, carModelOther, selectedCarModelOptions]);
  const carModel = useMemo(() => {
    if (!carBrand || !selectedCarModelLabel || !carYear) {
      return "";
    }
    return `${carMakeLabelById[carBrand]} ${selectedCarModelLabel} ${carYear}`;
  }, [carBrand, carMakeLabelById, carYear, selectedCarModelLabel]);

  const selectedVideoSummary = selectedVideo
    ? t("marketplace.create.images.videoSelectedInfo", {
        duration: selectedVideo.durationSeconds,
        size: selectedVideo.sizeBytes !== null ? formatFileSizeMb(selectedVideo.sizeBytes) : "-"
      })
    : null;
  const draftStorageKey = snapshot.user?.id ? `${DRAFT_STORAGE_KEY_PREFIX}:${snapshot.user.id}` : null;
  const draftSavedAtLabel = lastDraftSavedAt ? formatHourMinute(lastDraftSavedAt, i18n.language || "ar") : null;
  const buildDraftSnapshot = (operations = pendingSyncOperations, conflict = draftConflict): ListingDraftSnapshot => ({
    draftId: draftListingId,
    currentStepIndex,
    offerType,
    category,
    title,
    description,
    extraDetails,
    price,
    carBrand,
    carModelSearch,
    carModelOption,
    carModelOther,
    carYear,
    carLocation,
    carMileage,
    carLatitude,
    carLongitude,
    carAdType,
    carCondition,
    carFuelType,
    carPriceMode,
    selectedImages,
    selectedVideo,
    isCommissionAccepted,
    pendingSyncOperations: operations,
    lastSyncedRemoteAt,
    remoteConflict: conflict,
    updatedAt: new Date().toISOString()
  });

  const persistDraftSnapshot = useCallback(
    async (payload: ListingDraftSnapshot) => {
      if (!draftStorageKey) {
        return;
      }
      await AsyncStorage.setItem(draftStorageKey, JSON.stringify(payload));
      setLastDraftSavedAt(payload.updatedAt);
    },
    [draftStorageKey]
  );

  const ensureUploadedImages = useCallback(async () => {
    if (!snapshot.user?.id) {
      throw new Error(t("marketplace.create.errors.authRequired"));
    }

    let nextItems = normalizeSelectedImages(selectedImages);
    for (const item of nextItems) {
      if (item.status === "uploaded" && item.storagePath && item.publicUrl) {
        continue;
      }

      nextItems = normalizeSelectedImages(nextItems.map((current) => (current.localId === item.localId ? { ...current, status: "compressing", progress: 10, error: undefined } : current)));
      setSelectedImages(nextItems);

      try {
        const upload = await uploadMobileListingImage({
          ownerId: snapshot.user.id,
          image: item
        });
        nextItems = normalizeSelectedImages(
          nextItems.map((current) =>
            current.localId === item.localId
              ? {
                  ...current,
                  status: "uploaded",
                  progress: 100,
                  previewUri: upload.publicUrl,
                  publicUrl: upload.publicUrl,
                  storagePath: upload.storagePath,
                  fileSize: upload.fileSize,
                  mimeType: upload.mimeType,
                  error: undefined
                }
              : current
          )
        );
        setSelectedImages(nextItems);
      } catch (error) {
        const message = isStorageRlsError(error)
          ? t("marketplace.create.images.storagePolicyMissing")
          : error instanceof Error
            ? error.message
            : t("marketplace.create.images.imagePickFailed");
        nextItems = normalizeSelectedImages(
          nextItems.map((current) => (current.localId === item.localId ? { ...current, status: "failed", progress: 0, error: message } : current))
        );
        setSelectedImages(nextItems);
        throw new Error(message);
      }
    }

    return nextItems;
  }, [selectedImages, snapshot.user?.id, t]);

  const fetchRemoteDraftUpdatedAt = useCallback(async (listingId: string) => {
    const { data, error } = await getMobileSupabaseClient().from("listings").select("updated_at").eq("id", listingId).maybeSingle();
    if (error) {
      throw error;
    }
    return typeof data?.updated_at === "string" ? data.updated_at : null;
  }, []);

  const persistDraft = useCallback(
    async (saveRemote = true) => {
      if (!draftStorageKey) {
        return;
      }

      const queuedOperations = enqueueDraftSyncOperation(pendingSyncOperations, createDraftSyncOperation("saveDraft"));
      setPendingSyncOperations(queuedOperations);
      const payload = buildDraftSnapshot(queuedOperations, null);
      await persistDraftSnapshot(payload);

      if (!saveRemote || !snapshot.user?.id) {
        return;
      }

      setIsDraftSaving(true);
      try {
        if (
          draftListingId &&
          shouldCreateDraftConflict({
            remoteUpdatedAt: await fetchRemoteDraftUpdatedAt(draftListingId),
            lastSyncedRemoteAt,
            pendingOperationsCount: queuedOperations.length
          })
        ) {
          const remoteUpdatedAt = await fetchRemoteDraftUpdatedAt(draftListingId);
          if (remoteUpdatedAt) {
            const conflictState: DraftRemoteConflict = {
              detectedAt: new Date().toISOString(),
              remoteUpdatedAt,
              lastSyncedRemoteAt
            };
            setDraftConflict(conflictState);
            await persistDraftSnapshot(buildDraftSnapshot(queuedOperations, conflictState));
            return;
          }
        }

        const parsedDraftPrice = Number(price);
        const draftPrice = Number.isFinite(parsedDraftPrice) && parsedDraftPrice > 0 ? parsedDraftPrice : 1;
        const uploadedImages = await ensureUploadedImages();
        const submitImageUrl = serializeListingImageUrls(
          uploadedImages.map((item) => item.publicUrl).filter((value): value is string => typeof value === "string")
        );
        const submitLocationName = isCarSaleCategory ? carLocation.trim() || defaultLocationName : defaultLocationName;
        const submitLatitude = isCarSaleCategory && carLatitude !== null ? carLatitude : defaultLatitude;
        const submitLongitude = isCarSaleCategory && carLongitude !== null ? carLongitude : defaultLongitude;
        const ownerPhone =
          (snapshot.user.phone && snapshot.user.phone.trim().length > 0 ? snapshot.user.phone.trim() : null) ??
          readMetadataPhone(snapshot.user.user_metadata);

        const remoteDraft = await listingsRepository.saveDraft({
          id: draftListingId ?? undefined,
          ownerId: snapshot.user.id,
          ownerPhone: ownerPhone ?? undefined,
          title: title.trim(),
          description: buildListingDescription(),
          price: draftPrice,
          imageUrl: submitImageUrl ?? undefined,
          images: toCreateListingImageInputs(uploadedImages),
          status: "draft",
          locationName: submitLocationName,
          latitude: submitLatitude,
          longitude: submitLongitude
        });
        const syncedPayload: ListingDraftSnapshot = {
          ...payload,
          draftId: remoteDraft.id,
          pendingSyncOperations: clearDraftSyncOperations(),
          lastSyncedRemoteAt: remoteDraft.updatedAt ?? payload.updatedAt,
          remoteConflict: null
        };
        await persistDraftSnapshot(syncedPayload);
        setDraftListingId(remoteDraft.id);
        setPendingSyncOperations([]);
        setLastSyncedRemoteAt(remoteDraft.updatedAt ?? payload.updatedAt);
        setDraftConflict(null);
      } catch (draftError) {
        setErrorMessage(resolveCreateErrorMessage(draftError, t("marketplace.create.draft.saveFailed")));
      } finally {
        setIsDraftSaving(false);
      }
    },
    [
      carAdType,
      carBrand,
      carCondition,
      carFuelType,
      carLatitude,
      carLocation,
      carLongitude,
      carMileage,
      carModelOption,
      carModelOther,
      carModelSearch,
      carPriceMode,
      carYear,
      category,
      currentStepIndex,
      defaultLocationName,
      defaultLatitude,
      defaultLongitude,
      description,
      draftListingId,
      draftStorageKey,
      ensureUploadedImages,
      extraDetails,
      fetchRemoteDraftUpdatedAt,
      isCarSaleCategory,
      isCommissionAccepted,
      lastSyncedRemoteAt,
      listingsRepository,
      offerType,
      pendingSyncOperations,
      price,
      persistDraftSnapshot,
      selectedImages,
      selectedVideo,
      snapshot.user,
      t,
      title
    ]
  );

  const buildListingDescription = () => {
    const baseDescription = description.trim();
    const dynamicValue = extraDetails.trim();
    const metadataParts: string[] = [];
    if (offerType) {
      metadataParts.push(`${t("marketplace.create.typeLabel")}: ${selectedOfferTypeLabel}`);
    }
    if (category) {
      metadataParts.push(`${t("marketplace.create.flow.previewCategoryLabel")}: ${selectedCategoryLabel}`);
    }

    if (!dynamicValue && metadataParts.length === 0) {
      return baseDescription;
    }

    if (dynamicValue && !isCarSaleCategory) {
      metadataParts.push(`${extraLabel}: ${dynamicValue}`);
    }
    if (isCarSaleCategory) {
      metadataParts.push(t("marketplace.create.carDetails.structuredTitle"));
      metadataParts.push(`- ${t("marketplace.create.carDetails.modelLabel")}: ${carModel.trim() || "-"}`);
      metadataParts.push(`- ${t("marketplace.create.carDetails.locationLabel")}: ${carLocation.trim() || "-"}`);
      if (carMileage.trim()) {
        metadataParts.push(`- ${t("marketplace.create.carDetails.mileageLabel")}: ${carMileage.trim()}`);
      }
      metadataParts.push(`- ${t("marketplace.create.carDetails.adTypeLabel")}: ${t(`marketplace.create.carDetails.adTypeOptions.${carAdType}`)}`);
      metadataParts.push(`- ${t("marketplace.create.carDetails.conditionLabel")}: ${t(`marketplace.create.carDetails.conditionOptions.${carCondition}`)}`);
      metadataParts.push(`- ${t("marketplace.create.carDetails.fuelLabel")}: ${t(`marketplace.create.carDetails.fuelOptions.${carFuelType}`)}`);
      metadataParts.push(`- ${t("marketplace.create.carDetails.priceModeLabel")}: ${t(`marketplace.create.carDetails.priceModeOptions.${carPriceMode}`)}`);
    }

    const metadata = metadataParts.join("\n");
    return baseDescription ? `${baseDescription}\n\n${metadata}` : metadata;
  };

  const buildPreviewDescription = () => {
    const baseDescription = description.trim();
    if (baseDescription) {
      return baseDescription;
    }

    const dynamicValue = extraDetails.trim();
    if (dynamicValue && !isCarSaleCategory) {
      return `${extraLabel}: ${dynamicValue}`;
    }

    return "";
  };

  const onApplyAiSuggestion = () => {
    setErrorKey(null);
    setErrorMessage(null);
    setAssistantMessage(null);
    const sourceText = [aiPrompt, title, description, extraDetails].join("\n").trim();
    if (!sourceText) {
      setAssistantMessage(t("marketplace.create.ai.emptyInput"));
      return;
    }

    setIsAiApplying(true);
    const inferredOfferType = inferOfferTypeFromText(sourceText);
    const targetOfferType = inferredOfferType ?? offerType ?? "request";
    const inferredCategory = inferCategoryFromText(targetOfferType, sourceText);
    const extractedBudget = extractBudgetFromText(sourceText);
    const titlePrefix = t(`marketplace.create.ai.prefixes.${targetOfferType}`);
    const suggestedTitle = deriveSmartTitle(sourceText, titlePrefix);

    if (inferredOfferType && inferredOfferType !== offerType) {
      setOfferType(inferredOfferType);
      setCategory(null);
    }
    if (inferredCategory) {
      setCategory(inferredCategory);
    }
    if (!title.trim() && suggestedTitle) {
      setTitle(suggestedTitle);
    }
    if (!description.trim()) {
      setDescription(sourceText.slice(0, 320));
    }
    if (!extraDetails.trim()) {
      setExtraDetails(sourceText.slice(0, 180));
    }
    if (!price.trim() && extractedBudget) {
      setPrice(extractedBudget);
    }

    const fieldsUpdated: string[] = [];
    if (inferredOfferType) {
      fieldsUpdated.push(t("marketplace.create.ai.updatedType"));
    }
    if (inferredCategory) {
      fieldsUpdated.push(t("marketplace.create.ai.updatedCategory"));
    }
    if (suggestedTitle && !title.trim()) {
      fieldsUpdated.push(t("marketplace.create.ai.updatedTitle"));
    }
    if (!description.trim()) {
      fieldsUpdated.push(t("marketplace.create.ai.updatedDescription"));
    }
    if (!extraDetails.trim()) {
      fieldsUpdated.push(t("marketplace.create.ai.updatedDetails"));
    }
    if (extractedBudget && !price.trim()) {
      fieldsUpdated.push(t("marketplace.create.ai.updatedBudget"));
    }

    setAssistantMessage(
      fieldsUpdated.length > 0
        ? t("marketplace.create.ai.applied", { fields: fieldsUpdated.join("، ") })
        : t("marketplace.create.ai.noSignal")
    );
    setIsAiApplying(false);
  };

  useEffect(() => {
    if (!draftStorageKey) {
      draftHydratedRef.current = true;
      return;
    }

    draftHydratedRef.current = false;
    let active = true;

    void AsyncStorage.getItem(draftStorageKey)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }

        const parsed = JSON.parse(raw) as Partial<ListingDraftSnapshot>;
        if (parsed.draftId) setDraftListingId(parsed.draftId);
        if (typeof parsed.currentStepIndex === "number" && parsed.currentStepIndex >= 0 && parsed.currentStepIndex < FLOW_STEPS.length) {
          setCurrentStepIndex(parsed.currentStepIndex);
        }
        if (parsed.offerType) setOfferType(parsed.offerType);
        if (parsed.category) setCategory(parsed.category);
        if (typeof parsed.title === "string") setTitle(parsed.title);
        if (typeof parsed.description === "string") setDescription(parsed.description);
        if (typeof parsed.extraDetails === "string") setExtraDetails(parsed.extraDetails);
        if (typeof parsed.price === "string") setPrice(parsed.price);
        if (parsed.carBrand) setCarBrand(parsed.carBrand);
        if (typeof parsed.carModelSearch === "string") setCarModelSearch(parsed.carModelSearch);
        if (typeof parsed.carModelOption === "string" || parsed.carModelOption === null) setCarModelOption(parsed.carModelOption ?? null);
        if (typeof parsed.carModelOther === "string") setCarModelOther(parsed.carModelOther);
        if (typeof parsed.carYear === "string" || parsed.carYear === null) setCarYear(parsed.carYear ?? null);
        if (typeof parsed.carLocation === "string") setCarLocation(parsed.carLocation);
        if (typeof parsed.carMileage === "string") setCarMileage(parsed.carMileage);
        if (typeof parsed.carLatitude === "number" || parsed.carLatitude === null) setCarLatitude(parsed.carLatitude ?? null);
        if (typeof parsed.carLongitude === "number" || parsed.carLongitude === null) setCarLongitude(parsed.carLongitude ?? null);
        if (parsed.carAdType) setCarAdType(parsed.carAdType);
        if (parsed.carCondition) setCarCondition(parsed.carCondition);
        if (parsed.carFuelType) setCarFuelType(parsed.carFuelType);
        if (parsed.carPriceMode) setCarPriceMode(parsed.carPriceMode);
        if (Array.isArray(parsed.selectedImages)) setSelectedImages(normalizeSelectedImages(parsed.selectedImages as SelectedImage[]));
        if (parsed.selectedVideo && typeof parsed.selectedVideo === "object") setSelectedVideo(parsed.selectedVideo as SelectedVideo);
        if (typeof parsed.isCommissionAccepted === "boolean") setIsCommissionAccepted(parsed.isCommissionAccepted);
        setPendingSyncOperations(Array.isArray(parsed.pendingSyncOperations) ? parsed.pendingSyncOperations : []);
        setLastSyncedRemoteAt(parsed.lastSyncedRemoteAt ?? null);
        setDraftConflict(parsed.remoteConflict ?? null);
        if (typeof parsed.updatedAt === "string") setLastDraftSavedAt(parsed.updatedAt);
        if (Array.isArray(parsed.pendingSyncOperations) && parsed.pendingSyncOperations.length > 0) {
          draftSyncRetryRequestedRef.current = true;
        }
        setAssistantMessage(t("marketplace.create.draft.restored"));
      })
      .catch(() => {
        setErrorMessage(t("marketplace.create.draft.saveFailed"));
      })
      .finally(() => {
        draftHydratedRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [draftStorageKey, t]);

  useEffect(() => {
    if (!draftSyncRetryRequestedRef.current || !draftHydratedRef.current || !snapshot.user?.id) {
      return;
    }

    draftSyncRetryRequestedRef.current = false;
    void persistDraft(true);
  }, [persistDraft, snapshot.user?.id]);

  useEffect(() => {
    if (!draftStorageKey || !snapshot.user?.id || !draftHydratedRef.current || isSubmitting) {
      return;
    }

    const timer = setTimeout(() => {
      void persistDraft(true);
    }, 1200);

    return () => {
      clearTimeout(timer);
    };
  }, [
    carAdType,
    carBrand,
    carCondition,
    carFuelType,
    carLatitude,
    carLocation,
    carLongitude,
    carMileage,
    carModelOption,
    carModelOther,
    carModelSearch,
    carPriceMode,
    carYear,
    category,
    currentStepIndex,
    description,
    draftStorageKey,
    extraDetails,
    isCommissionAccepted,
    isSubmitting,
    offerType,
    persistDraft,
    price,
    selectedImages,
    selectedVideo,
    snapshot.user?.id,
    title
  ]);

  useEffect(() => {
    if (!isCarSaleCategory || carLocation.trim().length > 0) {
      return;
    }

    setCarLocation(defaultLocationName);

    if (Platform.OS !== "web") {
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setCarLocation(defaultLocationName);
      return;
    }

    setIsLocatingCar(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setCarLatitude(latitude);
        setCarLongitude(longitude);
        setCarLocation(t("marketplace.create.carDetails.currentLocationLabel"));
        setIsLocatingCar(false);
      },
      () => {
        setCarLocation(defaultLocationName);
        setIsLocatingCar(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, [carLocation, defaultLocationName, isCarSaleCategory, t]);

  const applyCarBrandSelection = (nextBrand: CarMakeId) => {
    setCarBrand(nextBrand);
    setRecentCarBrands((previous) => [nextBrand, ...previous.filter((item) => item !== nextBrand)].slice(0, 5));
    setCarModelOption(null);
    setCarModelOther("");
    setCarModelSearch("");
    setCarYear(null);
    setErrorKey(null);
  };

  const onSelectCarBrand = (nextBrand: CarMakeId) => {
    if (!carModelOption || carBrand === nextBrand) {
      applyCarBrandSelection(nextBrand);
      return;
    }

    const titleText = t("marketplace.create.carDetails.makeChangeConfirmTitle");
    const messageText = t("marketplace.create.carDetails.makeChangeConfirmMessage");
    if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
      if (globalThis.confirm(messageText)) {
        applyCarBrandSelection(nextBrand);
        setErrorMessage(t("marketplace.create.carDetails.modelClearedHint"));
      }
      return;
    }

    Alert.alert(titleText, messageText, [
      {
        text: t("marketplace.create.flow.back"),
        style: "cancel"
      },
      {
        text: t("marketplace.create.flow.next"),
        style: "destructive",
        onPress: () => {
          applyCarBrandSelection(nextBrand);
          setErrorMessage(t("marketplace.create.carDetails.modelClearedHint"));
        }
      }
    ]);
  };

  const openMapEditor = () => {
    const latitude = carLatitude ?? defaultLatitude;
    const longitude = carLongitude ?? defaultLongitude;
    setMapDraftLatitude(latitude.toFixed(6));
    setMapDraftLongitude(longitude.toFixed(6));
    setMapDraftLocation(carLocation.trim() || defaultLocationName);
    setIsMapEditorOpen(true);
  };

  const onSaveMapEditor = () => {
    const parsedLatitude = Number(mapDraftLatitude);
    const parsedLongitude = Number(mapDraftLongitude);
    if (Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude)) {
      setCarLatitude(parsedLatitude);
      setCarLongitude(parsedLongitude);
    }
    setCarLocation(mapDraftLocation.trim() || defaultLocationName);
    setIsMapEditorOpen(false);
  };

  const onPickVideo = async () => {
    setErrorKey(null);
    setErrorMessage(null);

    if (Platform.OS !== "web") {
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        setErrorMessage(t("marketplace.create.images.videoPermissionDenied"));
        return;
      }
    }

    setIsVideoProcessing(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const pickedAsset = result.assets[0];
      const durationSeconds = Math.round((pickedAsset.duration ?? 0) / 1000);
      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        setErrorMessage(t("marketplace.create.images.videoDurationExceeded"));
        return;
      }

      let sizeBytes = pickedAsset.fileSize ?? null;
      if (sizeBytes === null) {
        const fileInfo = await FileSystem.getInfoAsync(pickedAsset.uri, { size: true });
        if (fileInfo.exists && "size" in fileInfo && typeof fileInfo.size === "number") {
          sizeBytes = fileInfo.size;
        }
      }

      if (sizeBytes !== null && sizeBytes > MAX_VIDEO_SIZE_BYTES) {
        setErrorMessage(t("marketplace.create.images.videoTooLargeAfterCompression", { maxSizeMb: MAX_VIDEO_SIZE_MB }));
        return;
      }

      setSelectedVideo({
        uri: pickedAsset.uri,
        durationSeconds,
        sizeBytes
      });
    } catch (videoError) {
      setErrorMessage(resolveCreateErrorMessage(videoError, t("marketplace.create.images.videoProcessFailed")));
    } finally {
      setIsVideoProcessing(false);
    }
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    setSelectedImages((previous) => {
      if (toIndex < 0 || toIndex >= previous.length || fromIndex === toIndex) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return previous;
      }
      next.splice(toIndex, 0, moved);
      return normalizeSelectedImages(next);
    });
  };

  const removeImage = (imageId: string) => {
    setSelectedImages((previous) => {
      const next = previous.filter((image) => image.localId !== imageId);
      return normalizeSelectedImages(next);
    });
  };

  const retryImageUpload = (imageId: string) => {
    setSelectedImages((previous) => markListingImageForRetry(previous, imageId));
    setErrorMessage(null);
  };

  const setPrimaryImage = (imageId: string) => {
    setSelectedImages((previous) => {
      const targetIndex = previous.findIndex((image) => image.localId === imageId);
      if (targetIndex < 0) {
        return previous;
      }
      const next = [...previous];
      const [target] = next.splice(targetIndex, 1);
      if (!target) {
        return previous;
      }
      next.unshift(target);
      return normalizeSelectedImages(next);
    });
  };

  const addImages = async (items: Array<{ uri: string; sizeBytes: number | null; mimeType?: string }>) => {
    if (items.length === 0) {
      return;
    }

    const overflowCount = Math.max(0, selectedImagesCount + items.length - MAX_IMAGE_COUNT);
    const acceptedItems = overflowCount > 0 ? items.slice(0, MAX_IMAGE_COUNT - selectedImagesCount) : items;

    const oversized = acceptedItems.find((item) => item.sizeBytes !== null && item.sizeBytes > MAX_IMAGE_SIZE_BYTES);
    if (oversized) {
      setErrorMessage(t("marketplace.create.images.imageTooLarge", { maxSizeMb: MAX_IMAGE_SIZE_MB }));
      return;
    }

    setSelectedImages((previous) => {
      const next = [...previous];
      for (const item of acceptedItems) {
        next.push(
          createListingImageUploadItem({
            localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            localUri: item.uri,
            previewUri: item.uri,
            fileSize: item.sizeBytes ?? undefined,
            mimeType: item.mimeType
          })
        );
      }
      return normalizeSelectedImages(next);
    });

    if (overflowCount > 0) {
      setErrorMessage(t("marketplace.create.images.maxReached", { max: MAX_IMAGE_COUNT }));
    }
  };

  const onPickImage = async () => {
    setErrorKey(null);
    setErrorMessage(null);
    if (!canAddMoreImages) {
      setErrorMessage(t("marketplace.create.images.maxReached", { max: MAX_IMAGE_COUNT }));
      return;
    }

    if (Platform.OS === "web") {
      const webDocument = (globalThis as { document?: { createElement(tag: string): any } }).document;
      if (!webDocument) {
        setErrorMessage(t("marketplace.create.images.imagePickFailed"));
        return;
      }

      const fileInput = webDocument.createElement("input") as HTMLInputElement;
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.multiple = true;
      fileInput.onchange = async () => {
        const files = fileInput.files ? (Array.from(fileInput.files) as File[]) : [];
        if (files.length === 0) {
          return;
        }
        const picked = await Promise.all(
          files.map(async (file) => ({
            uri: await readFileAsDataUrl(file),
            sizeBytes: file.size,
            mimeType: file.type
          }))
        );
        await addImages(picked);
      };
      fileInput.click();
      return;
    }

    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!mediaPermission.granted) {
      setErrorMessage(t("marketplace.create.images.imagePermissionDenied"));
      return;
    }

    try {
      setIsImagePicking(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGE_COUNT - selectedImagesCount,
        base64: true,
        quality: 0.7
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const pickedAssets: Array<{ uri: string; sizeBytes: number | null; mimeType?: string }> = [];
      for (const asset of result.assets) {
        let sizeBytes = asset.fileSize ?? null;
        if (sizeBytes === null) {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri, { size: true });
          if (fileInfo.exists && "size" in fileInfo && typeof fileInfo.size === "number") {
            sizeBytes = fileInfo.size;
          }
        }
        const mimeType = asset.mimeType?.trim() || inferImageMimeType(asset.uri);
        const persistedUri =
          typeof asset.base64 === "string" && asset.base64.trim().length > 0
            ? `data:${mimeType};base64,${asset.base64}`
            : await convertFileUriToDataUrl(asset.uri);
        pickedAssets.push({ uri: persistedUri, sizeBytes, mimeType });
      }
      await addImages(pickedAssets);
    } catch (imageError) {
      setErrorMessage(resolveCreateErrorMessage(imageError, t("marketplace.create.images.imagePickFailed")));
    } finally {
      setIsImagePicking(false);
    }
  };

  const onSubmit = async () => {
    setErrorKey(null);
    setErrorMessage(null);

    if (!snapshot.user) {
      setErrorKey("marketplace.create.errors.authRequired");
      return;
    }

    const validationErrors = validateCarListingDraft({
      isCarSaleCategory,
      shouldRequirePrice: shouldShowPriceInput,
      carBrand,
      carModelOption,
      carModelOther,
      carYear,
      carMileage,
      parsedPrice
    });

    if (!title.trim()) {
      setErrorKey("marketplace.create.errors.titleRequired");
      return;
    }

    if (validationErrors.length > 0) {
      setErrorKey(`marketplace.create.errors.${validationErrors[0]}`);
      return;
    }
    if (selectedImagesCount < MIN_IMAGE_COUNT) {
      setErrorKey("marketplace.create.errors.imagesMinimumRequired");
      return;
    }
    if (isImagePicking) {
      setErrorKey("marketplace.create.errors.imagesProcessing");
      return;
    }

    const submitPrice = shouldShowPriceInput ? parsedPrice : 1;
    const uploadedImages = await ensureUploadedImages();
    const submitImageUrl = serializeListingImageUrls(
      uploadedImages.map((item) => item.publicUrl).filter((value): value is string => typeof value === "string")
    );
    const submitLocationName = isCarSaleCategory ? carLocation.trim() || defaultLocationName : defaultLocationName;
    const submitLatitude = isCarSaleCategory && carLatitude !== null ? carLatitude : defaultLatitude;
    const submitLongitude = isCarSaleCategory && carLongitude !== null ? carLongitude : defaultLongitude;
    const ownerPhone =
      (snapshot.user.phone && snapshot.user.phone.trim().length > 0 ? snapshot.user.phone.trim() : null) ??
      readMetadataPhone(snapshot.user.user_metadata);

    setIsSubmitting(true);
    try {
      const sessionToken = snapshot.session?.access_token;
      const repository =
        sessionToken && sessionToken.trim().length > 0
          ? createListingsRepository(
              createClient(getMobileSupabaseEnv().supabaseUrl, getMobileSupabaseEnv().supabaseAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: {
                  headers: {
                    Authorization: `Bearer ${sessionToken}`
                  }
                }
              })
            )
          : listingsRepository;

      let createdListing = await repository.publishDraft({
        id: draftListingId ?? undefined,
        ownerId: snapshot.user.id,
        ownerPhone: ownerPhone ?? undefined,
        title: title.trim(),
        description: buildListingDescription(),
        price: submitPrice,
        imageUrl: submitImageUrl ?? undefined,
        images: toCreateListingImageInputs(uploadedImages),
        status: "available",
        locationName: submitLocationName,
        latitude: submitLatitude,
        longitude: submitLongitude
      });
      if (!createdListing && sessionToken) {
        createdListing = await createListingViaRest({
          sessionToken,
          ownerId: snapshot.user.id,
          ownerPhone,
          title: title.trim(),
          description: buildListingDescription(),
          price: submitPrice,
          imageUrl: submitImageUrl,
          locationName: submitLocationName,
          latitude: submitLatitude,
          longitude: submitLongitude
        });
      }
      if (draftStorageKey) {
        await AsyncStorage.removeItem(draftStorageKey);
      }
      setDraftListingId(null);
      setLastDraftSavedAt(null);
      setPendingSyncOperations([]);
      setLastSyncedRemoteAt(null);
      setDraftConflict(null);
      onCreated(createdListing);
    } catch (createError) {
      if (isRlsInsertError(createError)) {
        onCreated(
          createLocalListing({
            ownerId: snapshot.user.id,
            ownerPhone,
            title: title.trim(),
            description: buildListingDescription(),
            price: submitPrice,
            locationName: submitLocationName,
            imageUrl: submitImageUrl
          })
        );
        return;
      }

      try {
        const sessionToken = snapshot.session?.access_token;
        if (sessionToken && isRlsInsertError(createError)) {
          const createdListing = await createListingViaRest({
            sessionToken,
            ownerId: snapshot.user.id,
            ownerPhone,
            title: title.trim(),
            description: buildListingDescription(),
            price: submitPrice,
            imageUrl: submitImageUrl,
            locationName: submitLocationName,
            latitude: submitLatitude,
            longitude: submitLongitude
          });
          onCreated(createdListing);
          return;
        }
      } catch (fallbackError) {
        if (isRlsInsertError(fallbackError)) {
          onCreated(
            createLocalListing({
              ownerId: snapshot.user.id,
              ownerPhone,
              title: title.trim(),
              description: buildListingDescription(),
              price: submitPrice,
              locationName: submitLocationName,
              imageUrl: submitImageUrl
            })
          );
          return;
        }
        setErrorMessage(resolveCreateErrorMessage(fallbackError, t("marketplace.loadError")));
        return;
      }

      setErrorMessage(resolveCreateErrorMessage(createError, t("marketplace.loadError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onNext = () => {
    setErrorKey(null);
    setErrorMessage(null);

    if (currentStep === "category") {
      if (!offerType) {
        setErrorKey("marketplace.create.errors.offerTypeRequired");
        return;
      }
      if (!category) {
        setErrorKey("marketplace.create.errors.categoryRequired");
        return;
      }
    }

    if (currentStep === "details") {
      const validationErrors = validateCarListingDraft({
        isCarSaleCategory,
        shouldRequirePrice: shouldShowPriceInput,
        carBrand,
        carModelOption,
        carModelOther,
        carYear,
        carMileage,
        parsedPrice
      });

      if (!title.trim()) {
        setErrorKey("marketplace.create.errors.titleRequired");
        return;
      }

      if (validationErrors.length > 0) {
        setErrorKey(`marketplace.create.errors.${validationErrors[0]}`);
        return;
      }
      if (selectedImagesCount < MIN_IMAGE_COUNT) {
        setErrorKey("marketplace.create.errors.imagesMinimumRequired");
        return;
      }
      if (isImagePicking) {
        setErrorKey("marketplace.create.errors.imagesProcessing");
        return;
      }

      if (isCarSaleCategory && !carLocation.trim()) {
        setErrorKey("marketplace.create.errors.carLocationRequired");
        return;
      }
    }

    if (currentStep === "agreement" && !isCommissionAccepted) {
      setErrorKey("marketplace.create.errors.agreementRequired");
      return;
    }

    if (currentStepIndex < FLOW_STEPS.length - 1) {
      setCurrentStepIndex((value) => value + 1);
      void persistDraft(false);
    }
  };

  const onBack = () => {
    setErrorKey(null);
    setErrorMessage(null);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((value) => value - 1);
      void persistDraft(false);
    }
  };

  const onSaveDraftAndExit = async () => {
    setErrorKey(null);
    setErrorMessage(null);
    await persistDraft(true);
    onExit();
  };

  const onPublish = async () => {
    setErrorKey(null);
    setErrorMessage(null);
    if (!isCommissionAccepted) {
      setErrorKey("marketplace.create.errors.agreementRequired");
      return;
    }
    await onSubmit();
  };

  return (
    <View style={styles.container}>
      <MobileSectionHeader
        direction={direction}
        title={t("marketplace.create.title")}
        subtitle={t("marketplace.create.flow.stepProgress", { current: currentStepIndex + 1, total: FLOW_STEPS.length })}
      />

      <View style={styles.stepsRow}>
        {FLOW_STEPS.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isDone = index < currentStepIndex;
          return (
            <View key={step} style={[styles.stepIndicator, isActive ? styles.stepIndicatorActive : undefined, isDone ? styles.stepIndicatorDone : undefined]}>
              <Text style={[styles.stepIndicatorLabel, isActive ? styles.stepIndicatorLabelActive : undefined]}>{index + 1}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          {currentStep === "category" ? (
            <View>
              <Text style={[styles.stepTitle, { textAlign }]}>{t("marketplace.create.flow.categoryTitle")}</Text>
              <Text style={[styles.stepHint, { textAlign }]}>{t("marketplace.create.flow.categoryHint")}</Text>
              <Text style={[styles.sectionLabel, { textAlign }]}>{t("marketplace.create.flow.offerTypeTitle")}</Text>
              <View style={styles.categoryGrid}>
                {OFFER_TYPES.map((item) => {
                  const selected = item === offerType;
                  return (
                    <Pressable
                      key={item}
                      style={[styles.categoryCard, selected ? styles.categoryCardSelected : undefined]}
                      onPress={() => {
                        setOfferType(item);
                        setCategory(null);
                        setErrorKey(null);
                      }}
                    >
                      <Text style={[styles.categoryLabel, selected ? styles.categoryLabelSelected : undefined]}>{t(`marketplace.create.offerTypes.${item}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {offerType ? (
                <>
                  <Text style={[styles.sectionLabel, styles.secondSectionLabel, { textAlign }]}>{t("marketplace.create.flow.subCategoryTitle")}</Text>
                  <View style={styles.categoryGrid}>
                    {selectedTypeCategories.map((item) => {
                      const selected = item === category;
                      return (
                        <Pressable
                          key={item}
                          style={[styles.categoryCard, selected ? styles.categoryCardSelected : undefined]}
                          onPress={() => {
                            setCategory(item);
                            setExtraDetails("");
                            setErrorKey(null);
                          }}
                        >
                          <Text style={[styles.categoryLabel, selected ? styles.categoryLabelSelected : undefined]}>{t(`marketplace.create.categories.${item}`)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {currentStep === "details" ? (
            <View>
              <Text style={[styles.stepTitle, { textAlign }]}>{t("marketplace.create.flow.detailsTitle")}</Text>
              <Text style={[styles.sectionLabel, { textAlign }]}>{t("marketplace.create.images.title")}</Text>
              <View style={styles.imageSlotsRow}>
                {selectedImages.map((image, index) => (
                  <View key={image.localId} style={styles.imageCard}>
                    <Image source={{ uri: image.previewUri }} style={styles.imageSlotPreview} resizeMode="cover" />
                    <View style={[styles.imageCardTopRow, direction === "rtl" ? styles.imageCardTopRowRtl : undefined]}>
                      {image.isPrimary ? (
                        <Text style={styles.imagePrimaryBadge}>{t("marketplace.create.images.primaryBadge")}</Text>
                      ) : (
                        <Pressable style={styles.imageMiniAction} onPress={() => setPrimaryImage(image.localId)}>
                          <Text style={styles.imageMiniActionLabel}>{t("marketplace.create.images.makePrimary")}</Text>
                        </Pressable>
                      )}
                      <Pressable style={styles.imageMiniActionDanger} onPress={() => removeImage(image.localId)}>
                        <Text style={styles.imageMiniActionLabelDanger}>{t("marketplace.create.images.remove")}</Text>
                      </Pressable>
                    </View>
                    <View style={[styles.imageCardActions, direction === "rtl" ? styles.imageCardTopRowRtl : undefined]}>
                      <Text style={styles.imageStatusLabel}>{t(`marketplace.create.images.status.${image.status}`)}</Text>
                      {image.status === "failed" ? (
                        <Pressable style={styles.imageMiniAction} onPress={() => retryImageUpload(image.localId)}>
                          <Text style={styles.imageMiniActionLabel}>{t("marketplace.create.images.retry")}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={[styles.imageCardActions, direction === "rtl" ? styles.imageCardTopRowRtl : undefined]}>
                      <Pressable style={styles.imageMiniAction} disabled={index === 0} onPress={() => moveImage(index, index - 1)}>
                        <Text style={styles.imageMiniActionLabel}>{t("marketplace.create.images.moveUp")}</Text>
                      </Pressable>
                      <Pressable style={styles.imageMiniAction} disabled={index === selectedImages.length - 1} onPress={() => moveImage(index, index + 1)}>
                        <Text style={styles.imageMiniActionLabel}>{t("marketplace.create.images.moveDown")}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {canAddMoreImages ? (
                  <Pressable key="add-image" style={styles.imageSlot} onPress={() => void onPickImage()}>
                    {isImagePicking ? <Text style={styles.imageSlotPlus}>{t("common.loading")}</Text> : <Text style={styles.imageSlotPlus}>+</Text>}
                  </Pressable>
                ) : null}
              </View>
              <Text style={[styles.imageHint, { textAlign }]}>{t("marketplace.create.images.hint")}</Text>
              <Text style={[styles.imageHint, { textAlign }]}>{t("marketplace.create.images.selectedCount", { count: selectedImagesCount })}</Text>
              <Text style={[styles.imageHint, { textAlign }]}>{t("marketplace.create.images.idealCountHint", { count: IDEAL_IMAGE_COUNT })}</Text>
              {getFailedListingImageUploads(selectedImages).length > 0 ? (
                <Text style={[styles.imageHint, styles.imageHintWarning, { textAlign }]}>{t("marketplace.create.images.uploadFailed")}</Text>
              ) : null}
              {hasPendingDraftSyncOperations(pendingSyncOperations) ? (
                <Text style={[styles.imageHint, { textAlign }]}>{t("marketplace.create.draft.queuePending", { count: pendingSyncOperations.length })}</Text>
              ) : null}
              {hasPendingListingImageUploads(selectedImages) ? (
                <Text style={[styles.imageHint, { textAlign }]}>{t("marketplace.create.images.uploadPending")}</Text>
              ) : null}
              {draftConflict ? (
                <View style={styles.draftConflictCard}>
                  <Text style={[styles.draftConflictTitle, { textAlign }]}>{t("marketplace.create.draft.conflictDetected")}</Text>
                  <View style={[styles.imageCardActions, direction === "rtl" ? styles.imageCardTopRowRtl : undefined]}>
                    <Pressable
                      style={styles.imageMiniAction}
                      onPress={() => {
                        if (draftConflict) {
                          setLastSyncedRemoteAt(draftConflict.remoteUpdatedAt);
                        }
                        void persistDraft(true);
                      }}
                    >
                      <Text style={styles.imageMiniActionLabel}>{t("marketplace.create.draft.overwriteRemote")}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.imageMiniAction}
                      onPress={() => {
                        setDraftConflict(null);
                        setPendingSyncOperations([]);
                      }}
                    >
                      <Text style={styles.imageMiniActionLabel}>{t("marketplace.create.draft.keepLocalOnly")}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              <View style={[styles.videoUploadCard, direction === "rtl" ? styles.videoUploadCardRtl : undefined]}>
                <Pressable style={styles.videoUploadSlot} onPress={() => void onPickVideo()}>
                  <Text style={styles.videoUploadIcon}>▶</Text>
                </Pressable>
                <View style={styles.videoUploadMeta}>
                  <Text style={[styles.videoUploadTitle, { textAlign }]}>{t("marketplace.create.images.videoTitle")}</Text>
                  <Text style={[styles.videoUploadHint, { textAlign }]}>
                    {isVideoProcessing ? t("marketplace.create.images.videoProcessing") : t("marketplace.create.images.videoHint")}
                  </Text>
                  <Pressable style={styles.videoUploadAction} onPress={() => void onPickVideo()} disabled={isVideoProcessing}>
                    <Text style={styles.videoUploadActionLabel}>
                      {selectedVideo ? t("marketplace.create.images.videoReplaceCta") : t("marketplace.create.images.videoSelectCta")}
                    </Text>
                  </Pressable>
                  {selectedVideoSummary ? <Text style={[styles.videoUploadStatus, { textAlign }]}>{selectedVideoSummary}</Text> : null}
                  {selectedVideo ? <Text style={[styles.videoUploadStatus, { textAlign }]}>{t("marketplace.create.images.videoCompressNote")}</Text> : null}
                </View>
              </View>

              {isRequestOffer ? (
                <View style={styles.aiAssistantCard}>
                  <Text style={[styles.aiAssistantTitle, { textAlign }]}>{t("marketplace.create.ai.title")}</Text>
                  <Text style={[styles.aiAssistantHint, { textAlign }]}>{t("marketplace.create.ai.hint")}</Text>
                  <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.ai.inputLabel")}</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput, { textAlign }]}
                    multiline
                    value={aiPrompt}
                    onChangeText={setAiPrompt}
                    placeholder={t("marketplace.create.ai.inputPlaceholder")}
                  />
                  <Pressable style={[styles.aiAssistantButton, isAiApplying ? styles.aiAssistantButtonDisabled : undefined]} disabled={isAiApplying} onPress={onApplyAiSuggestion}>
                    <Text style={styles.aiAssistantButtonLabel}>{isAiApplying ? t("marketplace.create.ai.runningButton") : t("marketplace.create.ai.runButton")}</Text>
                  </Pressable>
                  {assistantMessage ? <Text style={[styles.aiAssistantMessage, { textAlign }]}>{assistantMessage}</Text> : null}
                </View>
              ) : null}

              <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.listingTitleLabel")}</Text>
              <TextInput
                style={[styles.input, { textAlign }]}
                value={title}
                onChangeText={setTitle}
                placeholder={t("marketplace.create.listingTitlePlaceholder")}
              />

              <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.listingDescriptionLabel")}</Text>
              <TextInput
                style={[styles.input, styles.multilineInput, { textAlign }]}
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder={t("marketplace.create.listingDescriptionPlaceholder")}
              />

              {isCarSaleCategory ? (
                <View style={styles.carDetailsCard}>
                  <Text style={[styles.carDetailsTitle, { textAlign }]}>{t("marketplace.create.carDetails.title")}</Text>

                  <View style={[styles.fieldLabelRow, direction === "rtl" ? styles.fieldLabelRowRtl : undefined]}>
                    <MobileIcon name="cars" size={14} color="#2563eb" />
                    <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.brandLabel")}</Text>
                  </View>
                  <Text style={[styles.selectionHint, { textAlign }]}>{t("marketplace.create.carDetails.selectModelHint")}</Text>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    value={carBrandSearch}
                    onChangeText={setCarBrandSearch}
                    placeholder={t("marketplace.create.carDetails.brandSearchPlaceholder")}
                  />
                  {recentCarBrands.length > 0 ? (
                    <>
                      <Text style={[styles.selectionHint, { textAlign }]}>{t("marketplace.create.carDetails.recentBrandsTitle")}</Text>
                      <View style={styles.optionsRow}>
                        {recentCarBrands.map((item) => (
                          <Pressable key={`recent-${item}`} style={[styles.optionChip, carBrand === item ? styles.optionChipSelected : undefined]} onPress={() => onSelectCarBrand(item)}>
                            <Text style={[styles.optionChipLabel, carBrand === item ? styles.optionChipLabelSelected : undefined]}>
                              {carMakeLabelById[item]}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}
                  <View style={styles.optionsRow}>
                    {filteredCarMakes.map((item) => (
                      <Pressable
                        key={item}
                        style={[styles.optionChip, carBrand === item ? styles.optionChipSelected : undefined]}
                        onPress={() => onSelectCarBrand(item)}
                      >
                        <Text style={[styles.optionChipLabel, carBrand === item ? styles.optionChipLabelSelected : undefined]}>
                          {carMakeLabelById[item]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {filteredCarMakes.length === 0 ? <Text style={[styles.selectionHint, { textAlign }]}>{t("marketplace.create.carDetails.noBrandsFound")}</Text> : null}
                  {carBrand ? (
                    <Pressable
                      style={styles.mapEditorButton}
                      onPress={() => {
                        setCarBrand(null);
                        setCarModelOption(null);
                        setCarModelOther("");
                        setCarModelSearch("");
                        setCarYear(null);
                        setIsYearDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.mapEditorButtonLabel}>{t("marketplace.create.carDetails.clearSelection")}</Text>
                    </Pressable>
                  ) : null}

                  {carBrand ? (
                    <>
                      <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.modelOptionLabel")}</Text>
                      <TextInput
                        style={[styles.input, { textAlign }]}
                        value={carModelSearch}
                        onChangeText={setCarModelSearch}
                        placeholder={t("marketplace.create.carDetails.modelSearchPlaceholder")}
                      />
                      <View style={styles.optionsRow}>
                        {filteredCarModels.map((item) => (
                          <Pressable
                            key={item.id}
                            style={[styles.optionChip, carModelOption === item.id ? styles.optionChipSelected : undefined]}
                            onPress={() => {
                              setCarModelOption(item.id);
                              setCarModelOther("");
                              setErrorKey(null);
                            }}
                          >
                            <Text style={[styles.optionChipLabel, carModelOption === item.id ? styles.optionChipLabelSelected : undefined]}>{item.label}</Text>
                          </Pressable>
                        ))}
                        <Pressable
                          style={[styles.optionChip, carModelOption === OTHER_CAR_MODEL_ID ? styles.optionChipSelected : undefined]}
                          onPress={() => {
                            setCarModelOption(OTHER_CAR_MODEL_ID);
                            setErrorKey(null);
                          }}
                        >
                          <Text style={[styles.optionChipLabel, carModelOption === OTHER_CAR_MODEL_ID ? styles.optionChipLabelSelected : undefined]}>
                            {t("marketplace.create.carDetails.modelOtherOption")}
                          </Text>
                        </Pressable>
                      </View>
                      {filteredCarModels.length === 0 ? <Text style={[styles.selectionHint, { textAlign }]}>{t("marketplace.create.carDetails.noModelsFound")}</Text> : null}
                      {carModelOption === OTHER_CAR_MODEL_ID ? (
                        <>
                          <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.modelOtherLabel")}</Text>
                          <TextInput
                            style={[styles.input, { textAlign }]}
                            value={carModelOther}
                            onChangeText={setCarModelOther}
                            placeholder={t("marketplace.create.carDetails.modelOtherPlaceholder")}
                          />
                        </>
                      ) : null}

                      <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.yearLabel")}</Text>
                      <Pressable style={styles.yearDropdownTrigger} onPress={() => setIsYearDropdownOpen((value) => !value)}>
                        <Text style={[styles.yearDropdownValue, { textAlign }]}>{carYear ?? t("marketplace.create.carDetails.yearSearchPlaceholder")}</Text>
                      </Pressable>
                      {isYearDropdownOpen ? (
                        <ScrollView style={styles.yearDropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                          {carYears.map((item) => (
                            <Pressable
                              key={item}
                              style={[styles.yearDropdownItem, carYear === item ? styles.yearDropdownItemSelected : undefined]}
                              onPress={() => {
                                setCarYear(item);
                                setIsYearDropdownOpen(false);
                              }}
                            >
                              <Text style={[styles.yearDropdownItemLabel, carYear === item ? styles.yearDropdownItemLabelSelected : undefined]}>{item}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      ) : null}
                    </>
                  ) : (
                    <Text style={[styles.selectionHint, { textAlign }]}>{t("marketplace.create.carDetails.selectBrandFirst")}</Text>
                  )}

                  <View style={[styles.fieldLabelRow, direction === "rtl" ? styles.fieldLabelRowRtl : undefined]}>
                    <MobileIcon name="location" size={14} color="#2563eb" />
                    <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.locationLabel")}</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    value={carLocation}
                    onChangeText={setCarLocation}
                    placeholder={t("marketplace.create.carDetails.locationPlaceholder")}
                  />
                  <View style={[styles.locationActionsRow, direction === "rtl" ? styles.locationActionsRowRtl : undefined]}>
                    <Text style={[styles.locationHint, { textAlign }]}>
                      {isLocatingCar ? t("marketplace.create.carDetails.locationDetecting") : t("marketplace.create.carDetails.locationAutoDetected")}
                    </Text>
                    <Pressable style={styles.mapEditorButton} onPress={openMapEditor}>
                      <Text style={styles.mapEditorButtonLabel}>{t("marketplace.create.carDetails.editLocationFromMap")}</Text>
                    </Pressable>
                  </View>

                  <View style={[styles.fieldLabelRow, direction === "rtl" ? styles.fieldLabelRowRtl : undefined]}>
                    <MobileIcon name="time" size={14} color="#2563eb" />
                    <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.mileageLabel")}</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    value={carMileage}
                    onChangeText={(value) => setCarMileage(value.replace(/[^\d]/g, ""))}
                    keyboardType="numeric"
                    placeholder={t("marketplace.create.carDetails.mileagePlaceholder")}
                  />

                  <>
                      <View style={[styles.fieldLabelRow, direction === "rtl" ? styles.fieldLabelRowRtl : undefined]}>
                        <MobileIcon name="filter" size={14} color="#2563eb" />
                        <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.adTypeLabel")}</Text>
                      </View>
                      <View style={styles.optionsRow}>
                        {CAR_AD_TYPES.map((item) => (
                          <Pressable key={item} style={[styles.optionChip, carAdType === item ? styles.optionChipSelected : undefined]} onPress={() => setCarAdType(item)}>
                            <Text style={[styles.optionChipLabel, carAdType === item ? styles.optionChipLabelSelected : undefined]}>
                              {t(`marketplace.create.carDetails.adTypeOptions.${item}`)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={[styles.fieldLabelRow, direction === "rtl" ? styles.fieldLabelRowRtl : undefined]}>
                        <MobileIcon name="sort" size={14} color="#2563eb" />
                        <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.conditionLabel")}</Text>
                      </View>
                      <View style={styles.optionsRow}>
                        {CAR_CONDITIONS.map((item) => (
                          <Pressable key={item} style={[styles.optionChip, carCondition === item ? styles.optionChipSelected : undefined]} onPress={() => setCarCondition(item)}>
                            <Text style={[styles.optionChipLabel, carCondition === item ? styles.optionChipLabelSelected : undefined]}>
                              {t(`marketplace.create.carDetails.conditionOptions.${item}`)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={[styles.fieldLabelRow, direction === "rtl" ? styles.fieldLabelRowRtl : undefined]}>
                        <MobileIcon name="sort" size={14} color="#2563eb" />
                        <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.fuelLabel")}</Text>
                      </View>
                      <View style={styles.optionsRow}>
                        {CAR_FUEL_TYPES.map((item) => (
                          <Pressable key={item} style={[styles.optionChip, carFuelType === item ? styles.optionChipSelected : undefined]} onPress={() => setCarFuelType(item)}>
                            <Text style={[styles.optionChipLabel, carFuelType === item ? styles.optionChipLabelSelected : undefined]}>
                              {t(`marketplace.create.carDetails.fuelOptions.${item}`)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={[styles.fieldLabelRow, direction === "rtl" ? styles.fieldLabelRowRtl : undefined]}>
                        <MobileIcon name="filter" size={14} color="#2563eb" />
                        <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.priceModeLabel")}</Text>
                      </View>
                      <View style={styles.optionsRow}>
                        {CAR_PRICE_MODES.map((item) => (
                          <Pressable key={item} style={[styles.optionChip, carPriceMode === item ? styles.optionChipSelected : undefined]} onPress={() => setCarPriceMode(item)}>
                            <Text style={[styles.optionChipLabel, carPriceMode === item ? styles.optionChipLabelSelected : undefined]}>
                              {t(`marketplace.create.carDetails.priceModeOptions.${item}`)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                  </>
                </View>
              ) : null}

              {shouldShowPriceInput ? (
                <>
                  <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.listingPriceLabel")}</Text>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    placeholder={t("marketplace.create.listingPricePlaceholder")}
                  />
                </>
              ) : null}

              {!isCarSaleCategory ? (
                <>
                  <Text style={[styles.label, { textAlign }]}>{extraLabel}</Text>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    value={extraDetails}
                    onChangeText={setExtraDetails}
                    placeholder={extraPlaceholder}
                  />
                </>
              ) : null}
            </View>
          ) : null}

          {currentStep === "preview" ? (
            <View>
              <Text style={[styles.stepTitle, { textAlign }]}>{t("marketplace.create.flow.previewTitle")}</Text>
              <Text style={[styles.stepHint, { textAlign }]}>{t("marketplace.create.flow.previewHint")}</Text>
              <View style={styles.previewCard}>
                <Text style={[styles.previewTitle, { textAlign }]}>{title.trim() || t("marketplace.create.flow.previewFallbackTitle")}</Text>
                <Text style={[styles.previewItem, { textAlign }]}>
                  {t("marketplace.create.flow.previewType", { value: selectedOfferTypeLabel })}
                </Text>
                <Text style={[styles.previewItem, { textAlign }]}>
                  {t("marketplace.create.flow.previewCategory", { value: selectedCategoryLabel })}
                </Text>
                {shouldShowPriceInput ? (
                  <Text style={[styles.previewItem, { textAlign }]}>
                    {t("marketplace.create.flow.previewPrice", { value: formatWholeNumber(validPrice) })}
                  </Text>
                ) : (
                  <Text style={[styles.previewItem, { textAlign }]}>
                    {t("marketplace.create.flow.previewPriceMode", {
                      value: t(`marketplace.create.carDetails.priceModeOptions.${carPriceMode}`)
                    })}
                  </Text>
                )}
                <Text style={[styles.previewItem, { textAlign }]}>
                  {t("marketplace.create.flow.previewCommission", { value: formatWholeNumber(commissionFee) })}
                </Text>
                {selectedVideoSummary ? <Text style={[styles.previewItem, { textAlign }]}>{selectedVideoSummary}</Text> : null}
                {isCarSaleCategory ? (
                  <>
                    <Text style={[styles.previewItem, styles.previewMetaTitle, { textAlign }]}>{t("marketplace.create.carDetails.structuredTitle")}</Text>
                    <Text style={[styles.previewItem, { textAlign }]}>
                      {t("marketplace.create.carDetails.modelLabel")}: {carModel || "-"}
                    </Text>
                    <Text style={[styles.previewItem, { textAlign }]}>
                      {t("marketplace.create.carDetails.locationLabel")}: {carLocation || "-"}
                    </Text>
                    <Text style={[styles.previewItem, { textAlign }]}>
                      {t("marketplace.create.carDetails.mileageLabel")}: {carMileage || "-"}
                    </Text>
                    <Text style={[styles.previewItem, { textAlign }]}>
                      {t("marketplace.create.carDetails.conditionLabel")}: {t(`marketplace.create.carDetails.conditionOptions.${carCondition}`)}
                    </Text>
                    <Text style={[styles.previewItem, { textAlign }]}>
                      {t("marketplace.create.carDetails.priceModeLabel")}: {t(`marketplace.create.carDetails.priceModeOptions.${carPriceMode}`)}
                    </Text>
                  </>
                ) : null}
                <Text style={[styles.previewDescription, { textAlign }]}>{buildPreviewDescription() || t("marketplace.detail.noDescription")}</Text>
              </View>
            </View>
          ) : null}

          {currentStep === "agreement" ? (
            <View>
              <Text style={[styles.stepTitle, { textAlign }]}>{t("marketplace.create.flow.agreementTitle")}</Text>
              <Text style={[styles.stepHint, { textAlign }]}>{t("marketplace.create.flow.agreementHint")}</Text>
              <View style={styles.verseCard}>
                <Text style={[styles.agreementBasmala, { textAlign }]}>{t("marketplace.create.flow.agreementBasmala")}</Text>
                <Text style={[styles.verseLabel, { textAlign }]}>{t("marketplace.create.flow.agreementVerseLabel")}</Text>
                <Text style={[styles.verseText, { textAlign }]}>{t("marketplace.create.flow.agreementVerseText")}</Text>
                <Text style={[styles.verseCitation, { textAlign }]}>{t("marketplace.create.flow.agreementVerseCitation")}</Text>
              </View>
              <View style={styles.agreementCard}>
                <Text style={[styles.agreementItem, { textAlign }]}>{t("marketplace.create.flow.agreementCommitSecondary")}</Text>
                <Text style={[styles.agreementNoteTitle, { textAlign }]}>{t("marketplace.create.flow.agreementNoteTitle")}</Text>
                <Text style={[styles.agreementNoteBody, { textAlign }]}>{t("marketplace.create.flow.agreementNoteBody")}</Text>
              </View>
              <Pressable
                style={[styles.checkboxRow, isCommissionAccepted ? styles.checkboxRowActive : undefined]}
                onPress={() => {
                  setIsCommissionAccepted((value) => !value);
                  setErrorKey(null);
                }}
              >
                <View style={[styles.checkboxBox, isCommissionAccepted ? styles.checkboxBoxActive : undefined]}>
                  {isCommissionAccepted ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                </View>
                <Text style={[styles.checkboxLabel, { textAlign }]}>{t("marketplace.create.flow.agreementCommitPrimary")}</Text>
              </Pressable>
            </View>
          ) : null}

          {errorKey ? <Text style={[styles.errorLabel, { textAlign }]}>{t(errorKey)}</Text> : null}
          {errorMessage ? <Text style={[styles.errorLabel, { textAlign }]}>{errorMessage}</Text> : null}
          {isDraftSaving ? <Text style={[styles.infoLabel, { textAlign }]}>{t("marketplace.create.draft.saving")}</Text> : null}
          {!isDraftSaving && draftSavedAtLabel ? <Text style={[styles.infoLabel, { textAlign }]}>{t("marketplace.create.draft.savedAt", { value: draftSavedAtLabel })}</Text> : null}

          <View style={[styles.actionsRow, direction === "rtl" ? styles.actionsRowRtl : undefined]}>
            <Pressable
              style={[styles.secondaryButton, currentStepIndex === 0 ? styles.secondaryButtonDisabled : undefined]}
              disabled={currentStepIndex === 0 || isSubmitting}
              onPress={onBack}
            >
              <Text style={styles.secondaryButtonLabel}>{t("marketplace.create.flow.back")}</Text>
            </Pressable>

            {currentStep === "agreement" ? (
              <Pressable style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : undefined]} disabled={isSubmitting} onPress={() => void onPublish()}>
                <Text style={styles.submitLabel}>{isSubmitting ? t("common.loading") : t("marketplace.create.submit")}</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.submitButton} onPress={() => void onNext()}>
                <Text style={styles.submitLabel}>{t("marketplace.create.flow.next")}</Text>
              </Pressable>
            )}

            <Pressable style={[styles.secondaryButton, isSubmitting ? styles.secondaryButtonDisabled : undefined]} disabled={isSubmitting} onPress={() => void onSaveDraftAndExit()}>
              <Text style={styles.secondaryButtonLabel}>{t("marketplace.create.draft.saveAndExit")}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {isMapEditorOpen ? (
        <View style={styles.mapEditorOverlay}>
          <View style={styles.mapEditorCard}>
            <Text style={[styles.mapEditorTitle, { textAlign }]}>{t("marketplace.create.carDetails.mapEditorTitle")}</Text>
            <Text style={[styles.mapEditorHint, { textAlign }]}>{t("marketplace.create.carDetails.mapEditorHint")}</Text>
            <View style={styles.mapPreviewCard}>
              <Image source={{ uri: mapPreviewUrl }} style={styles.mapPreviewImage} resizeMode="cover" />
            </View>
            <Text style={[styles.label, { textAlign }]}>{t("marketplace.create.carDetails.locationLabel")}</Text>
            <TextInput
              style={[styles.input, { textAlign }]}
              value={mapDraftLocation}
              onChangeText={setMapDraftLocation}
              placeholder={t("marketplace.create.carDetails.locationPlaceholder")}
            />
            <View style={[styles.mapEditorActions, direction === "rtl" ? styles.mapEditorActionsRtl : undefined]}>
              <Pressable style={styles.secondaryButton} onPress={() => setIsMapEditorOpen(false)}>
                <Text style={styles.secondaryButtonLabel}>{t("marketplace.create.flow.back")}</Text>
              </Pressable>
              <Pressable style={styles.submitButton} onPress={onSaveMapEditor}>
                <Text style={styles.submitLabel}>{t("marketplace.create.carDetails.saveMapLocation")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  stepsRow: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  stepIndicator: {
    height: 26,
    minWidth: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e2e8f0"
  },
  stepIndicatorActive: {
    backgroundColor: "#0d9488"
  },
  stepIndicatorDone: {
    backgroundColor: "#14b8a6"
  },
  stepIndicatorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  stepIndicatorLabelActive: {
    color: "#ffffff"
  },
  formCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 16
  },
  stepTitle: {
    marginBottom: 4,
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a"
  },
  stepHint: {
    marginBottom: 12,
    fontSize: 13,
    color: "#475569"
  },
  sectionLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  secondSectionLabel: {
    marginTop: 12
  },
  imageSlotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8
  },
  imageSlot: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  imageCard: {
    width: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    padding: 6,
    gap: 6
  },
  imageCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6
  },
  imageCardTopRowRtl: {
    flexDirection: "row-reverse"
  },
  imageCardActions: {
    flexDirection: "row",
    gap: 6
  },
  imagePrimaryBadge: {
    borderRadius: 999,
    backgroundColor: "#dcfce7",
    color: "#166534",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  imageMiniAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  imageMiniActionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#334155"
  },
  imageMiniActionDanger: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  imageMiniActionLabelDanger: {
    fontSize: 10,
    fontWeight: "700",
    color: "#b91c1c"
  },
  imageSlotPreview: {
    width: "100%",
    height: 78,
    borderRadius: 10
  },
  imageSlotPlus: {
    fontSize: 22,
    color: "#94a3b8",
    lineHeight: 22
  },
  imageHint: {
    marginBottom: 12,
    fontSize: 12,
    color: "#64748b"
  },
  imageHintWarning: {
    color: "#b45309"
  },
  imageStatusLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569"
  },
  draftConflictCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
    padding: 10,
    gap: 8
  },
  draftConflictTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e"
  },
  videoUploadCard: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    padding: 10
  },
  videoUploadCardRtl: {
    flexDirection: "row-reverse"
  },
  videoUploadSlot: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  videoUploadIcon: {
    fontSize: 20,
    color: "#64748b"
  },
  videoUploadMeta: {
    flex: 1
  },
  videoUploadTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  videoUploadHint: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b"
  },
  videoUploadAction: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  videoUploadActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8"
  },
  videoUploadStatus: {
    marginTop: 4,
    fontSize: 12,
    color: "#334155"
  },
  aiAssistantCard: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    padding: 12
  },
  aiAssistantTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e3a8a"
  },
  aiAssistantHint: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: "#334155"
  },
  aiAssistantButton: {
    marginTop: 2,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    paddingVertical: 10
  },
  aiAssistantButtonDisabled: {
    opacity: 0.6
  },
  aiAssistantButtonLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff"
  },
  aiAssistantMessage: {
    fontSize: 12,
    color: "#1e293b"
  },
  carDetailsCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    padding: 12
  },
  carDetailsTitle: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "800",
    color: "#0f766e"
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  selectionHint: {
    marginBottom: 8,
    fontSize: 12,
    color: "#64748b"
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  fieldLabelRowRtl: {
    flexDirection: "row-reverse"
  },
  locationActionsRow: {
    marginTop: -6,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  locationActionsRowRtl: {
    flexDirection: "row-reverse"
  },
  locationHint: {
    flex: 1,
    fontSize: 12,
    color: "#64748b"
  },
  mapEditorButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  mapEditorButtonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8"
  },
  mapEditorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 16
  },
  mapEditorCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 14
  },
  mapEditorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  mapEditorHint: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: "#64748b"
  },
  mapPreviewCard: {
    marginBottom: 10,
    height: 170,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#e2e8f0"
  },
  mapPreviewImage: {
    width: "100%",
    height: "100%"
  },
  mapEditorActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  mapEditorActionsRtl: {
    flexDirection: "row-reverse"
  },
  input: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  optionsRow: {
    marginBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  yearDropdownTrigger: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  yearDropdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155"
  },
  yearDropdownList: {
    marginBottom: 12,
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff"
  },
  yearDropdownItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  yearDropdownItemSelected: {
    backgroundColor: "#f0fdfa"
  },
  yearDropdownItemLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  yearDropdownItemLabelSelected: {
    color: "#0f766e"
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  optionChipSelected: {
    borderColor: "#0d9488",
    backgroundColor: "#f0fdfa"
  },
  optionChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  optionChipLabelSelected: {
    color: "#0f766e"
  },
  advancedToggleButton: {
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center"
  },
  advancedToggleLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  categoryGrid: {
    gap: 10
  },
  categoryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    paddingVertical: 14,
    paddingHorizontal: 12
  },
  categoryCardSelected: {
    borderColor: "#0d9488",
    backgroundColor: "#f0fdfa"
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b"
  },
  categoryLabelSelected: {
    color: "#0f766e"
  },
  previewCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    padding: 12,
    gap: 8
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a"
  },
  previewItem: {
    fontSize: 13,
    color: "#334155"
  },
  previewMetaTitle: {
    marginTop: 4,
    fontWeight: "800",
    color: "#0f766e"
  },
  previewDescription: {
    marginTop: 4,
    fontSize: 13,
    color: "#334155",
    lineHeight: 20
  },
  agreementCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fbfd",
    padding: 12,
    gap: 8
  },
  verseCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 4
  },
  agreementBasmala: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155"
  },
  verseLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569"
  },
  verseText: {
    fontSize: 18,
    lineHeight: 34,
    color: "#0f172a",
    fontFamily: Platform.select({
      web: "'Amiri Quran','Amiri','Scheherazade New','Noto Naskh Arabic',serif",
      default: "serif"
    }),
    writingDirection: "rtl"
  },
  verseCitation: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569"
  },
  agreementItem: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18
  },
  agreementNoteTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "800",
    color: "#047857"
  },
  agreementNoteBody: {
    fontSize: 13,
    lineHeight: 20,
    color: "#047857"
  },
  checkboxRow: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ee",
    backgroundColor: "#ffffff",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  checkboxRowActive: {
    borderColor: "#0d9488",
    backgroundColor: "#f0fdfa"
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  checkboxBoxActive: {
    borderColor: "#0d9488",
    backgroundColor: "#0d9488"
  },
  checkboxCheck: {
    color: "#ffffff",
    fontWeight: "900"
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: "#334155"
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8
  },
  actionsRowRtl: {
    flexDirection: "row-reverse"
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    backgroundColor: "#ffffff"
  },
  secondaryButtonDisabled: {
    opacity: 0.5
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155"
  },
  submitButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#0d9488",
    paddingVertical: 14
  },
  submitButtonDisabled: {
    opacity: 0.7
  },
  submitLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff"
  },
  errorLabel: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: "#b91c1c"
  },
  infoLabel: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: "#0f766e"
  }
});
