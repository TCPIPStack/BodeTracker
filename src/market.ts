import { createAppError } from "./appError";
import type { PricePoint } from "./types";

interface CoinGeckoRangeResponse {
  prices: [number, number][];
}

interface KrakenOhlcResponse {
  error: string[];
  result: Record<string, Array<[number, string, string, string, string, string, string, number]> | number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchBitcoinPrices(fromMs: number, toMs: number): Promise<PricePoint[]> {
  try {
    return await fetchCoinGeckoPrices(fromMs, toMs);
  } catch {
    return fetchKrakenPrices(fromMs, toMs);
  }
}

async function fetchCoinGeckoPrices(fromMs: number, toMs: number): Promise<PricePoint[]> {
  const from = Math.floor((fromMs - 14 * DAY_MS) / 1000);
  const to = Math.floor((toMs + DAY_MS) / 1000);
  const url = new URL("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range");

  url.searchParams.set("vs_currency", "eur");
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));

  const response = await fetch(url);

  if (!response.ok) {
    throw createAppError("market.httpFailed", { provider: "CoinGecko", status: response.status });
  }

  const data = (await response.json()) as CoinGeckoRangeResponse;
  const prices = data.prices.map(([timestamp, price]) => ({ timestamp, price }));

  if (prices.length === 0) {
    throw createAppError("market.noPrices", { provider: "CoinGecko" });
  }

  return prices;
}

async function fetchKrakenPrices(fromMs: number, toMs: number): Promise<PricePoint[]> {
  const since = Math.floor((fromMs - 14 * DAY_MS) / 1000);
  const url = new URL("https://api.kraken.com/0/public/OHLC");

  url.searchParams.set("pair", "XBTEUR");
  url.searchParams.set("interval", "1440");
  url.searchParams.set("since", String(since));

  const response = await fetch(url);

  if (!response.ok) {
    throw createAppError("market.httpFailed", { provider: "Kraken", status: response.status });
  }

  const data = (await response.json()) as KrakenOhlcResponse;

  if (data.error.length > 0) {
    throw new Error(data.error.join(", "));
  }

  const ohlc = Object.entries(data.result).find(([key, value]) => key !== "last" && Array.isArray(value))?.[1];

  if (!Array.isArray(ohlc)) {
    throw createAppError("market.noPrices", { provider: "Kraken" });
  }

  const prices = ohlc
    .map((point) => ({
      timestamp: Number(point[0]) * 1000,
      price: Number(point[4]),
    }))
    .filter((point) => point.timestamp <= toMs + DAY_MS && Number.isFinite(point.price));

  if (prices.length === 0) {
    throw createAppError("market.noPrices", { provider: "Kraken" });
  }

  return prices;
}
