import { describe, expect, it } from "vitest";
import { calculateStats } from "./stats";
import type { PricePoint, Purchase } from "./types";

const purchase = (overrides: Partial<Purchase>): Purchase => ({
  id: "purchase",
  date: "2024-01-01",
  time: "10:00:00.000",
  timestamp: Date.parse("2024-01-01T10:00:00.000"),
  btc: 0.1,
  eur: 1000,
  fee: 5,
  totalCost: 1005,
  quotePrice: 10000,
  transactionId: "purchase",
  ...overrides,
});

const price = (date: string, priceValue: number): PricePoint => ({
  timestamp: Date.parse(date),
  price: priceValue,
});

describe("calculateStats", () => {
  it("calculates totals for the full available range", () => {
    const purchases = [
      purchase({ id: "first", timestamp: Date.parse("2024-01-01T10:00:00.000"), btc: 0.1, totalCost: 1005, fee: 5 }),
      purchase({ id: "second", timestamp: Date.parse("2024-01-03T10:00:00.000"), btc: 0.2, totalCost: 2010, fee: 10 }),
    ];
    const prices = [price("2024-01-01T00:00:00.000", 10000), price("2024-01-04T00:00:00.000", 12000)];

    const stats = calculateStats(purchases, prices, null);

    expect(stats.purchaseCount).toBe(2);
    expect(stats.totalBtc).toBeCloseTo(0.3);
    expect(stats.invested).toBe(3015);
    expect(stats.fees).toBe(15);
    expect(stats.averageCost).toBeCloseTo(10050);
    expect(stats.bookValue).toBeCloseTo(3600);
    expect(stats.pnl).toBeCloseTo(585);
    expect(stats.pnlPercent).toBeCloseTo((585 / 3015) * 100);
    expect(stats.latestPrice).toBe(12000);
    expect(stats.cumulativeTotalBtc).toBeCloseTo(0.3);
    expect(stats.cumulativeInvested).toBe(3015);
    expect(stats.cumulativeFees).toBe(15);
    expect(stats.cumulativeAverageCost).toBeCloseTo(10050);
  });

  it("uses the visible range for visible stats and range-end cumulative stats", () => {
    const purchases = [
      purchase({ id: "before", timestamp: Date.parse("2024-01-01T10:00:00.000"), btc: 0.1, totalCost: 1000, fee: 2 }),
      purchase({ id: "visible", timestamp: Date.parse("2024-01-05T10:00:00.000"), btc: 0.2, totalCost: 2200, fee: 4 }),
      purchase({ id: "after", timestamp: Date.parse("2024-01-10T10:00:00.000"), btc: 0.3, totalCost: 3600, fee: 6 }),
    ];
    const prices = [
      price("2024-01-01T00:00:00.000", 10000),
      price("2024-01-06T00:00:00.000", 11000),
      price("2024-01-11T00:00:00.000", 13000),
    ];
    const visibleRange: [number, number] = [Date.parse("2024-01-04T00:00:00.000"), Date.parse("2024-01-07T00:00:00.000")];

    const stats = calculateStats(purchases, prices, visibleRange);

    expect(stats.purchaseCount).toBe(1);
    expect(stats.totalBtc).toBeCloseTo(0.2);
    expect(stats.invested).toBe(2200);
    expect(stats.fees).toBe(4);
    expect(stats.averageCost).toBe(11000);
    expect(stats.latestPrice).toBe(11000);
    expect(stats.bookValue).toBe(2200);
    expect(stats.pnl).toBe(0);
    expect(stats.cumulativeTotalBtc).toBeCloseTo(0.3);
    expect(stats.cumulativeInvested).toBe(3200);
    expect(stats.cumulativeFees).toBe(6);
    expect(stats.cumulativeAverageCost).toBeCloseTo(3200 / 0.3);
  });

  it("uses the last known price before the range end", () => {
    const purchases = [purchase({ timestamp: Date.parse("2024-01-02T10:00:00.000"), btc: 0.5, totalCost: 5000 })];
    const prices = [
      price("2024-01-01T00:00:00.000", 9000),
      price("2024-01-03T00:00:00.000", 10000),
      price("2024-01-05T00:00:00.000", 11000),
    ];

    const stats = calculateStats(purchases, prices, [
      Date.parse("2024-01-02T00:00:00.000"),
      Date.parse("2024-01-04T00:00:00.000"),
    ]);

    expect(stats.latestPrice).toBe(10000);
    expect(stats.bookValue).toBe(5000);
  });

  it("returns zero values when there are no purchases or prices", () => {
    const stats = calculateStats([], [], null);

    expect(stats).toEqual({
      purchaseCount: 0,
      totalBtc: 0,
      invested: 0,
      fees: 0,
      averageCost: 0,
      bookValue: 0,
      pnl: 0,
      pnlPercent: 0,
      latestPrice: 0,
      cumulativeTotalBtc: 0,
      cumulativeInvested: 0,
      cumulativeFees: 0,
      cumulativeAverageCost: 0,
    });
  });

  it("handles ranges without visible purchases but with cumulative holdings", () => {
    const purchases = [purchase({ timestamp: Date.parse("2024-01-01T10:00:00.000"), btc: 0.25, totalCost: 2500, fee: 5 })];
    const prices = [price("2024-01-01T00:00:00.000", 9000), price("2024-01-10T00:00:00.000", 12000)];

    const stats = calculateStats(purchases, prices, [
      Date.parse("2024-01-05T00:00:00.000"),
      Date.parse("2024-01-10T00:00:00.000"),
    ]);

    expect(stats.purchaseCount).toBe(0);
    expect(stats.totalBtc).toBe(0);
    expect(stats.invested).toBe(0);
    expect(stats.bookValue).toBe(0);
    expect(stats.pnl).toBe(0);
    expect(stats.cumulativeTotalBtc).toBe(0.25);
    expect(stats.cumulativeInvested).toBe(2500);
    expect(stats.cumulativeFees).toBe(5);
    expect(stats.cumulativeAverageCost).toBe(10000);
  });
});
