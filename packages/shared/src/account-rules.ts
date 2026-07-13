export function readMetadataText(metadata: unknown, keys: string[]): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function readMetadataPhone(metadata: unknown): string | null {
  return readMetadataText(metadata, ["phone", "phone_number", "mobile"]);
}
