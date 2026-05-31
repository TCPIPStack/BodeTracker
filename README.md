# BodeTracker

BodeTracker is a local browser app for visualizing Bitcoin purchases on a BTC/EUR chart. It imports a local CSV transaction history in the browser, plots purchase events as orange circles, and shows portfolio metrics for the selected time range.

No CSV data is persisted, uploaded, or committed to this repository.

## Requirements

- Node.js 20 or newer
- npm
- Internet access for BTC/EUR market data

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open the app:

```text
http://127.0.0.1:5173/
```

Use the `CSV laden` button to select a local transaction CSV. The app currently expects a CSV with columns similar to:

```text
Timezone,Date,Time,Type,Currency,Amount,Quote Currency,Quote Price,Received / Paid Currency,Received / Paid Amount,Fee currency,Fee amount,Status,Transaction ID,Address
```

Only completed BTC buy transactions are visualized.

An example file with synthetic data is available at:

```text
examples/sample-transactions.csv
```

You can use it to test the app or as a template for converting your own transaction history into the supported format.

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Notes

- CSV files are ignored by Git via `.gitignore`.
- The app first tries CoinGecko for market data and falls back to Kraken if needed.
- Sensitive values can be visually censored with the privacy toggle.

## To Do

- Remove the Bitcoin Reserve / Cash Reserve toggle.
- Support additional CSV formats.
- Make loaded data survive page reloads, likely via local storage.
- Use more distinct colors for portfolio graph indicators.
- Improve alignment between buy indicators and the BTC price indicator.
- Add mouseover popups for the Bitcoin price line and average purchase price line.
- Add mouseover popups for portfolio graph indicators.
- Remove the transaction ID from the buy indicator mouseover popup.
- Improve the color scheme for all mouseover popups so they better match the app design.
- In mouseover popups for invested capital, Euro value, Bitcoin price, and average purchase price, replace the Bitcoin price row with the difference between invested capital and Euro value; show positive values in green and negative values in red.
- Package the app as Windows and macOS executables with Electron.
- Add automated tests for CSV parsing and portfolio calculations.
- Add an explicit sample CSV schema or import validation screen.
- Improve mobile layout polish.
- Add offline or cached market-data support.
