import type { AppLanguage } from "@sanany/utils";

const FALLBACK_SITE_URL = "http://localhost:3000";

function safeUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

export function getSiteUrl(): string {
  return (
    safeUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    safeUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    safeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
    FALLBACK_SITE_URL
  );
}

export function absoluteUrl(pathname: string): string {
  const siteUrl = getSiteUrl();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteUrl}${normalizedPath}`;
}

export function localizedPath(language: AppLanguage, pathname = ""): string {
  if (!pathname || pathname === "/") {
    return `/${language}`;
  }
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/${language}${normalized}`;
}

export function buildAlternates(pathname = ""): { ar: string; en: string; "x-default": string } {
  return {
    ar: absoluteUrl(localizedPath("ar", pathname)),
    en: absoluteUrl(localizedPath("en", pathname)),
    "x-default": absoluteUrl(localizedPath("ar", pathname))
  };
}

export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
