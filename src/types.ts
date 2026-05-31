export type CsvRow = Record<string, string>;

export interface Purchase {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  btc: number;
  eur: number;
  fee: number;
  totalCost: number;
  quotePrice: number;
  transactionId: string;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface Stats {
  purchaseCount: number;
  totalBtc: number;
  invested: number;
  fees: number;
  averageCost: number;
  bookValue: number;
  pnl: number;
  pnlPercent: number;
  latestPrice: number;
  cumulativeTotalBtc: number;
  cumulativeInvested: number;
  cumulativeFees: number;
  cumulativeAverageCost: number;
}
