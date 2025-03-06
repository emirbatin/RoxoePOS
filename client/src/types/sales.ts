// sales.ts dosyası (../types/sales.ts) 
import {
  CartItem,
  PaymentMethod,
  ProductPaymentDetail,
  EqualPaymentDetail,
} from "./pos";
import { VatRate } from "./product";

// DiscountType'ı dışa aktarıyoruz
export type DiscountType = "percentage" | "amount";

// İndirim bilgilerini içeren arayüz
export interface DiscountInfo {
  type: DiscountType; // Yüzde veya sabit tutar
  value: number; // İndirim değeri (yüzde veya miktar)
  discountedTotal: number; // İndirim sonrası toplam tutar
}

export interface SplitDetails {
  productPayments?: ProductPaymentDetail[];
  equalPayments?: EqualPaymentDetail[];
}

export interface Sale {
  id: string;
  items: CartItem[];
  subtotal: number; // KDV'siz toplam
  vatAmount: number; // Toplam KDV tutarı
  total: number; // KDV'li toplam (indirim uygulanmış ise indirimli fiyat)
  originalTotal?: number; // İndirim öncesi toplam (indirim varsa)
  paymentMethod: PaymentMethod; // "nakit" | "kart" | "veresiye" | "nakitpos" | "mixed"
  cashReceived?: number;
  changeAmount?: number;
  date: Date;
  status: "completed" | "cancelled" | "refunded";
  receiptNo: string;
  cancelReason?: string;
  refundReason?: string;
  refundDate?: Date;
  cancelDate?: Date | string;
  splitDetails?: SplitDetails;
  discount?: DiscountInfo; // İndirim bilgisi
}

export interface SalesFilter {
  startDate?: Date;
  endDate?: Date;
  status?: Sale["status"];
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: PaymentMethod;
  hasDiscount?: boolean; // Sadece indirimli satışlar
}

export interface SalesSummary {
  totalSales: number;
  subtotal: number; // KDV'siz toplam
  vatAmount: number; // Toplam KDV tutarı
  totalAmount: number; // KDV'li toplam (indirimler dahil)
  totalDiscount?: number; // Toplam indirim tutarı
  originalAmount?: number; // İndirim öncesi toplam tutar
  cancelledCount: number;
  refundedCount: number;
  cashSales: number;
  cardSales: number;
  averageAmount: number;
  discountedSalesCount?: number; // İndirimli satış sayısı
  vatBreakdown: Array<{
    // KDV oranlarına göre dağılım
    rate: VatRate;
    baseAmount: number;
    vatAmount: number;
    totalAmount: number;
  }>;
}

/**
 * İndirimli satışlar için yardımcı fonksiyonlar
 */
export const SalesHelper = {
  /**
   * İndirim miktarını hesaplar
   */
  calculateDiscountAmount(sale: Sale): number {
    if (!sale.discount) return 0;
    return (sale.originalTotal || sale.total) - sale.total;
  },
  
  /**
   * İndirim oranını hesaplar (yüzde olarak)
   */
  calculateDiscountPercentage(sale: Sale): number {
    if (!sale.discount) return 0;
    const originalTotal = sale.originalTotal || sale.total;
    if (originalTotal <= 0) return 0;
    const discountAmount = originalTotal - sale.total;
    return Math.round((discountAmount / originalTotal) * 100 * 10) / 10; // 1 ondalık basamağa yuvarla
  },
  
  /**
   * İndirim bilgisini formatlar (gösterim için)
   */
  formatDiscountInfo(sale: Sale): string {
    if (!sale.discount) return '';
    if (sale.discount.type === 'percentage') {
      return `%${sale.discount.value} İndirim`;
    } else {
      return `₺${sale.discount.value.toFixed(2)} İndirim`;
    }
  },
  
  /**
   * İndirim uygulandığında yeni toplam tutarı hesaplar
   */
  calculateDiscountedTotal(
    originalTotal: number,
    discountType: DiscountType, // Burada tipi düzelttik
    discountValue: number
  ): number {
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = originalTotal * (discountValue / 100);
    } else {
      discountAmount = Math.min(originalTotal, discountValue);
    }
    return Math.max(0, originalTotal - discountAmount);
  }
};