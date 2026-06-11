import type { AppError } from "./appError";

export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_STORAGE_KEY = "bodetracker-locale";

export const translations = {
  en: {
    "app.title": "Bitcoin Purchase Chart",
    "language.label": "Language",
    "language.en": "EN",
    "language.de": "DE",
    "theme.label": "Design Theme",
    "privacy.show": "Show sensitive values",
    "privacy.hide": "Hide sensitive values",
    "range.label": "Time Range:",
    "range.empty": "Load CSV",
    "file.loading": "Loading...",
    "file.load": "Load CSV",
    "source.sample": "Synthetic sample data",
    "source.none": "No CSV loaded yet",
    "metric.bookValue": "Bitcoin Book Value",
    "metric.invested": "Invested:",
    "metric.averageCost": "Avg. purchase price:",
    "metric.purchaseEvents": "Purchase Events",
    "metric.selectedRange": "in selected range",
    "metric.totalBtc": "Total BTC",
    "metric.fees": "Fees:",
    "empty.errorTitle": "CSV or price data could not be loaded",
    "empty.initialTitle": "Load a CSV to start the chart",
    "empty.initialBody": "Select your transaction history. The file stays only in memory for this browser session.",
    "chart.bitcoinPrice": "Bitcoin Price",
    "chart.averageCost": "Avg. Purchase Price",
    "chart.purchase": "Purchase",
    "chart.investedCapital": "Invested Capital",
    "chart.euroValue": "Euro Value",
    "chart.priceAxis": "Bitcoin Price (€)",
    "chart.portfolioAxis": "Portfolio (€)",
    "tooltip.btcPurchase": "BTC Purchase",
    "tooltip.purchaseAmount": "Purchase amount",
    "tooltip.fee": "Fee",
    "tooltip.totalCost": "Total cost",
    "tooltip.purchasePrice": "Purchase price",
    "tooltip.profitLoss": "Profit/Loss",
    "error.csv.parseFailed": "The CSV could not be parsed: {message}",
    "error.csv.missingColumns": "Missing CSV columns: {columns}",
    "error.csv.invalidPurchaseRow": "Invalid purchase row in the CSV at record {row}",
    "error.csv.noPurchases": "No completed BTC purchases were found in this CSV.",
    "error.csv.loadFailed": "The CSV could not be loaded.",
    "error.market.httpFailed": "{provider} could not be loaded ({status}).",
    "error.market.noPrices": "{provider} returned no price data for this period.",
    "error.market.providerError": "{provider} returned an error: {message}",
  },
  de: {
    "app.title": "Bitcoin Kauf-Chart",
    "language.label": "Sprache",
    "language.en": "EN",
    "language.de": "DE",
    "theme.label": "Design Theme",
    "privacy.show": "Sensible Werte anzeigen",
    "privacy.hide": "Sensible Werte zensieren",
    "range.label": "Zeitraum:",
    "range.empty": "CSV laden",
    "file.loading": "Lade...",
    "file.load": "CSV laden",
    "source.sample": "Synthetische Beispieldaten",
    "source.none": "Noch keine CSV geladen",
    "metric.bookValue": "Bitcoin Buchwert",
    "metric.invested": "Investiert:",
    "metric.averageCost": "Ø Kaufpreis:",
    "metric.purchaseEvents": "Kaufereignisse",
    "metric.selectedRange": "im ausgewählten Zeitraum",
    "metric.totalBtc": "Gesamt-BTC",
    "metric.fees": "Gebühren:",
    "empty.errorTitle": "CSV oder Kursdaten konnten nicht geladen werden",
    "empty.initialTitle": "CSV laden, um den Chart zu starten",
    "empty.initialBody": "Wähle deine Transaktionshistorie aus. Die Datei bleibt nur in dieser Browser-Sitzung im Speicher.",
    "chart.bitcoinPrice": "Bitcoin Preis",
    "chart.averageCost": "Ø Kaufpreis",
    "chart.purchase": "Kauf",
    "chart.investedCapital": "Investiertes Kapital",
    "chart.euroValue": "Euro-Wert",
    "chart.priceAxis": "Bitcoin Preis (€)",
    "chart.portfolioAxis": "Portfolio (€)",
    "tooltip.btcPurchase": "BTC-Kauf",
    "tooltip.purchaseAmount": "Kaufbetrag",
    "tooltip.fee": "Gebühr",
    "tooltip.totalCost": "Gesamtkosten",
    "tooltip.purchasePrice": "Kaufpreis",
    "tooltip.profitLoss": "Profit/Verlust",
    "error.csv.parseFailed": "Die CSV konnte nicht gelesen werden: {message}",
    "error.csv.missingColumns": "Fehlende CSV-Spalten: {columns}",
    "error.csv.invalidPurchaseRow": "Ungültige Kaufzeile in der CSV bei Datensatz {row}",
    "error.csv.noPurchases": "Keine abgeschlossenen BTC-Käufe in dieser CSV gefunden.",
    "error.csv.loadFailed": "Die CSV konnte nicht geladen werden.",
    "error.market.httpFailed": "{provider} konnte nicht geladen werden ({status}).",
    "error.market.noPrices": "{provider} lieferte keine Kursdaten für diesen Zeitraum.",
    "error.market.providerError": "{provider} meldete einen Fehler: {message}",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

type TranslationParams = Record<string, string | number>;

export const isLocale = (value: string | null | undefined): value is Locale =>
  LOCALES.includes(value as Locale);

export const getPreferredLocale = (storedLocale?: string | null, browserLanguages: readonly string[] = []): Locale => {
  if (isLocale(storedLocale)) {
    return storedLocale;
  }

  return browserLanguages.some((language) => language.toLowerCase().startsWith("de")) ? "de" : "en";
};

export const getInitialLocale = (): Locale => {
  if (typeof window === "undefined") {
    return "en";
  }

  let storedLocale: string | null = null;

  try {
    storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    storedLocale = null;
  }

  const browserLanguages =
    window.navigator.languages.length > 0 ? window.navigator.languages : [window.navigator.language];

  return getPreferredLocale(storedLocale, browserLanguages);
};

export function t(locale: Locale, key: TranslationKey, params: TranslationParams = {}) {
  return translations[locale][key].replace(/\{(\w+)\}/g, (match, paramKey) => String(params[paramKey] ?? match));
}

export const translateAppError = (locale: Locale, error: AppError) =>
  t(locale, `error.${error.code}` as TranslationKey, error.params);
