export function resolveLocaleTag(language: string): "ar" | "en" {
  return language.startsWith("ar") ? "ar" : "en";
}

export function formatRelativeTime(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const isAr = resolveLocaleTag(language) === "ar";
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const absMinutes = Math.abs(diffMinutes);

  // Intl.RelativeTimeFormat is not reliably available in Hermes — use manual labels
  if (absMinutes < 1) {
    return isAr ? "الآن" : "just now";
  }
  if (absMinutes < 60) {
    return isAr ? `منذ ${absMinutes} دقيقة` : `${absMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);

  if (absHours < 24) {
    return isAr ? `منذ ${absHours} ساعة` : `${absHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return isAr ? `منذ ${Math.abs(diffDays)} يوم` : `${Math.abs(diffDays)}d ago`;
}

function safeDateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions, date: Date): string {
  // Guard for Hermes environments where Intl.DateTimeFormat may be unavailable
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat === "undefined") {
    return date.toLocaleDateString();
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function safeNumberFormat(locale: string, options: Intl.NumberFormatOptions, value: number): string {
  // Guard for Hermes environments where Intl.NumberFormat may be unavailable
  if (typeof Intl === "undefined" || typeof Intl.NumberFormat === "undefined") {
    return value.toString();
  }
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return value.toString();
  }
}

export function formatMonthYear(value: string, language: string, fallback = "-"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return safeDateTimeFormat(resolveLocaleTag(language), { month: "short", year: "numeric" }, date);
}

export function formatDayMonthYear(value: string, language: string, fallback = "-"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return safeDateTimeFormat(resolveLocaleTag(language), { day: "2-digit", month: "short", year: "numeric" }, date);
}

export function formatHourMinute(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return safeDateTimeFormat(resolveLocaleTag(language), { hour: "2-digit", minute: "2-digit" }, date);
}

export function formatWholeNumber(value: number, locale = "en-US"): string {
  return safeNumberFormat(locale, { maximumFractionDigits: 0 }, value);
}

export function formatCurrencySar(value: number, language: string): string {
  const locale = resolveLocaleTag(language) === "ar" ? "ar-SA" : "en-SA";
  return safeNumberFormat(locale, { style: "currency", currency: "SAR", minimumFractionDigits: 0, maximumFractionDigits: 2 }, value);
}

export function formatDateTimeFull(value: string, language: string, fallback = "-"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  const locale = resolveLocaleTag(language) === "ar" ? "ar-SA" : "en-SA";
  return safeDateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }, date);
}
