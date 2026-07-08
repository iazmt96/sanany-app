export type ListingStatus = "available" | "reserved";

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

