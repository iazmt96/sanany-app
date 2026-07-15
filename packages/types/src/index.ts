export const ACCOUNT_TYPES = ["individual", "company"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const LISTING_STATUSES = ["draft", "available", "reserved", "sold", "inactive"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type ListingFilterStatus = ListingStatus | "all";

export const LISTING_SALE_PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled", "refunded"] as const;
export type ListingSalePaymentStatus = (typeof LISTING_SALE_PAYMENT_STATUSES)[number];

export const LISTING_OFFER_TYPES = ["sell", "rent", "service", "request"] as const;
export type ListingOfferType = (typeof LISTING_OFFER_TYPES)[number];

export const LISTING_CATEGORIES = [
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
] as const;
export type LegacyListingCategory = (typeof LISTING_CATEGORIES)[number];
export type ListingCategory = string;

export const LISTING_CATEGORY_EXPERIENCE_KEYS = ["general", "vehicles", "real_estate", "electronics", "livestock", "jobs", "services"] as const;
export type ListingCategoryExperienceKey = (typeof LISTING_CATEGORY_EXPERIENCE_KEYS)[number];

export const LISTING_CATEGORY_FIELD_TYPES = ["text", "textarea", "number", "select", "multiselect", "boolean"] as const;
export type ListingCategoryFieldType = (typeof LISTING_CATEGORY_FIELD_TYPES)[number];

export type MarketplaceCategoryFieldOption = {
  value: string;
  labelAr: string;
  labelEn: string;
};

export type MarketplaceCategoryField = {
  id: string;
  categoryId: string;
  fieldKey: string;
  fieldType: ListingCategoryFieldType;
  labelAr: string;
  labelEn: string;
  placeholderAr: string | null;
  placeholderEn: string | null;
  helperTextAr: string | null;
  helperTextEn: string | null;
  isRequired: boolean;
  sortOrder: number;
  filterable: boolean;
  detailVisible: boolean;
  options: MarketplaceCategoryFieldOption[];
};

export type MarketplaceCategory = {
  id: string;
  parentId: string | null;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  iconName: string | null;
  sortOrder: number;
  isActive: boolean;
  offerType: ListingOfferType | null;
  experienceKey: ListingCategoryExperienceKey;
};

export type MarketplaceCategoryNode = MarketplaceCategory & {
  fields: MarketplaceCategoryField[];
  children: MarketplaceCategoryNode[];
};

export const SEARCH_CITY_KEYS = ["riyadh", "jeddah", "dammam", "makkah", "madinah"] as const;
export type SearchCityKey = (typeof SEARCH_CITY_KEYS)[number];

export const CAR_AD_TYPES = ["sell", "transfer", "lease"] as const;
export type CarAdType = (typeof CAR_AD_TYPES)[number];

export const CAR_CONDITIONS = ["new", "likeNew", "used"] as const;
export type CarCondition = (typeof CAR_CONDITIONS)[number];

export const CAR_FUEL_TYPES = ["gasoline", "diesel", "hybrid", "electric"] as const;
export type CarFuelType = (typeof CAR_FUEL_TYPES)[number];

export const CAR_PRICE_MODES = ["fixed", "bid", "byWork"] as const;
export type CarPriceMode = (typeof CAR_PRICE_MODES)[number];

export type ListingsFilters = {
  category?: ListingCategory;
  city?: SearchCityKey;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  model?: string;
  year?: string;
  carCondition?: CarCondition;
  carFuelType?: CarFuelType;
  carAdType?: CarAdType;
  carPriceMode?: CarPriceMode;
};

export const IMAGE_STATUSES = ["pending", "compressing", "uploading", "uploaded", "failed"] as const;
export type ImageStatus = (typeof IMAGE_STATUSES)[number];

export const DRAFT_STATUSES = ["draft", "syncPending", "published"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ACCOUNT_VERIFICATION_STATUSES = ["unverified", "pending", "additional_info_required", "verified", "rejected"] as const;
export type AccountVerificationStatus = (typeof ACCOUNT_VERIFICATION_STATUSES)[number];

export const PROFILE_GENDERS = ["male", "female", "prefer_not_to_say"] as const;
export type ProfileGender = (typeof PROFILE_GENDERS)[number];

export const CONTACT_METHODS = ["phone", "chat", "whatsapp", "email"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export type MarketplaceListing = {
  id: string;
  ownerId: string | null;
  ownerPhone: string | null;
  offerType?: ListingOfferType | null;
  categorySlug?: ListingCategory | null;
  title: string;
  description: string | null;
  price: number;
  status: ListingStatus;
  imageUrl: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt?: string;
};

export type MarketplaceCommissionSettings = {
  commissionRatePercent: number;
  updatedAt: string;
};

export type ListingSalePayment = {
  id: string;
  listingId: string;
  sellerId: string;
  finalSaleAmount: number;
  commissionRatePercent: number;
  commissionAmount: number;
  paymentStatus: ListingSalePaymentStatus;
  paymentMethod: string | null;
  paymentDate: string | null;
  invoiceNumber: string | null;
  transactionReference: string | null;
  failureReason: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListingSaleInvoice = {
  payment: ListingSalePayment;
  listingId: string;
  listingTitle: string;
  listingImageUrl: string | null;
  sellerDisplayName: string;
  sellerUsername: string | null;
};

export type CreateListingInput = {
  title: string;
  description: string;
  price: number;
  ownerId: string;
  ownerPhone?: string;
  offerType?: ListingOfferType | null;
  categorySlug?: ListingCategory | null;
  status?: ListingStatus;
  imageUrl?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  images?: CreateListingImageInput[];
};

export type CreateListingImageInput = {
  storagePath: string;
  sortOrder: number;
  isPrimary: boolean;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
};

export type AuthAccountType = AccountType;

export type AuthSignUpMetadata = {
  displayName?: string;
  phone?: string;
  city?: string;
  companyName?: string;
  representativeName?: string;
  businessType?: string;
  customBusinessType?: string;
  commercialRegistration?: string;
  taxNumber?: string;
  website?: string;
  companyDescription?: string;
};

export type AuthPayload = {
  email: string;
  password: string;
  accountType?: AccountType;
  metadata?: AuthSignUpMetadata;
};

export const PHONE_OTP_CHANNELS = ["sms", "whatsapp"] as const;
export type PhoneOtpChannel = (typeof PHONE_OTP_CHANNELS)[number];

export type PhoneOtpRequestPayload = {
  phone: string;
  channel?: PhoneOtpChannel;
  fallbackChannel?: PhoneOtpChannel;
};

export type PhoneOtpVerifyPayload = {
  phone: string;
  token: string;
};

export type BasicAccountProfileInput = {
  displayName: string;
  username: string;
};

export type UsernameAvailability = {
  normalizedUsername: string;
  isAvailable: boolean;
  suggestions: string[];
  reason: "empty" | "invalid" | "taken" | "available";
};

export type AccountProfile = {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: ProfileGender | null;
  preferredContactMethod: ContactMethod | null;
  accountType: AccountType;
  isVerified: boolean;
};

export type UpdateAccountProfileInput = {
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  city?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  gender?: ProfileGender | null;
  preferredContactMethod?: ContactMethod | null;
};

export type AccountVerificationRequest = {
  id: string;
  userId: string;
  status: AccountVerificationStatus;
  legalFullName: string | null;
  nationalId: string | null;
  birthDate: string | null;
  city: string | null;
  email: string | null;
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  selfieUrl: string | null;
  businessName: string | null;
  businessRegistration: string | null;
  additionalDocuments: string[];
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertAccountVerificationInput = {
  legalFullName: string;
  nationalId: string;
  birthDate: string;
  city: string;
  email: string;
  documentFrontUrl?: string | null;
  documentBackUrl?: string | null;
  selfieUrl?: string | null;
  businessName?: string | null;
  businessRegistration?: string | null;
  additionalDocuments?: string[];
  submit: boolean;
};

export type ListingsQuery = {
  search: string;
  status: ListingFilterStatus;
  sort: "newest" | "priceHigh" | "priceLow";
  page: number;
  pageSize: number;
  filters?: ListingsFilters;
};

export type PaginatedResult<TItem> = {
  items: TItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SellerAccountType = "individual" | "company" | "dealer" | "business" | "store";

export type SellerProfile = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  accountType: SellerAccountType;
  isVerified: boolean;
  ratingAverage: number;
  ratingCount: number;
  listingsCount: number;
  soldListingsCount: number;
  followersCount: number;
  followingCount: number;
  joinedAt: string;
  lastSeenAt: string | null;
  isFollowing: boolean;
  isOwner: boolean;
  canShowLastSeen: boolean;
  canShowPhone: boolean;
  phone: string | null;
  companyBusinessType: string | null;
  companyVerificationStatus: VerificationStatus | null;
};

export type SellerRating = {
  id: string;
  sellerId: string;
  raterId: string;
  listingId: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  raterName: string | null;
  raterAvatarUrl: string | null;
};

export type SellerConnection = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  accountType: SellerAccountType;
  isVerified: boolean;
};

export type CreateSellerRatingInput = {
  sellerId: string;
  raterId: string;
  rating: number;
  comment?: string;
  listingId?: string | null;
};

export type SellerProfileListingsTab = "all" | "available" | "sold";
export type SellerProfileListingsSort = "newest" | "oldest" | "priceLow" | "priceHigh";
export type SellerProfileRatingsSort = "newest" | "highest" | "lowest";

export const NOTIFICATION_KINDS = ["message", "follow", "rating", "listing_status", "admin_announcement"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type ConversationSummary = {
  id: string;
  listing: MarketplaceListing;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarUrl: string | null;
  otherUserVerified: boolean;
  otherUserAccountType: SellerAccountType;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  isBlocked: boolean;
  isBlockedByOther: boolean;
  isReported: boolean;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  referenceId: string;
  title: string | null;
  body: string | null;
  createdAt: string;
  isRead: boolean;
  listingId?: string | null;
  conversationId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  ratingValue?: number | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  listingTitle?: string | null;
  messagePreview?: string | null;
  audience?: string | null;
};

export type SendConversationMessageInput = {
  conversationId: string;
  senderId: string;
  body?: string;
  imageUrl?: string;
};
