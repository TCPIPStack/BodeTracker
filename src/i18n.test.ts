import { describe, expect, it } from "vitest";
import { AppError } from "./appError";
import { getPreferredLocale, t, translateAppError, translations } from "./i18n";

describe("i18n", () => {
  it("keeps English and German dictionaries in sync", () => {
    expect(Object.keys(translations.de).sort()).toEqual(Object.keys(translations.en).sort());
  });

  it("uses stored locale first and browser German otherwise", () => {
    expect(getPreferredLocale("de", ["en-US"])).toBe("de");
    expect(getPreferredLocale("en", ["de-DE"])).toBe("en");
    expect(getPreferredLocale(null, ["de-DE", "en-US"])).toBe("de");
    expect(getPreferredLocale(null, ["en-US"])).toBe("en");
  });

  it("translates strings and structured app errors", () => {
    expect(t("en", "file.load")).toBe("Load CSV");
    expect(t("de", "file.load")).toBe("CSV laden");
    expect(translateAppError("en", new AppError("csv.invalidPurchaseRow", { row: 2 }))).toBe(
      "Invalid purchase row in the CSV at record 2",
    );
    expect(translateAppError("de", new AppError("csv.invalidPurchaseRow", { row: 2 }))).toBe(
      "Ungültige Kaufzeile in der CSV bei Datensatz 2",
    );
    expect(translateAppError("en", new AppError("market.providerError", { provider: "Kraken", message: "EGeneral" }))).toBe(
      "Kraken returned an error: EGeneral",
    );
    expect(translateAppError("de", new AppError("market.providerError", { provider: "Kraken", message: "EGeneral" }))).toBe(
      "Kraken meldete einen Fehler: EGeneral",
    );
  });
});
