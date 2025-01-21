import { CartItem, PaymentMethod, VatRate } from "./pos";

export interface Sale {
  id: string;
  items: CartItem[];
  subtotal: number; // KDV'siz toplam
  vatAmount: number; // Toplam KDV tutarı
  total: number; // KDV'li toplam
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeAmount?: number;
  date: Date;
  status: "completed" | "cancelled" | "refunded";
  receiptNo: string;
  cancelReason?: string;
  refundReason?: string;
  refundDate?: Date;
}

export interface SalesFilter {
  startDate?: Date;
  endDate?: Date;
  status?: Sale["status"];
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: PaymentMethod;
}

export interface SalesSummary {
  totalSales: number;
  subtotal: number; // KDV'siz toplam
  vatAmount: number; // Toplam KDV tutarı
  totalAmount: number; // KDV'li toplam
  cancelledCount: number;
  refundedCount: number;
  cashSales: number;
  cardSales: number;
  averageAmount: number;
  vatBreakdown: Array<{
    // KDV oranlarına göre dağılım
    rate: VatRate;
    baseAmount: number;
    vatAmount: number;
    totalAmount: number;
  }>;
}
