import type {
  CarAdType,
  CarCondition,
  CarFuelType,
  LegacyListingCategory,
  CarPriceMode,
  ListingCategory,
  ListingsFilters,
  ListingsQuery,
  MarketplaceListing,
  SearchCityKey
} from "@sanany/types";

const CAR_CATEGORY_SET = new Set<ListingCategory>(["carSale", "carPartsAndServices", "truckAndHeavy", "bikeSale", "carRent"]);

const LISTING_CATEGORY_SET = new Set<LegacyListingCategory>([
  "carSale",
  "carPartsAndServices",
  "truckAndHeavy",
  "bikeSale",
  "propertySale",
  "propertyRent",
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
  "saleOther",
  "carRent",
  "eventEquipmentRent",
  "constructionToolsRent",
  "chaletRent",
  "warehouseRent",
  "cameraGearRent",
  "rentOther",
  "serviceOffer",
  "cleaningService",
  "homeMaintenanceService",
  "electricalPlumbingService",
  "movingService",
  "designTechService",
  "photoVideoService",
  "deliveryService",
  "womenServices",
  "studentServices",
  "serviceOther",
  "requestGoods",
  "requestPurchase",
  "requestRent",
  "requestHomeService",
  "requestTechService",
  "requestUrgentMaintenance",
  "requestOther"
]);

const SEARCH_CITY_SET = new Set<SearchCityKey>(["riyadh", "jeddah", "dammam", "makkah", "madinah"]);
const CAR_CONDITION_SET = new Set<CarCondition>(["new", "likeNew", "used"]);
const CAR_FUEL_SET = new Set<CarFuelType>(["gasoline", "diesel", "hybrid", "electric"]);
const CAR_AD_TYPE_SET = new Set<CarAdType>(["sell", "transfer", "lease"]);
const CAR_PRICE_MODE_SET = new Set<CarPriceMode>(["fixed", "bid", "byWork"]);

export const CATEGORY_KEYWORDS: Record<LegacyListingCategory, string[]> = {
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

const CITY_ALIASES: Record<SearchCityKey, readonly string[]> = {
  riyadh: ["riyadh", "الرياض"],
  jeddah: ["jeddah", "جدة"],
  dammam: ["dammam", "الدمام"],
  makkah: ["makkah", "mecca", "مكة", "مكة المكرمة"],
  madinah: ["madinah", "medina", "المدينة", "المدينة المنورة"]
};

const CAR_AD_TYPE_TOKENS: Record<CarAdType, readonly string[]> = {
  sell: ["sell", "sale", "للبيع", "بيع"],
  transfer: ["transfer", "تنازل"],
  lease: ["lease", "إيجار", "ايجار", "rent"]
};

const CAR_CONDITION_TOKENS: Record<CarCondition, readonly string[]> = {
  new: ["new", "جديد"],
  likeNew: ["like new", "semi new", "شبه جديد", "نظيف"],
  used: ["used", "مستعمل"]
};

const CAR_FUEL_TOKENS: Record<CarFuelType, readonly string[]> = {
  gasoline: ["gasoline", "petrol", "بنزين"],
  diesel: ["diesel", "ديزل"],
  hybrid: ["hybrid", "هايبرد", "هجين"],
  electric: ["electric", "كهربائي"]
};

const CAR_PRICE_MODE_TOKENS: Record<CarPriceMode, readonly string[]> = {
  fixed: ["fixed", "ثابت"],
  bid: ["bid", "مزاد"],
  byWork: ["by work", "بالشغل", "بعمل"]
};

function sanitizeText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function sanitizeNumber(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sanitizePage(value: string | number | undefined): number {
  const parsed = sanitizeNumber(value);
  return parsed && Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function isCarCategory(category: ListingCategory | undefined): boolean {
  return Boolean(category && CAR_CATEGORY_SET.has(category));
}

export function normalizeListingsFilters(filters: ListingsFilters | undefined): ListingsFilters | undefined {
  if (!filters) {
    return undefined;
  }

  const category = sanitizeText(filters.category) as ListingCategory | undefined;
  const city = filters.city && SEARCH_CITY_SET.has(filters.city) ? filters.city : undefined;
  const minPrice = sanitizeNumber(filters.minPrice);
  const maxPrice = sanitizeNumber(filters.maxPrice);
  const brand = sanitizeText(filters.brand);
  const model = sanitizeText(filters.model);
  const year = sanitizeText(filters.year);
  const carCondition = filters.carCondition && CAR_CONDITION_SET.has(filters.carCondition) ? filters.carCondition : undefined;
  const carFuelType = filters.carFuelType && CAR_FUEL_SET.has(filters.carFuelType) ? filters.carFuelType : undefined;
  const carAdType = filters.carAdType && CAR_AD_TYPE_SET.has(filters.carAdType) ? filters.carAdType : undefined;
  const carPriceMode = filters.carPriceMode && CAR_PRICE_MODE_SET.has(filters.carPriceMode) ? filters.carPriceMode : undefined;
  const carOnly = isCarCategory(category);

  const normalized: ListingsFilters = {};
  if (category) normalized.category = category;
  if (city) normalized.city = city;
  if (typeof minPrice === "number" && minPrice >= 0) normalized.minPrice = minPrice;
  if (typeof maxPrice === "number" && maxPrice >= 0) normalized.maxPrice = maxPrice;
  if (typeof minPrice === "number" && typeof maxPrice === "number" && minPrice > maxPrice) {
    normalized.minPrice = maxPrice;
    normalized.maxPrice = minPrice;
  }
  if (brand) normalized.brand = brand;
  if (model) normalized.model = model;
  if (year) normalized.year = year;
  if (carOnly && carCondition) normalized.carCondition = carCondition;
  if (carOnly && carFuelType) normalized.carFuelType = carFuelType;
  if (carOnly && carAdType) normalized.carAdType = carAdType;
  if (carOnly && carPriceMode) normalized.carPriceMode = carPriceMode;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function countActiveListingsFilters(filters: ListingsFilters | undefined): number {
  const normalized = normalizeListingsFilters(filters);
  if (!normalized) {
    return 0;
  }
  return Object.keys(normalized).length;
}

export function buildListingsFilterSearchTerms(filters: ListingsFilters | undefined): string[] {
  const normalized = normalizeListingsFilters(filters);
  if (!normalized) {
    return [];
  }

  const terms = new Set<string>();
  if (normalized.category) {
    const keywords = LISTING_CATEGORY_SET.has(normalized.category as LegacyListingCategory)
      ? CATEGORY_KEYWORDS[normalized.category as LegacyListingCategory]
      : [];
    for (const keyword of keywords) {
      terms.add(keyword);
    }
  }
  if (normalized.city) {
    for (const alias of CITY_ALIASES[normalized.city]) {
      terms.add(alias);
    }
  }
  if (normalized.brand) terms.add(normalized.brand);
  if (normalized.model) terms.add(normalized.model);
  if (normalized.year) terms.add(normalized.year);
  if (normalized.carCondition) CAR_CONDITION_TOKENS[normalized.carCondition].forEach((term) => terms.add(term));
  if (normalized.carFuelType) CAR_FUEL_TOKENS[normalized.carFuelType].forEach((term) => terms.add(term));
  if (normalized.carAdType) CAR_AD_TYPE_TOKENS[normalized.carAdType].forEach((term) => terms.add(term));
  if (normalized.carPriceMode) CAR_PRICE_MODE_TOKENS[normalized.carPriceMode].forEach((term) => terms.add(term));
  return Array.from(terms);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(haystack: string, terms: readonly string[]): boolean {
  return terms.some((term) => haystack.includes(normalizeText(term)));
}

export function matchesListingsFilters(listing: MarketplaceListing, filters: ListingsFilters | undefined): boolean {
  const normalized = normalizeListingsFilters(filters);
  if (!normalized) {
    return true;
  }

  if (typeof normalized.minPrice === "number" && listing.price < normalized.minPrice) {
    return false;
  }
  if (typeof normalized.maxPrice === "number" && listing.price > normalized.maxPrice) {
    return false;
  }

  const haystack = normalizeText([listing.title, listing.description ?? "", listing.locationName ?? ""].join(" "));
  if (normalized.city && !includesAny(haystack, CITY_ALIASES[normalized.city])) {
    return false;
  }
  if (normalized.category) {
    const matchesStructuredCategory = listing.categorySlug === normalized.category;
    const keywords = LISTING_CATEGORY_SET.has(normalized.category as LegacyListingCategory)
      ? CATEGORY_KEYWORDS[normalized.category as LegacyListingCategory]
      : [];
    if (!matchesStructuredCategory && keywords.length > 0 && !includesAny(haystack, keywords)) {
      return false;
    }
  }
  if (normalized.brand && !haystack.includes(normalizeText(normalized.brand))) {
    return false;
  }
  if (normalized.model && !haystack.includes(normalizeText(normalized.model))) {
    return false;
  }
  if (normalized.year && !haystack.includes(normalizeText(normalized.year))) {
    return false;
  }
  if (normalized.carCondition && !includesAny(haystack, CAR_CONDITION_TOKENS[normalized.carCondition])) {
    return false;
  }
  if (normalized.carFuelType && !includesAny(haystack, CAR_FUEL_TOKENS[normalized.carFuelType])) {
    return false;
  }
  if (normalized.carAdType && !includesAny(haystack, CAR_AD_TYPE_TOKENS[normalized.carAdType])) {
    return false;
  }
  if (normalized.carPriceMode && !includesAny(haystack, CAR_PRICE_MODE_TOKENS[normalized.carPriceMode])) {
    return false;
  }
  return true;
}

export function parseListingsQueryFromParams(params: URLSearchParams, defaultPageSize: number): ListingsQuery {
  const query: ListingsQuery = {
    search: params.get("q")?.trim() ?? "",
    status:
      params.get("status") === "available" ||
      params.get("status") === "reserved" ||
      params.get("status") === "sold" ||
      params.get("status") === "draft"
        ? (params.get("status") as ListingsQuery["status"])
        : "all",
    sort: params.get("sort") === "priceHigh" || params.get("sort") === "priceLow" ? (params.get("sort") as ListingsQuery["sort"]) : "newest",
    page: sanitizePage(params.get("page") ?? undefined),
    pageSize: defaultPageSize
  };

  const filters = normalizeListingsFilters({
    category: params.get("category") as ListingCategory | undefined,
    city: params.get("city") as SearchCityKey | undefined,
    minPrice: sanitizeNumber(params.get("minPrice") ?? undefined),
    maxPrice: sanitizeNumber(params.get("maxPrice") ?? undefined),
    brand: params.get("brand") ?? undefined,
    model: params.get("model") ?? undefined,
    year: params.get("year") ?? undefined,
    carCondition: params.get("carCondition") as CarCondition | undefined,
    carFuelType: params.get("carFuelType") as CarFuelType | undefined,
    carAdType: params.get("carAdType") as CarAdType | undefined,
    carPriceMode: params.get("carPriceMode") as CarPriceMode | undefined
  });
  if (filters) {
    query.filters = filters;
  }
  return query;
}

export function toListingsQueryParams(query: ListingsQuery): URLSearchParams {
  const params = new URLSearchParams();
  const normalizedFilters = normalizeListingsFilters(query.filters);
  if (query.search.trim().length > 0) params.set("q", query.search.trim());
  if (query.status !== "all") params.set("status", query.status);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (normalizedFilters?.category) params.set("category", normalizedFilters.category);
  if (normalizedFilters?.city) params.set("city", normalizedFilters.city);
  if (typeof normalizedFilters?.minPrice === "number") params.set("minPrice", String(Math.max(0, Math.floor(normalizedFilters.minPrice))));
  if (typeof normalizedFilters?.maxPrice === "number") params.set("maxPrice", String(Math.max(0, Math.floor(normalizedFilters.maxPrice))));
  if (normalizedFilters?.brand) params.set("brand", normalizedFilters.brand);
  if (normalizedFilters?.model) params.set("model", normalizedFilters.model);
  if (normalizedFilters?.year) params.set("year", normalizedFilters.year);
  if (normalizedFilters?.carCondition) params.set("carCondition", normalizedFilters.carCondition);
  if (normalizedFilters?.carFuelType) params.set("carFuelType", normalizedFilters.carFuelType);
  if (normalizedFilters?.carAdType) params.set("carAdType", normalizedFilters.carAdType);
  if (normalizedFilters?.carPriceMode) params.set("carPriceMode", normalizedFilters.carPriceMode);
  return params;
}
