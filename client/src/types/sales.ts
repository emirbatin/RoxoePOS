import {
  CartItem,
  PaymentMethod,
  ProductPaymentDetail,
  EqualPaymentDetail,
} from "./pos";
import { VatRate } from "./product";

export interface SplitDetails {
  productPayments?: ProductPaymentDetail[];
  equalPayments?: EqualPaymentDetail[];
}

export interface Sale {
  id: string;
  items: CartItem[];
  subtotal: number; // KDV'siz toplam
  vatAmount: number; // Toplam KDV tutarı
  total: number; // KDV'li toplam
  paymentMethod: PaymentMethod; // "nakit" | "kart" | "veresiye" | "nakitpos" | "mixed"
  cashReceived?: number;
  changeAmount?: number;
  date: Date;
  status: "completed" | "cancelled" | "refunded";
  receiptNo: string;
  cancelReason?: string;
  refundReason?: string;
  refundDate?: Date;

  // Yeni alan: splitDetails - sadece paymentMethod = "mixed" durumlarında dolu olabilir
  splitDetails?: SplitDetails;
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
