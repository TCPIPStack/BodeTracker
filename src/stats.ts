import type { PricePoint, Purchase, Stats } from "./types";

export function calculateStats(
  purchases: Purchase[],
  prices: PricePoint[],
  visibleRange: [number, number] | null,
): Stats {
  const [rangeStart, rangeEnd] = visibleRange ?? [
    prices[0]?.timestamp ?? purchases[0]?.timestamp ?? 0,
    prices.at(-1)?.timestamp ?? purchases.at(-1)?.timestamp ?? 0,
  ];
  const visiblePurchases = purchases.filter(
    (purchase) => purchase.timestamp >= rangeStart && purchase.timestamp <= rangeEnd,
  );
  const cumulativePurchases = purchases.filter((purchase) => purchase.timestamp <= rangeEnd);
  const priceAtRangeEnd =
    prices.filter((price) => price.timestamp <= rangeEnd).at(-1)?.price ?? prices.at(-1)?.price ?? 0;
  const totalBtc = visiblePurchases.reduce((sum, purchase) => sum + purchase.btc, 0);
  const invested = visiblePurchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
  const fees = visiblePurchases.reduce((sum, purchase) => sum + purchase.fee, 0);
  const cumulativeTotalBtc = cumulativePurchases.reduce((sum, purchase) => sum + purchase.btc, 0);
  const cumulativeInvested = cumulativePurchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
  const cumulativeFees = cumulativePurchases.reduce((sum, purchase) => sum + purchase.fee, 0);
  const bookValue = totalBtc * priceAtRangeEnd;
  const pnl = bookValue - invested;

  return {
    purchaseCount: visiblePurchases.length,
    totalBtc,
    invested,
    fees,
    averageCost: totalBtc > 0 ? invested / totalBtc : 0,
    bookValue,
    pnl,
    pnlPercent: invested > 0 ? (pnl / invested) * 100 : 0,
    latestPrice: priceAtRangeEnd,
    cumulativeTotalBtc,
    cumulativeInvested,
    cumulativeFees,
    cumulativeAverageCost: cumulativeTotalBtc > 0 ? cumulativeInvested / cumulativeTotalBtc : 0,
  };
}
