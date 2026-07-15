export function resolveLocaleTag(language: string): "ar" | "en" {
  return language.startsWith("ar") ? "ar" : "en";
}

export function formatRelativeTime(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const absMinutes = Math.abs(diffMinutes);
  const formatter = new Intl.RelativeTimeFormat(resolveLocaleTag(language), { numeric: "auto" });

  if (absMinutes < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

export function formatMonthYear(value: string, language: string, fallback = "-"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(resolveLocaleTag(language), { month: "short", year: "numeric" }).format(date);
}

export function formatDayMonthYear(value: string, language: string, fallback = "-"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(resolveLocaleTag(language), {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatHourMinute(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(resolveLocaleTag(language), { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatWholeNumber(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatCurrencySar(value: number, language: string): string {
  return new Intl.NumberFormat(resolveLocaleTag(language) === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDateTimeFull(value: string, language: string, fallback = "-"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(resolveLocaleTag(language) === "ar" ? "ar-SA" : "en-SA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
