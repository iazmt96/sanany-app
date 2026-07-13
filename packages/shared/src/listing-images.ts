export function parseListingImageUrls(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  const value = raw.trim();
  if (value.length === 0) {
    return [];
  }

  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
      }
    } catch {
      // fallback to other parsers
    }
  }

  if (value.includes("|")) {
    return value
      .split("|")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (value.startsWith("data:")) {
    return [value];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function isRenderableListingImageUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const candidate = value.trim().toLowerCase();
  if (candidate.length === 0) {
    return false;
  }

  return (
    candidate.startsWith("data:image/") ||
    candidate.startsWith("https://") ||
    candidate.startsWith("http://") ||
    candidate.startsWith("file://") ||
    candidate.startsWith("content://")
  );
}

export function getRenderableListingImageUrls(raw: string | null | undefined): string[] {
  return parseListingImageUrls(raw).filter((item) => isRenderableListingImageUrl(item));
}

export function getPrimaryListingImageUrl(raw: string | null | undefined): string | null {
  const [firstImage] = getRenderableListingImageUrls(raw);
  return firstImage ?? null;
}

export function serializeListingImageUrls(urls: string[]): string | null {
  const clean = urls.map((item) => item.trim()).filter((item) => item.length > 0);
  if (clean.length === 0) {
    return null;
  }

  return clean.join("|");
}
