export enum CashRegisterStatus {
  CLOSED = "KAPALI",
  OPEN = "AÇIK"
}

export enum CashTransactionType {
  DEPOSIT = "GİRİŞ",
  WITHDRAWAL = "ÇIKIŞ",
  CREDIT_COLLECTION = "VERESIYE_TAHSILAT" 
}

export interface CashTransaction {
  id: string;
  sessionId: string; // Hangi döneme ait olduğunu belirtir
  type: CashTransactionType;
  amount: number;
  description: string;
  date: Date;
}

export interface CashRegisterSession {
  id: string;
  openingDate: Date;
  openingBalance: number;
  closingDate?: Date;
  cashSalesTotal: number;
  cardSalesTotal: number;
  cashDepositTotal: number;
  cashWithdrawalTotal: number;
  countingAmount?: number;
  countingDifference?: number;
  status: CashRegisterStatus;
}