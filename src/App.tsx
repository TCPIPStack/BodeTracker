import ReactECharts, { type EChartsOption } from "echarts-for-react";
import { AlertCircle, Bitcoin, Eye, EyeOff, FileUp, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import sampleTransactionsCsv from "../examples/sample-transactions.csv?raw";
import { createAppError, isAppError } from "./appError";
import { parsePurchasesCsv } from "./csv";
import { createFormatters } from "./format";
import { getInitialLocale, LOCALE_STORAGE_KEY, LOCALES, t, translateAppError, type Locale } from "./i18n";
import { fetchBitcoinPrices } from "./market";
import { calculateStats } from "./stats";
import type { PricePoint, Purchase } from "./types";

type LoadState = "idle" | "loading" | "ready" | "error";
type DesignTheme = "terminal" | "premium" | "light";

const DESIGN_THEME_STORAGE_KEY = "bodetracker-design-theme";
const DESIGN_THEMES: DesignTheme[] = ["terminal", "premium", "light"];
const DESIGN_THEME_LABELS: Record<DesignTheme, string> = {
  terminal: "Terminal",
  premium: "Premium",
  light: "Light",
};
const SAMPLE_SOURCE_ID = "__sample__";
const LEGEND_LINE_ICON = "path://M0 3.25 L28 3.25 L28 4.75 L0 4.75 Z";
const LEGEND_DASHED_LINE_ICON =
  "path://M0 3.25 L7 3.25 L7 4.75 L0 4.75 Z M10.5 3.25 L17.5 3.25 L17.5 4.75 L10.5 4.75 Z M21 3.25 L28 3.25 L28 4.75 L21 4.75 Z";

const CHART_SERIES = {
  bitcoinPrice: "bitcoin-price",
  averageCost: "average-cost",
  purchase: "purchase",
  investedCapital: "invested-capital",
  euroValue: "euro-value",
} as const;

type ChartTheme = {
  colors: string[];
  legendText: string;
  axisPointer: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipShadow: string;
  tooltipText: string;
  axisLine: string;
  axisLabel: string;
  priceAxisName: string;
  portfolioAxisName: string;
  gridLine: string;
  gridLineSubtle: string;
  portfolioGridLine: string;
  zoomBorder: string;
  zoomBackground: string;
  zoomFill: string;
  zoomHandle: string;
  zoomHandleBorder: string;
  price: string;
  average: string;
  purchase: string;
  purchaseStroke: string;
  purchaseShadow: string;
  invested: string;
  investedArea: string;
  value: string;
};

const CHART_THEMES: Record<DesignTheme, ChartTheme> = {
  terminal: {
    colors: ["#ff9918", "#1ed29a", "#ff6433", "#8b5cf6", "#22d3ee"],
    legendText: "#b4bdcc",
    axisPointer: "rgba(255, 153, 24, 0.38)",
    tooltipBackground: "rgba(4, 7, 12, 0.97)",
    tooltipBorder: "rgba(255, 138, 31, 0.4)",
    tooltipShadow: "0 18px 44px rgba(0,0,0,.44), 0 0 26px rgba(255,138,31,.12)",
    tooltipText: "#f8fafc",
    axisLine: "rgba(148, 163, 184, 0.18)",
    axisLabel: "#8591a5",
    priceAxisName: "#d1d5db",
    portfolioAxisName: "#a78bfa",
    gridLine: "rgba(148, 163, 184, 0.1)",
    gridLineSubtle: "rgba(148, 163, 184, 0.08)",
    portfolioGridLine: "rgba(139, 92, 246, 0.14)",
    zoomBorder: "rgba(255, 138, 31, 0.26)",
    zoomBackground: "rgba(15, 23, 42, 0.84)",
    zoomFill: "rgba(255, 138, 31, 0.18)",
    zoomHandle: "#ff8a1f",
    zoomHandleBorder: "#fff7ed",
    price: "#ff9918",
    average: "#1ed29a",
    purchase: "#ff6433",
    purchaseStroke: "#fff7ed",
    purchaseShadow: "rgba(255, 100, 51, 0.28)",
    invested: "#8b5cf6",
    investedArea: "rgba(139, 92, 246, 0.1)",
    value: "#22d3ee",
  },
  premium: {
    colors: ["#f2bd58", "#7ed6ac", "#f59f43", "#a991ff", "#77d5e9"],
    legendText: "#c5bfad",
    axisPointer: "rgba(242, 189, 88, 0.34)",
    tooltipBackground: "rgba(18, 18, 22, 0.98)",
    tooltipBorder: "rgba(242, 189, 88, 0.34)",
    tooltipShadow: "0 24px 56px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.04)",
    tooltipText: "#fff7e6",
    axisLine: "rgba(228, 176, 83, 0.18)",
    axisLabel: "#9e988d",
    priceAxisName: "#d8c49a",
    portfolioAxisName: "#b8a5ff",
    gridLine: "rgba(223, 211, 181, 0.11)",
    gridLineSubtle: "rgba(223, 211, 181, 0.08)",
    portfolioGridLine: "rgba(169, 145, 255, 0.14)",
    zoomBorder: "rgba(242, 189, 88, 0.28)",
    zoomBackground: "rgba(18, 18, 22, 0.9)",
    zoomFill: "rgba(242, 189, 88, 0.2)",
    zoomHandle: "#e4b053",
    zoomHandleBorder: "#fff7df",
    price: "#f2bd58",
    average: "#7ed6ac",
    purchase: "#f59f43",
    purchaseStroke: "#fff7df",
    purchaseShadow: "rgba(245, 159, 67, 0.26)",
    invested: "#a991ff",
    investedArea: "rgba(169, 145, 255, 0.1)",
    value: "#77d5e9",
  },
  light: {
    colors: ["#d97706", "#0f9f74", "#f97316", "#7058d8", "#0f8ca8"],
    legendText: "#475569",
    axisPointer: "rgba(217, 119, 6, 0.32)",
    tooltipBackground: "#ffffff",
    tooltipBorder: "rgba(217, 119, 6, 0.22)",
    tooltipShadow: "0 18px 44px rgba(15,23,42,.16)",
    tooltipText: "#182132",
    axisLine: "rgba(15, 23, 42, 0.12)",
    axisLabel: "#667085",
    priceAxisName: "#334155",
    portfolioAxisName: "#7058d8",
    gridLine: "rgba(71, 85, 105, 0.14)",
    gridLineSubtle: "rgba(71, 85, 105, 0.1)",
    portfolioGridLine: "rgba(112, 88, 216, 0.13)",
    zoomBorder: "rgba(217, 119, 6, 0.24)",
    zoomBackground: "#eef1f5",
    zoomFill: "rgba(217, 119, 6, 0.18)",
    zoomHandle: "#d97706",
    zoomHandleBorder: "#ffffff",
    price: "#d97706",
    average: "#0f9f74",
    purchase: "#f97316",
    purchaseStroke: "#ffffff",
    purchaseShadow: "rgba(249, 115, 22, 0.22)",
    invested: "#7058d8",
    investedArea: "rgba(112, 88, 216, 0.08)",
    value: "#0f8ca8",
  },
};

const isDesignTheme = (value: string | null): value is DesignTheme =>
  DESIGN_THEMES.includes(value as DesignTheme);

const getStoredDesignTheme = (): DesignTheme => {
  if (typeof window === "undefined") {
    return "terminal";
  }

  try {
    const storedTheme = window.localStorage.getItem(DESIGN_THEME_STORAGE_KEY);
    return isDesignTheme(storedTheme) ? storedTheme : "terminal";
  } catch {
    return "terminal";
  }
};

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chartRef = useRef<ReactECharts | null>(null);
  const loadRequestId = useRef(0);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<unknown>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [visibleRange, setVisibleRange] = useState<[number, number] | null>(null);
  const [sensitiveValuesHidden, setSensitiveValuesHidden] = useState(false);
  const [designTheme, setDesignTheme] = useState<DesignTheme>(getStoredDesignTheme);
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  const translate = useCallback(
    (key: Parameters<typeof t>[1], params?: Parameters<typeof t>[2]) => t(locale, key, params),
    [locale],
  );

  const {
    formatBtc,
    formatCompactEuroAxis,
    formatDate,
    formatEur,
    formatEuroAxis,
    formatPercent,
    formatRangeDate,
  } = useMemo(() => createFormatters(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate("app.title");
  }, [locale, translate]);

  const handleLocaleChange = useCallback((nextLocale: Locale) => {
    setLocale(nextLocale);

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Language selection still works for the current session if storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DESIGN_THEME_STORAGE_KEY, designTheme);
    } catch {
      // Theme selection still works for the current session if storage is unavailable.
    }
  }, [designTheme]);

  const fullRange = useMemo<[number, number] | null>(() => {
    if (prices.length === 0) {
      return null;
    }

    return [prices[0].timestamp, prices.at(-1)!.timestamp];
  }, [prices]);

  const stats = useMemo(
    () => calculateStats(purchases, prices, visibleRange ?? fullRange),
    [fullRange, prices, purchases, visibleRange],
  );

  const loadCsvText = useCallback(async (csvText: string, sourceName: string) => {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;

    setLoadState("loading");
    setError(null);
    setFileName(sourceName);
    setVisibleRange(null);

    try {
      const parsedPurchases = parsePurchasesCsv(csvText);

      if (parsedPurchases.length === 0) {
        throw createAppError("csv.noPurchases");
      }

      const firstPurchase = parsedPurchases[0].timestamp;
      const lastPurchase = parsedPurchases.at(-1)!.timestamp;
      const priceEnd = Math.max(Date.now(), lastPurchase);
      const fetchedPrices = await fetchBitcoinPrices(firstPurchase, priceEnd);

      if (requestId !== loadRequestId.current) {
        return;
      }

      setPurchases(parsedPurchases);
      setPrices(fetchedPrices);
      setVisibleRange([fetchedPrices[0].timestamp, fetchedPrices.at(-1)!.timestamp]);
      setLoadState("ready");
    } catch (caughtError) {
      if (requestId !== loadRequestId.current) {
        return;
      }

      setPurchases([]);
      setPrices([]);
      setVisibleRange(null);
      setLoadState("error");
      setError(caughtError);
    }
  }, []);

  useEffect(() => {
    void loadCsvText(sampleTransactionsCsv, SAMPLE_SOURCE_ID);
  }, [loadCsvText]);

  const rangeLabel = useMemo(() => {
    const range = visibleRange ?? fullRange;

    if (!range) {
      return translate("range.empty");
    }

    return `${formatRangeDate(range[0])} - ${formatRangeDate(range[1])}`;
  }, [formatRangeDate, fullRange, translate, visibleRange]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const csvText = await file.text();
      await loadCsvText(csvText, file.name);
    } catch (caughtError) {
      setPurchases([]);
      setPrices([]);
      setVisibleRange(null);
      setLoadState("error");
      setError(caughtError);
    } finally {
      event.target.value = "";
    }
  }, [loadCsvText]);

  const displayedSourceName = fileName === SAMPLE_SOURCE_ID ? translate("source.sample") : fileName;
  const displayedError = useMemo(() => {
    if (!error) {
      return null;
    }

    if (isAppError(error)) {
      return translateAppError(locale, error);
    }

    return error instanceof Error && error.message ? error.message : translate("error.csv.loadFailed");
  }, [error, locale, translate]);

  const chartOption = useMemo<EChartsOption>(() => {
    const chartTheme = CHART_THEMES[designTheme];
    const tooltipClassName = `chart-tooltip tooltip-theme-${designTheme}`;
    const purchaseTooltipClassName = `${tooltipClassName} purchase-tooltip`;
    const chartLabels = {
      bitcoinPrice: translate("chart.bitcoinPrice"),
      averageCost: translate("chart.averageCost"),
      purchase: translate("chart.purchase"),
      investedCapital: translate("chart.investedCapital"),
      euroValue: translate("chart.euroValue"),
    };
    const seriesLabelToId = new Map<string, string>([
      [chartLabels.bitcoinPrice, CHART_SERIES.bitcoinPrice],
      [chartLabels.averageCost, CHART_SERIES.averageCost],
      [chartLabels.purchase, CHART_SERIES.purchase],
      [chartLabels.investedCapital, CHART_SERIES.investedCapital],
      [chartLabels.euroValue, CHART_SERIES.euroValue],
    ]);
    const getSeriesId = (axisItem: { seriesId?: unknown; seriesName?: unknown } | null | undefined) =>
      typeof axisItem?.seriesId === "string"
        ? axisItem.seriesId
        : seriesLabelToId.get(String(axisItem?.seriesName)) ?? "";
    const purchaseTooltip = (purchase: Purchase) => `
      <div class="${purchaseTooltipClassName}">
        <strong>${translate("tooltip.btcPurchase")}</strong>
        <span>${formatDate(purchase.timestamp)} · ${purchase.time.split(".")[0]}</span>
        <dl class="purchase-tooltip-grid">
          <dt class="tooltip-label-primary">BTC</dt><dd>${formatBtc(purchase.btc)}</dd>
          <dt class="tooltip-row-spaced">${translate("tooltip.purchaseAmount")}</dt><dd class="tooltip-row-spaced">${formatEur(purchase.eur, 2)}</dd>
          <dt>${translate("tooltip.fee")}</dt><dd class="tooltip-value-fee">${formatEur(purchase.fee, 2)}</dd>
          <dt class="tooltip-row-divider tooltip-label-total">${translate("tooltip.totalCost")}</dt><dd class="tooltip-row-divider tooltip-value-total">${formatEur(purchase.totalCost, 2)}</dd>
          <dt class="tooltip-row-spaced">${translate("tooltip.purchasePrice")}</dt><dd class="tooltip-row-spaced tooltip-value-price">${formatEur(purchase.quotePrice || purchase.totalCost / purchase.btc, 0)}</dd>
        </dl>
      </div>
    `;
    const minCost = Math.min(...purchases.map((purchase) => purchase.totalCost), 0);
    const maxCost = Math.max(...purchases.map((purchase) => purchase.totalCost), 1);
    const activeRange = visibleRange ?? fullRange;
    const getChartPriceAt = (timestamp: number) => {
      if (prices.length === 0) {
        return 0;
      }

      if (timestamp <= prices[0].timestamp) {
        return prices[0].price;
      }

      const lastPrice = prices.at(-1)!;

      if (timestamp >= lastPrice.timestamp) {
        return lastPrice.price;
      }

      let lowIndex = 0;
      let highIndex = prices.length - 1;

      while (lowIndex <= highIndex) {
        const middleIndex = Math.floor((lowIndex + highIndex) / 2);
        const middleTimestamp = prices[middleIndex].timestamp;

        if (middleTimestamp === timestamp) {
          return prices[middleIndex].price;
        }

        if (middleTimestamp < timestamp) {
          lowIndex = middleIndex + 1;
        } else {
          highIndex = middleIndex - 1;
        }
      }

      const previous = prices[Math.max(0, highIndex)];
      const next = prices[Math.min(prices.length - 1, lowIndex)];

      if (!previous || !next || previous.timestamp === next.timestamp) {
        return previous?.price ?? next?.price ?? 0;
      }

      const progress = (timestamp - previous.timestamp) / (next.timestamp - previous.timestamp);
      return previous.price + (next.price - previous.price) * progress;
    };
    const averageCostData: [number, number][] = [];
    const investedCapitalData: [number, number][] = [];
    const portfolioValueData: [number, number][] = [];
    let purchaseIndex = 0;
    let cumulativeBtc = 0;
    let cumulativeCost = 0;
    const averageTimeline = Array.from(
      new Set([...prices.map((point) => point.timestamp), ...purchases.map((purchase) => purchase.timestamp)]),
    ).sort((a, b) => a - b);

    for (const timestamp of averageTimeline) {
      while (purchaseIndex < purchases.length && purchases[purchaseIndex].timestamp <= timestamp) {
        cumulativeBtc += purchases[purchaseIndex].btc;
        cumulativeCost += purchases[purchaseIndex].totalCost;
        purchaseIndex += 1;
      }

      if (cumulativeBtc > 0) {
        averageCostData.push([timestamp, cumulativeCost / cumulativeBtc]);
      }
    }

    purchaseIndex = 0;
    cumulativeBtc = 0;
    cumulativeCost = 0;

    for (const pricePoint of prices) {
      while (purchaseIndex < purchases.length && purchases[purchaseIndex].timestamp <= pricePoint.timestamp) {
        cumulativeBtc += purchases[purchaseIndex].btc;
        cumulativeCost += purchases[purchaseIndex].totalCost;
        purchaseIndex += 1;
      }

      if (cumulativeBtc > 0) {
        investedCapitalData.push([pricePoint.timestamp, cumulativeCost]);
        portfolioValueData.push([pricePoint.timestamp, cumulativeBtc * pricePoint.price]);
      }
    }

    const visiblePrices = activeRange
      ? prices.filter((point) => point.timestamp >= activeRange[0] && point.timestamp <= activeRange[1])
      : prices;
    const visiblePurchases = activeRange
      ? purchases.filter((purchase) => purchase.timestamp >= activeRange[0] && purchase.timestamp <= activeRange[1])
      : purchases;
    const purchaseChartData = purchases.map((purchase) => [
      purchase.timestamp,
      getChartPriceAt(purchase.timestamp),
      purchase,
    ]);
    const yValues = [
      ...visiblePrices.map((point) => point.price),
      ...visiblePurchases.map((purchase) => getChartPriceAt(purchase.timestamp)),
      ...averageCostData
        .filter((point) => !activeRange || (point[0] >= activeRange[0] && point[0] <= activeRange[1]))
        .map((point) => point[1]),
    ].filter((value) => Number.isFinite(value) && value > 0);
    const low = yValues.length > 0 ? Math.min(...yValues) : 0;
    const high = yValues.length > 0 ? Math.max(...yValues) : 1;
    const range = high - low || high * 0.1;
    const padding = Math.max(range * 0.12, 2_500);
    const step = range < 18_000 ? 2_500 : 5_000;
    const yMin = Math.max(0, Math.floor((low - padding) / step) * step);
    const yMax = Math.ceil((high + padding) / step) * step;
    const visiblePortfolioValues = [...investedCapitalData, ...portfolioValueData]
      .filter((point) => !activeRange || (point[0] >= activeRange[0] && point[0] <= activeRange[1]))
      .map((point) => point[1])
      .filter((value) => Number.isFinite(value) && value > 0);
    const portfolioMax = visiblePortfolioValues.length > 0 ? Math.max(...visiblePortfolioValues) : 1;
    const portfolioPadding = Math.max(portfolioMax * 0.08, 1_000);
    const portfolioStep = portfolioMax < 100_000 ? 10_000 : 50_000;
    const portfolioYMax = Math.ceil((portfolioMax + portfolioPadding) / portfolioStep) * portfolioStep;
    const symbolSize = (cost: number) => {
      if (maxCost === minCost) {
        return 18;
      }

      return 9 + ((cost - minCost) / (maxCost - minCost)) * 27;
    };

    return {
      animationDuration: 550,
      backgroundColor: "transparent",
      color: chartTheme.colors,
      grid: [
        {
          top: 56,
          right: 88,
          left: 76,
          height: "50%",
        },
        {
          top: "69%",
          right: 88,
          left: 76,
          height: "21%",
        },
      ],
      legend: {
        top: 8,
        left: "center",
        data: [
          { name: chartLabels.bitcoinPrice, icon: LEGEND_LINE_ICON },
          { name: chartLabels.averageCost, icon: LEGEND_DASHED_LINE_ICON },
          { name: chartLabels.purchase, icon: "circle" },
          { name: chartLabels.investedCapital, icon: LEGEND_LINE_ICON },
          { name: chartLabels.euroValue, icon: LEGEND_LINE_ICON },
        ],
        textStyle: {
          color: chartTheme.legendText,
          fontSize: 13,
          fontWeight: 600,
        },
        itemWidth: 22,
        itemHeight: 11,
      },
      axisPointer: {
        link: [{ xAxisIndex: [0, 1] }],
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          snap: true,
          lineStyle: {
            color: chartTheme.axisPointer,
            width: 1,
          },
        },
        appendToBody: true,
        backgroundColor: chartTheme.tooltipBackground,
        borderColor: chartTheme.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        extraCssText: `box-shadow: ${chartTheme.tooltipShadow}; border-radius: 8px;`,
        textStyle: {
          color: chartTheme.tooltipText,
          fontFamily: "Inter, system-ui, sans-serif",
        },
        formatter: (params: unknown) => {
          const item = (Array.isArray(params) ? params[0] : params) as {
            axisId?: unknown;
            axisIndex?: unknown;
            data?: unknown;
            seriesId?: unknown;
            seriesName?: unknown;
            xAxisIndex?: unknown;
          };

          if (!Array.isArray(params) && getSeriesId(item) === CHART_SERIES.purchase && Array.isArray(item.data)) {
            const purchase = item.data[2] as Purchase;

            return purchaseTooltip(purchase);
          }

          if (Array.isArray(params)) {
            const pricePanelSeries = new Set<string>([CHART_SERIES.bitcoinPrice, CHART_SERIES.averageCost]);
            const portfolioPanelSeries = new Set<string>([CHART_SERIES.investedCapital, CHART_SERIES.euroValue]);
            const axisItems = params as Array<{
              axisId?: unknown;
              axisIndex?: unknown;
              data?: unknown;
              seriesId?: unknown;
              seriesName?: unknown;
              xAxisIndex?: unknown;
            }>;
            const firstAxisItem = axisItems.find((axisItem) => getSeriesId(axisItem) !== CHART_SERIES.purchase);
            const hoveredAxisIndex =
              typeof firstAxisItem?.axisIndex === "number"
                ? firstAxisItem.axisIndex
                : typeof firstAxisItem?.xAxisIndex === "number"
                  ? firstAxisItem.xAxisIndex
                  : typeof firstAxisItem?.axisId === "string"
                    ? firstAxisItem.axisId === "portfolio-x"
                      ? 1
                      : 0
                    : undefined;
            const lineItems = params.filter(
              (axisItem) =>
                getSeriesId(axisItem) !== CHART_SERIES.purchase &&
                (pricePanelSeries.has(getSeriesId(axisItem)) || portfolioPanelSeries.has(getSeriesId(axisItem))) &&
                Array.isArray(axisItem.data),
            );

            if (lineItems.length === 0) {
              return "";
            }

            const isPortfolioPanel =
              hoveredAxisIndex === 1 ||
              (hoveredAxisIndex === undefined && portfolioPanelSeries.has(getSeriesId(firstAxisItem)));
            const tooltipItems = lineItems.filter((axisItem) =>
              isPortfolioPanel
                ? portfolioPanelSeries.has(getSeriesId(axisItem))
                : pricePanelSeries.has(getSeriesId(axisItem)),
            );

            if (tooltipItems.length === 0) {
              return "";
            }

            const timestamp = Number(tooltipItems[0].data[0]);
            const priceAtTimestamp = getChartPriceAt(timestamp);
            const investedAtTimestamp = purchases
              .filter((purchase) => purchase.timestamp <= timestamp)
              .reduce((sum, purchase) => sum + purchase.totalCost, 0);
            const btcAtTimestamp = purchases
              .filter((purchase) => purchase.timestamp <= timestamp)
              .reduce((sum, purchase) => sum + purchase.btc, 0);
            const portfolioValueAtTimestamp = btcAtTimestamp * priceAtTimestamp;
            const profitLoss = portfolioValueAtTimestamp - investedAtTimestamp;
            const profitLossClass = profitLoss >= 0 ? "positive" : "negative";
            const profitLossRow = `
              <dt class="tooltip-profit-${profitLossClass}">
                <span class="tooltip-dot profit-loss"></span>${translate("tooltip.profitLoss")}
              </dt>
              <dd class="tooltip-value-${profitLossClass}">${profitLoss >= 0 ? "+" : ""}${formatEur(profitLoss, 0)}</dd>
            `;
            const rows = tooltipItems
              .map(
                (axisItem) => `
                  <dt>
                    <span class="tooltip-dot ${getSeriesId(axisItem)}"></span>${axisItem.seriesName}
                  </dt>
                  <dd>${formatEur(Number(axisItem.data[1]), 0)}</dd>
                `,
              )
              .join("");

            return `
              <div class="${tooltipClassName}">
                <strong>${formatDate(timestamp)}</strong>
                <dl>${rows}${isPortfolioPanel ? profitLossRow : ""}</dl>
              </div>
            `;
          }

          return "";
        },
      },
      xAxis: [
        {
          id: "price-x",
          type: "time",
          gridIndex: 0,
          min: fullRange?.[0],
          max: fullRange?.[1],
          axisLine: { lineStyle: { color: chartTheme.axisLine } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: {
            show: true,
            lineStyle: { color: chartTheme.gridLineSubtle },
          },
        },
        {
          id: "portfolio-x",
          type: "time",
          gridIndex: 1,
          min: fullRange?.[0],
          max: fullRange?.[1],
          axisLine: { lineStyle: { color: chartTheme.axisLine } },
          axisTick: { show: false },
          axisLabel: {
            color: chartTheme.axisLabel,
            fontSize: 12,
            margin: 14,
          },
          splitLine: {
            show: true,
            lineStyle: { color: chartTheme.gridLineSubtle },
          },
        },
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          min: yMin,
          max: yMax,
          scale: true,
          position: "right",
          name: translate("chart.priceAxis"),
          nameLocation: "middle",
          nameGap: 66,
          nameTextStyle: {
            color: chartTheme.priceAxisName,
            fontSize: 12,
            fontWeight: 700,
          },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: chartTheme.axisLabel,
            fontSize: 12,
            formatter: formatEuroAxis,
          },
          splitLine: {
            lineStyle: { color: chartTheme.gridLine },
          },
        },
        {
          type: "value",
          gridIndex: 1,
          min: 0,
          max: portfolioYMax,
          position: "left",
          name: translate("chart.portfolioAxis"),
          nameLocation: "middle",
          nameGap: 54,
          nameTextStyle: {
            color: chartTheme.portfolioAxisName,
            fontSize: 11,
            fontWeight: 800,
          },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: chartTheme.axisLabel,
            fontSize: 11,
            formatter: formatCompactEuroAxis,
          },
          splitLine: {
            lineStyle: { color: chartTheme.portfolioGridLine },
          },
        },
      ],
      dataZoom: [
        {
          type: "slider",
          xAxisIndex: [0, 1],
          height: 32,
          bottom: 14,
          borderColor: chartTheme.zoomBorder,
          backgroundColor: chartTheme.zoomBackground,
          fillerColor: chartTheme.zoomFill,
          handleStyle: {
            color: chartTheme.zoomHandle,
            borderColor: chartTheme.zoomHandleBorder,
          },
          moveHandleStyle: {
            color: chartTheme.zoomHandle,
          },
          textStyle: {
            color: chartTheme.axisLabel,
          },
          startValue: visibleRange?.[0],
          endValue: visibleRange?.[1],
          filterMode: "none",
          brushSelect: false,
        },
        {
          type: "inside",
          xAxisIndex: [0, 1],
          filterMode: "none",
        },
      ],
      series: [
        {
          id: CHART_SERIES.bitcoinPrice,
          name: chartLabels.bitcoinPrice,
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: prices.map((point) => [point.timestamp, point.price]),
          showSymbol: false,
          smooth: 0.18,
          lineStyle: {
            color: chartTheme.price,
            width: 3,
          },
          emphasis: {
            focus: "series",
          },
        },
        {
          id: CHART_SERIES.averageCost,
          name: chartLabels.averageCost,
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: averageCostData,
          symbol: "none",
          step: "end",
          lineStyle: {
            color: chartTheme.average,
            width: 3,
            type: "dashed",
          },
        },
        {
          id: CHART_SERIES.purchase,
          name: chartLabels.purchase,
          type: "scatter",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: purchaseChartData,
          tooltip: {
            trigger: "item",
            formatter: (params: unknown) => {
              const item = (Array.isArray(params) ? params[0] : params) as { data?: unknown };

              if (!Array.isArray(item?.data)) {
                return "";
              }

              const purchase = item.data[2] as Purchase;

              return purchaseTooltip(purchase);
            },
          },
          symbol: "circle",
          symbolSize: (data: unknown) => symbolSize((data as [number, number, Purchase])[2].totalCost),
          itemStyle: {
            color: chartTheme.purchase,
            borderColor: chartTheme.purchaseStroke,
            borderWidth: 3,
            opacity: 0.92,
            shadowColor: chartTheme.purchaseShadow,
            shadowBlur: 10,
          },
          z: 8,
        },
        {
          id: CHART_SERIES.investedCapital,
          name: chartLabels.investedCapital,
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: investedCapitalData,
          symbol: "none",
          step: "end",
          lineStyle: {
            color: chartTheme.invested,
            width: 2.5,
          },
          areaStyle: {
            color: chartTheme.investedArea,
          },
          z: 3,
        },
        {
          id: CHART_SERIES.euroValue,
          name: chartLabels.euroValue,
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: portfolioValueData,
          showSymbol: false,
          smooth: 0.18,
          lineStyle: {
            color: chartTheme.value,
            width: 2.5,
          },
          z: 4,
        },
      ],
    };
  }, [
    designTheme,
    formatBtc,
    formatCompactEuroAxis,
    formatDate,
    formatEur,
    formatEuroAxis,
    fullRange,
    prices,
    purchases,
    translate,
    visibleRange,
  ]);

  const handleDataZoom = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance();
    const option = chart?.getOption();
    const zoom = Array.isArray(option?.dataZoom) ? option.dataZoom[0] : null;
    const xAxis = Array.isArray(option?.xAxis) ? option.xAxis[0] : null;
    const min = Number(xAxis?.min ?? prices[0]?.timestamp);
    const max = Number(xAxis?.max ?? prices.at(-1)?.timestamp);

    if (!zoom || Number.isNaN(min) || Number.isNaN(max)) {
      return;
    }

    const startValue = Number(zoom.startValue);
    const endValue = Number(zoom.endValue);

    if (!Number.isNaN(startValue) && !Number.isNaN(endValue)) {
      setVisibleRange([startValue, endValue]);
      return;
    }

    const start = Number(zoom.start ?? 0);
    const end = Number(zoom.end ?? 100);
    const span = max - min;
    setVisibleRange([min + (span * start) / 100, min + (span * end) / 100]);
  }, [prices]);

  const isLoading = loadState === "loading";
  const hasData = loadState === "ready" && prices.length > 0;
  const sensitiveClassName = sensitiveValuesHidden ? "sensitive-value is-hidden" : "sensitive-value";

  return (
    <main className={`app-shell theme-${designTheme}`}>
      <section className="top-bar">
        <div className="left-controls">
          <button
            className="privacy-toggle"
            type="button"
            role="switch"
            title={sensitiveValuesHidden ? translate("privacy.show") : translate("privacy.hide")}
            aria-label={sensitiveValuesHidden ? translate("privacy.show") : translate("privacy.hide")}
            aria-checked={sensitiveValuesHidden}
            onClick={() => setSensitiveValuesHidden((isHidden) => !isHidden)}
          >
            <span className="privacy-switch" aria-hidden="true">
              <span />
            </span>
            {sensitiveValuesHidden ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          <div className="theme-switcher" role="tablist" aria-label={translate("language.label")}>
            {LOCALES.map((availableLocale) => (
              <button
                className={`theme-tab${locale === availableLocale ? " is-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={locale === availableLocale}
                key={availableLocale}
                onClick={() => handleLocaleChange(availableLocale)}
              >
                {translate(availableLocale === "en" ? "language.en" : "language.de")}
              </button>
            ))}
          </div>
          <div className="theme-switcher" role="tablist" aria-label={translate("theme.label")}>
            {DESIGN_THEMES.map((theme) => (
              <button
                className={`theme-tab${designTheme === theme ? " is-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={designTheme === theme}
                key={theme}
                onClick={() => setDesignTheme(theme)}
              >
                {DESIGN_THEME_LABELS[theme]}
              </button>
            ))}
          </div>
        </div>

        <div className="app-title" aria-label="BODETRACKER">
          BODETRACKER
        </div>

        <div className="actions">
          <div className="range-control">
            <span>{translate("range.label")}</span>
            <strong>{rangeLabel}</strong>
          </div>
          <button className="file-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            {isLoading ? <RefreshCw className="spin" size={18} /> : <FileUp size={18} />}
            {isLoading ? translate("file.loading") : translate("file.load")}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} hidden />
        </div>
      </section>

      <section className="summary">
        <div className="hero-metric">
          <p>{translate("metric.bookValue")}</p>
          <h1 className={sensitiveClassName}>{formatEur(stats.bookValue, 0)}</h1>
          <div className="metric-row">
            <span className="btc">
              <Bitcoin size={17} /> <span className={sensitiveClassName}>{formatBtc(stats.totalBtc)}</span>
            </span>
            <span>
              {translate("metric.invested")} <span className={sensitiveClassName}>{formatEur(stats.invested, 0)}</span>
            </span>
            <span>
              {translate("metric.averageCost")} {formatEur(stats.averageCost, 0)}
            </span>
            <span className={stats.pnl >= 0 ? "positive" : "negative"}>
              {stats.pnl >= 0 ? "▲" : "▼"}{" "}
              <span className={sensitiveClassName}>
                {formatPercent(stats.pnlPercent)}% ({formatEur(stats.pnl, 0)})
              </span>
            </span>
          </div>
          <small>{displayedSourceName ?? translate("source.none")}</small>
        </div>

        <div className="summary-cards">
          <article>
            <span>{translate("metric.purchaseEvents")}</span>
            <strong>{stats.purchaseCount}</strong>
            <small>{translate("metric.selectedRange")}</small>
          </article>
          <article>
            <span>{translate("metric.totalBtc")}</span>
            <strong>
              <Bitcoin size={18} /> <span className={sensitiveClassName}>{formatBtc(stats.cumulativeTotalBtc)}</span>
            </strong>
            <small>
              {translate("metric.fees")}{" "}
              <span className={sensitiveClassName}>{formatEur(stats.cumulativeFees, 2)}</span>
            </small>
          </article>
        </div>
      </section>

      <section className="chart-panel">
        {!hasData && (
          <div className="empty-state">
            <div className="empty-icon">
              <AlertCircle size={24} />
            </div>
            <strong>{loadState === "error" ? translate("empty.errorTitle") : translate("empty.initialTitle")}</strong>
            <p>{displayedError ?? translate("empty.initialBody")}</p>
          </div>
        )}

        {hasData && (
          <ReactECharts
            ref={chartRef}
            option={chartOption}
            notMerge
            lazyUpdate
            className="chart"
            style={{ height: "100%", width: "100%" }}
            onEvents={{ datazoom: handleDataZoom }}
          />
        )}
      </section>
    </main>
  );
}

export default App;
