import { describe, expect, it } from "vitest";
import { createFormatters } from "./format";

describe("createFormatters", () => {
  it("formats numbers and dates for English", () => {
    const formatters = createFormatters("en");

    expect(formatters.formatEur(1234.5, 2)).toBe("€1,234.50");
    expect(formatters.formatBtc(0.123456789)).toBe("0.12345679");
    expect(formatters.formatPercent(12.345)).toBe("12.35");
    expect(formatters.formatDate(Date.parse("2024-02-03T10:00:00.000"))).toBe("02/03/2024");
    expect(formatters.formatCompactEuroAxis(1_250_000)).toBe("1.3 M €");
  });

  it("formats numbers and dates for German", () => {
    const formatters = createFormatters("de");

    expect(formatters.formatEur(1234.5, 2)).toBe("1.234,50\u00a0€");
    expect(formatters.formatBtc(0.123456789)).toBe("0,12345679");
    expect(formatters.formatPercent(12.345)).toBe("12,35");
    expect(formatters.formatDate(Date.parse("2024-02-03T10:00:00.000"))).toBe("03.02.2024");
    expect(formatters.formatCompactEuroAxis(1_250_000)).toBe("1,3 Mio. €");
  });
});
