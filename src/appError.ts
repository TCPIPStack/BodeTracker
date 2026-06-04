export type AppErrorCode =
  | "csv.parseFailed"
  | "csv.missingColumns"
  | "csv.invalidPurchaseRow"
  | "csv.noPurchases"
  | "csv.loadFailed"
  | "market.httpFailed"
  | "market.noPrices";

export type AppErrorParams = Record<string, string | number>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly params: AppErrorParams;

  constructor(code: AppErrorCode, params: AppErrorParams = {}) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.params = params;
  }
}

export const createAppError = (code: AppErrorCode, params: AppErrorParams = {}) => new AppError(code, params);

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
