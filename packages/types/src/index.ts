export type ListingStatus = "available" | "reserved";
export type ListingFilterStatus = ListingStatus | "all";

export type MarketplaceListing = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  status: ListingStatus;
  imageUrl: string | null;
  createdAt: string;
};

export type CreateListingInput = {
  title: string;
  description: string;
  price: number;
  ownerId: string;
  status?: ListingStatus;
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
