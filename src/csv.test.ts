import { describe, expect, it } from "vitest";
import { parsePurchasesCsv } from "./csv";

const header =
  "Timezone,Date,Time,Type,Currency,Amount,Quote Currency,Quote Price,Received / Paid Currency,Received / Paid Amount,Fee currency,Fee amount,Status,Transaction ID,Address";

const csvValue = (value: string) => (value.includes(",") ? `"${value.replaceAll('"', '""')}"` : value);

const row = ({
  date = "2024-02-01",
  time = "10:15:30.000",
  type = "buy",
  currency = "BTC",
  amount = "0.01",
  quoteCurrency = "EUR",
  quotePrice = "50000",
  receivedPaidCurrency = "EUR",
  receivedPaidAmount = "-500.00",
  feeCurrency = "EUR",
  feeAmount = "1.25",
  status = "Completed",
  transactionId = "tx-1",
  address = "",
} = {}) =>
  [
    "Europe/Berlin",
    date,
    time,
    type,
    currency,
    amount,
    quoteCurrency,
    quotePrice,
    receivedPaidCurrency,
    receivedPaidAmount,
    feeCurrency,
    feeAmount,
    status,
    transactionId,
    address,
  ].map(csvValue).join(",");

const csv = (...rows: string[]) => [header, ...rows].join("\n");

describe("parsePurchasesCsv", () => {
  it("parses valid BTC purchases and sorts them by timestamp", () => {
    const purchases = parsePurchasesCsv(
      csv(
        row({ date: "2024-02-02", time: "12:00:00.000", amount: "0.02", receivedPaidAmount: "-1000", transactionId: "later" }),
        row({ date: "2024-02-01", time: "09:30:00.000", amount: "0.01", receivedPaidAmount: "-500", transactionId: "earlier" }),
      ),
    );

    expect(purchases).toHaveLength(2);
    expect(purchases.map((purchase) => purchase.transactionId)).toEqual(["earlier", "later"]);
    expect(purchases[0]).toMatchObject({
      id: "earlier",
      date: "2024-02-01",
      time: "09:30:00.000",
      btc: 0.01,
      eur: 500,
      fee: 1.25,
      totalCost: 501.25,
      quotePrice: 50000,
      transactionId: "earlier",
    });
    expect(purchases[0].timestamp).toBe(Date.parse("2024-02-01T09:30:00.000"));
  });

  it("filters rows that are not completed BTC buys", () => {
    const purchases = parsePurchasesCsv(
      csv(
        row({ transactionId: "valid" }),
        row({ type: "sell", transactionId: "sell" }),
        row({ currency: "ETH", transactionId: "eth" }),
        row({ status: "Pending", transactionId: "pending" }),
      ),
    );

    expect(purchases.map((purchase) => purchase.transactionId)).toEqual(["valid"]);
  });

  it("accepts decimal commas and falls back to generated ids", () => {
    const purchases = parsePurchasesCsv(
      csv(
        row({
          amount: "0,0125",
          quotePrice: "50000,5",
          receivedPaidAmount: "-625,50",
          feeAmount: "1,75",
          transactionId: "",
        }),
      ),
    );

    expect(purchases[0]).toMatchObject({
      id: "2024-02-01-10:15:30.000-0",
      btc: 0.0125,
      eur: 625.5,
      fee: 1.75,
      totalCost: 627.25,
      quotePrice: 50000.5,
      transactionId: "-",
    });
  });

  it("throws a localized error for missing required columns", () => {
    const invalidCsv = "Date,Time,Type\n2024-02-01,10:00:00.000,buy";

    expect(() => parsePurchasesCsv(invalidCsv)).toThrow(
      "Fehlende CSV-Spalten: Currency, Amount, Quote Currency, Quote Price, Received / Paid Amount, Fee amount, Status, Transaction ID",
    );
  });

  it("throws a localized error for invalid purchase rows", () => {
    expect(() => parsePurchasesCsv(csv(row({ date: "not-a-date" })))).toThrow(
      "Ungültige Kaufzeile in der CSV bei Datensatz 2",
    );
    expect(() => parsePurchasesCsv(csv(row({ amount: "" })))).toThrow(
      "Ungültige Kaufzeile in der CSV bei Datensatz 2",
    );
    expect(() => parsePurchasesCsv(csv(row({ receivedPaidAmount: "" })))).toThrow(
      "Ungültige Kaufzeile in der CSV bei Datensatz 2",
    );
  });
});
