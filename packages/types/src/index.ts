export type ListingStatus = "available" | "reserved";
export type ListingFilterStatus = ListingStatus | "all";

export type MarketplaceListing = {
  id: string;
  titleKey: string;
  summaryKey: string;
  locationKey: string;
  status: ListingStatus;
  dailyPrice: number;
};

export type AuthPayload = {
  email: string;
  password: string;
};

export type ListingsQuery = {
  search: string;
  status: ListingFilterStatus;
  page: number;
  pageSize: number;
};

export type PaginatedResult<TItem> = {
  items: TItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
