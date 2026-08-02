import type { SellerRating } from "@sanany/types";

export function canFollowSeller(viewerId: string | null | undefined, sellerId: string): boolean {
  return Boolean(viewerId) && viewerId !== sellerId;
}

export function canRateSeller(viewerId: string | null | undefined, sellerId: string): boolean {
  return Boolean(viewerId) && viewerId !== sellerId;
}

export function computeRatingDistribution(ratings: SellerRating[]): Array<{ stars: number; count: number; percent: number }> {
  const counts = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0]
  ]);
  for (const rating of ratings) {
    const clamped = Math.min(5, Math.max(1, Math.round(rating.rating)));
    counts.set(clamped, (counts.get(clamped) ?? 0) + 1);
  }
  const total = ratings.length;
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = counts.get(stars) ?? 0;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return { stars, count, percent };
  });
}
