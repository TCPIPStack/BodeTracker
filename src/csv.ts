import Papa from "papaparse";
import type { CsvRow, Purchase } from "./types";

const REQUIRED_COLUMNS = [
  "Date",
  "Time",
  "Type",
  "Currency",
  "Amount",
  "Quote Currency",
  "Quote Price",
  "Received / Paid Amount",
  "Fee amount",
  "Status",
  "Transaction ID",
];

const toNumber = (value: string | undefined) => {
  if (!value) {
    return 0;
  }

  return Number(value.replace(",", "."));
};

export function parsePurchasesCsv(csvText: string): Purchase[] {
  const result = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  const fields = result.meta.fields ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));

  if (missingColumns.length > 0) {
    throw new Error(`Fehlende CSV-Spalten: ${missingColumns.join(", ")}`);
  }

  return result.data
    .filter((row) => row.Type === "buy" && row.Status === "Completed" && row.Currency === "BTC")
    .map((row, index) => {
      const date = row.Date;
      const time = row.Time ?? "00:00:00";
      const timestamp = Date.parse(`${date}T${time}`);
      const btc = toNumber(row.Amount);
      const eur = Math.abs(toNumber(row["Received / Paid Amount"]));
      const fee = toNumber(row["Fee amount"]);
      const quotePrice = toNumber(row["Quote Price"]);

      if (!date || Number.isNaN(timestamp) || btc <= 0 || eur <= 0) {
        throw new Error(`Ungültige Kaufzeile in der CSV bei Datensatz ${index + 2}`);
      }

      return {
        id: row["Transaction ID"] || `${date}-${time}-${index}`,
        date,
        time,
        timestamp,
        btc,
        eur,
        fee,
        totalCost: eur + fee,
        quotePrice,
        transactionId: row["Transaction ID"] || "-",
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}
