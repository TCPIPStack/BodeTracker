import type { Locale } from "./i18n";

const LOCALE_FORMATS: Record<Locale, string> = {
  en: "en-US",
  de: "de-DE",
};

export const createFormatters = (locale: Locale) => {
  const intlLocale = LOCALE_FORMATS[locale];

  const formatNumber = (value: number, maximumFractionDigits = 0) =>
    new Intl.NumberFormat(intlLocale, {
      maximumFractionDigits,
    }).format(value);

  return {
    formatEur: (value: number, maximumFractionDigits = 0) =>
      new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits,
      }).format(value),

    formatBtc: (value: number) =>
      new Intl.NumberFormat(intlLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      }).format(value),

    formatPercent: (value: number) =>
      new Intl.NumberFormat(intlLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value),

    formatDate: (timestamp: number) =>
      new Intl.DateTimeFormat(intlLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(timestamp),

    formatRangeDate: (timestamp: number) =>
      new Intl.DateTimeFormat(intlLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(timestamp),

    formatEuroAxis: (value: number) => `${formatNumber(value)} €`,

    formatCompactEuroAxis: (value: number) => {
      if (value >= 1_000_000) {
        const suffix = locale === "de" ? "Mio. €" : "M €";
        return `${formatNumber(value / 1_000_000, 1)} ${suffix}`;
      }

      return `${formatNumber(value / 1_000)}k €`;
    },
  };
};
