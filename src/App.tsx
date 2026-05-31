import ReactECharts, { type EChartsOption } from "echarts-for-react";
import { AlertCircle, Bitcoin, Eye, EyeOff, FileUp, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { parsePurchasesCsv } from "./csv";
import { formatBtc, formatDate, formatEur, formatPercent, formatRangeDate } from "./format";
import { fetchBitcoinPrices } from "./market";
import { calculateStats } from "./stats";
import type { PricePoint, Purchase } from "./types";

type LoadState = "idle" | "loading" | "ready" | "error";

const DEFAULT_RANGE_LABEL = "CSV laden";

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chartRef = useRef<ReactECharts | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [visibleRange, setVisibleRange] = useState<[number, number] | null>(null);
  const [sensitiveValuesHidden, setSensitiveValuesHidden] = useState(false);

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

  const rangeLabel = useMemo(() => {
    const range = visibleRange ?? fullRange;

    if (!range) {
      return DEFAULT_RANGE_LABEL;
    }

    return `${formatRangeDate(range[0])} - ${formatRangeDate(range[1])}`;
  }, [fullRange, visibleRange]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setLoadState("loading");
    setError(null);
    setFileName(file.name);
    setVisibleRange(null);

    try {
      const csvText = await file.text();
      const parsedPurchases = parsePurchasesCsv(csvText);

      if (parsedPurchases.length === 0) {
        throw new Error("Keine abgeschlossenen BTC-Käufe in dieser CSV gefunden.");
      }

      const firstPurchase = parsedPurchases[0].timestamp;
      const lastPurchase = parsedPurchases.at(-1)!.timestamp;
      const priceEnd = Math.max(Date.now(), lastPurchase);
      const fetchedPrices = await fetchBitcoinPrices(firstPurchase, priceEnd);

      setPurchases(parsedPurchases);
      setPrices(fetchedPrices);
      setVisibleRange([fetchedPrices[0].timestamp, fetchedPrices.at(-1)!.timestamp]);
      setLoadState("ready");
    } catch (caughtError) {
      setPurchases([]);
      setPrices([]);
      setVisibleRange(null);
      setLoadState("error");
      setError(caughtError instanceof Error ? caughtError.message : "Die CSV konnte nicht geladen werden.");
    } finally {
      event.target.value = "";
    }
  }, []);

  const chartOption = useMemo<EChartsOption>(() => {
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
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
      },
      backgroundColor: "transparent",
      color: ["#ff9918", "#20c997", "#ff6b35", "#8b5cf6", "#22d3ee"],
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
        textStyle: {
          color: "#a8b0bd",
          fontSize: 13,
          fontWeight: 600,
        },
        itemWidth: 22,
        itemHeight: 8,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          snap: true,
          lineStyle: {
            color: "rgba(255, 153, 24, 0.38)",
            width: 1,
          },
        },
        appendToBody: true,
        backgroundColor: "rgba(7, 12, 22, 0.97)",
        borderColor: "rgba(255, 122, 24, 0.34)",
        borderWidth: 1,
        padding: 14,
        extraCssText:
          "box-shadow: 0 18px 45px rgba(0,0,0,.36), 0 0 24px rgba(255,122,24,.12); border-radius: 8px;",
        textStyle: {
          color: "#f8fafc",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        formatter: (params: unknown) => {
          const item = Array.isArray(params) ? params[0] : params;

          if (!Array.isArray(params) && item.seriesName === "Kauf" && Array.isArray(item.data)) {
            const purchase = item.data[2] as Purchase;

            return `
              <div class="chart-tooltip">
                <strong>BTC-Kauf</strong>
                <span>${formatDate(purchase.timestamp)} · ${purchase.time.split(".")[0]}</span>
                <dl>
                  <dt>BTC</dt><dd>${formatBtc(purchase.btc)}</dd>
                  <dt>Kaufbetrag</dt><dd>${formatEur(purchase.eur, 2)}</dd>
                  <dt>Gebühr</dt><dd>${formatEur(purchase.fee, 2)}</dd>
                  <dt>Gesamtkosten</dt><dd>${formatEur(purchase.totalCost, 2)}</dd>
                  <dt>Kaufpreis</dt><dd>${formatEur(purchase.quotePrice || purchase.totalCost / purchase.btc, 0)}</dd>
                </dl>
                <small>${purchase.transactionId}</small>
              </div>
            `;
          }

          if (Array.isArray(params)) {
            const lineItems = params.filter(
              (axisItem) =>
                axisItem?.seriesName !== "Kauf" &&
                (axisItem?.seriesName === "Bitcoin Preis" ||
                  axisItem?.seriesName === "Ø Kaufpreis" ||
                  axisItem?.seriesName === "Investiertes Kapital" ||
                  axisItem?.seriesName === "Euro-Wert") &&
                Array.isArray(axisItem.data),
            );

            if (lineItems.length === 0) {
              return "";
            }

            const timestamp = Number(lineItems[0].data[0]);
            const isPortfolioPanel = lineItems.some(
              (axisItem) => axisItem.seriesName === "Investiertes Kapital" || axisItem.seriesName === "Euro-Wert",
            );
            const tooltipItems = isPortfolioPanel
              ? lineItems.filter((axisItem) => axisItem.seriesName !== "Bitcoin Preis")
              : lineItems.filter(
                  (axisItem) => axisItem.seriesName === "Bitcoin Preis" || axisItem.seriesName === "Ø Kaufpreis",
                );
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
                <span class="tooltip-dot profit-verlust"></span>Profit/Verlust
              </dt>
              <dd class="tooltip-value-${profitLossClass}">${profitLoss >= 0 ? "+" : ""}${formatEur(profitLoss, 0)}</dd>
            `;
            const rows = tooltipItems
              .map(
                (axisItem) => `
                  <dt>
                    <span class="tooltip-dot ${
                      String(axisItem.seriesName).toLowerCase().replaceAll(" ", "-").replace("ø", "avg")
                    }"></span>${axisItem.seriesName}
                  </dt>
                  <dd>${formatEur(Number(axisItem.data[1]), 0)}</dd>
                `,
              )
              .join("");

            return `
              <div class="chart-tooltip">
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
          type: "time",
          gridIndex: 0,
          axisLine: { lineStyle: { color: "#1f2937" } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: {
            show: true,
            lineStyle: { color: "rgba(148, 163, 184, 0.08)" },
          },
        },
        {
          type: "time",
          gridIndex: 1,
          axisLine: { lineStyle: { color: "#1f2937" } },
          axisTick: { show: false },
          axisLabel: {
            color: "#9ca3af",
            fontSize: 12,
            margin: 14,
          },
          splitLine: {
            show: true,
            lineStyle: { color: "rgba(148, 163, 184, 0.06)" },
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
          name: "Bitcoin Preis (€)",
          nameLocation: "middle",
          nameGap: 66,
          nameTextStyle: {
            color: "#d1d5db",
            fontSize: 12,
            fontWeight: 700,
          },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#9ca3af",
            fontSize: 12,
            formatter: (value: number) => `${new Intl.NumberFormat("de-DE").format(value)} €`,
          },
          splitLine: {
            lineStyle: { color: "rgba(148, 163, 184, 0.14)" },
          },
        },
        {
          type: "value",
          gridIndex: 1,
          min: 0,
          max: portfolioYMax,
          position: "left",
          name: "Portfolio (€)",
          nameLocation: "middle",
          nameGap: 54,
          nameTextStyle: {
            color: "#a78bfa",
            fontSize: 11,
            fontWeight: 800,
          },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#93a4bd",
            fontSize: 11,
            formatter: (value: number) => {
              if (value >= 1_000_000) {
                return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value / 1_000_000)} Mio. €`;
              }

              return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value / 1_000)}k €`;
            },
          },
          splitLine: {
            lineStyle: { color: "rgba(139, 92, 246, 0.14)" },
          },
        },
      ],
      dataZoom: [
        {
          type: "slider",
          xAxisIndex: [0, 1],
          height: 32,
          bottom: 14,
          borderColor: "rgba(148, 163, 184, 0.16)",
          backgroundColor: "rgba(15, 23, 42, 0.84)",
          fillerColor: "rgba(255, 122, 24, 0.16)",
          handleStyle: {
            color: "#ff7a18",
            borderColor: "#fff",
          },
          moveHandleStyle: {
            color: "#ff7a18",
          },
          textStyle: {
            color: "#9ca3af",
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
          name: "Bitcoin Preis",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: prices.map((point) => [point.timestamp, point.price]),
          showSymbol: false,
          smooth: 0.18,
          lineStyle: {
            color: "#ff9918",
            width: 3,
          },
          emphasis: {
            focus: "series",
          },
        },
        {
          name: "Ø Kaufpreis",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: averageCostData,
          symbol: "none",
          step: "end",
          lineStyle: {
            color: "#20c997",
            width: 3,
            type: "dashed",
          },
        },
        {
          name: "Kauf",
          type: "scatter",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: purchaseChartData,
          tooltip: {
            trigger: "item",
            formatter: (params: unknown) => {
              const item = Array.isArray(params) ? params[0] : params;

              if (!Array.isArray(item?.data)) {
                return "";
              }

              const purchase = item.data[2] as Purchase;

              return `
                <div class="chart-tooltip">
                  <strong>BTC-Kauf</strong>
                  <span>${formatDate(purchase.timestamp)} · ${purchase.time.split(".")[0]}</span>
                  <dl>
                    <dt>BTC</dt><dd>${formatBtc(purchase.btc)}</dd>
                    <dt>Kaufbetrag</dt><dd>${formatEur(purchase.eur, 2)}</dd>
                    <dt>Gebühr</dt><dd>${formatEur(purchase.fee, 2)}</dd>
                    <dt>Gesamtkosten</dt><dd>${formatEur(purchase.totalCost, 2)}</dd>
                    <dt>Kaufpreis</dt><dd>${formatEur(purchase.quotePrice || purchase.totalCost / purchase.btc, 0)}</dd>
                  </dl>
                  <small>${purchase.transactionId}</small>
                </div>
              `;
            },
          },
          symbol: "circle",
          symbolSize: (data: unknown) => symbolSize((data as [number, number, Purchase])[2].totalCost),
          itemStyle: {
            color: "#ff6b35",
            borderColor: "#ffffff",
            borderWidth: 3,
            opacity: 0.92,
            shadowColor: "rgba(255, 106, 53, 0.28)",
            shadowBlur: 10,
          },
          z: 8,
        },
        {
          name: "Investiertes Kapital",
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: investedCapitalData,
          symbol: "none",
          step: "end",
          lineStyle: {
            color: "#8b5cf6",
            width: 2.5,
          },
          areaStyle: {
            color: "rgba(139, 92, 246, 0.1)",
          },
          z: 3,
        },
        {
          name: "Euro-Wert",
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: portfolioValueData,
          showSymbol: false,
          smooth: 0.18,
          lineStyle: {
            color: "#22d3ee",
            width: 2.5,
          },
          z: 4,
        },
      ],
    };
  }, [fullRange, prices, purchases, stats.averageCost, visibleRange]);

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
    <main className="app-shell">
      <section className="top-bar">
        <div className="left-controls">
          <button
            className="privacy-toggle"
            type="button"
            role="switch"
            title={sensitiveValuesHidden ? "Sensible Werte anzeigen" : "Sensible Werte zensieren"}
            aria-label={sensitiveValuesHidden ? "Sensible Werte anzeigen" : "Sensible Werte zensieren"}
            aria-checked={sensitiveValuesHidden}
            onClick={() => setSensitiveValuesHidden((isHidden) => !isHidden)}
          >
            <span className="privacy-switch" aria-hidden="true">
              <span />
            </span>
            {sensitiveValuesHidden ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <div className="app-title" aria-label="BODETRACKER">
          BODETRACKER
        </div>

        <div className="actions">
          <div className="range-control">
            <span>Time Range:</span>
            <strong>{rangeLabel}</strong>
          </div>
          <button className="file-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            {isLoading ? <RefreshCw className="spin" size={18} /> : <FileUp size={18} />}
            {isLoading ? "Lade..." : "CSV laden"}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} hidden />
        </div>
      </section>

      <section className="summary">
        <div className="hero-metric">
          <p>Bitcoin Buchwert</p>
          <h1 className={sensitiveClassName}>{formatEur(stats.bookValue, 0)}</h1>
          <div className="metric-row">
            <span className="btc">
              <Bitcoin size={17} /> <span className={sensitiveClassName}>{formatBtc(stats.totalBtc)}</span>
            </span>
            <span>
              Investiert: <span className={sensitiveClassName}>{formatEur(stats.invested, 0)}</span>
            </span>
            <span>Ø Kaufpreis: {formatEur(stats.averageCost, 0)}</span>
            <span className={stats.pnl >= 0 ? "positive" : "negative"}>
              {stats.pnl >= 0 ? "▲" : "▼"}{" "}
              <span className={sensitiveClassName}>
                {formatPercent(stats.pnlPercent)}% ({formatEur(stats.pnl, 0)})
              </span>
            </span>
          </div>
          <small>{fileName ? fileName : "Noch keine CSV geladen"}</small>
        </div>

        <div className="summary-cards">
          <article>
            <span>Purchase Events</span>
            <strong>{stats.purchaseCount}</strong>
            <small>im ausgewählten Zeitraum</small>
          </article>
          <article>
            <span>Total BTC</span>
            <strong>
              <Bitcoin size={18} /> <span className={sensitiveClassName}>{formatBtc(stats.cumulativeTotalBtc)}</span>
            </strong>
            <small>
              Gebühren: <span className={sensitiveClassName}>{formatEur(stats.cumulativeFees, 2)}</span>
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
            <strong>{loadState === "error" ? "CSV oder Kursdaten konnten nicht geladen werden" : "CSV laden, um den Chart zu starten"}</strong>
            <p>
              {error ??
                "Wähle deine Transaktionshistorie aus. Die Datei bleibt nur in dieser Browser-Sitzung im Speicher."}
            </p>
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
