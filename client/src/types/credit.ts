// types/credit.ts

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  taxNumber?: string;
  creditLimit: number;
  currentDebt: number;
  createdAt: Date;
  note?: string;
}

export interface CreditTransaction {
  id: number;
  customerId: number;
  type: 'debt' | 'payment'; // borç veya ödeme
  amount: number;
  date: Date;
  dueDate?: Date; // vade tarihi
  description: string;
  status: 'active' | 'paid' | 'overdue';
  relatedSaleId?: string; // ilgili satış varsa
  originalAmount?: number; // İndirim öncesi tutar (indirim varsa)
  discountAmount?: number; // İndirim tutarı (indirim varsa)
  discountType?: 'percentage' | 'amount'; // İndirim tipi (yüzdelik veya sabit tutar)
  discountValue?: number; // İndirim değeri (yüzdelik veya TL)
}

export interface CustomerSummary {
  totalDebt: number;
  totalOverdue: number;
  lastTransactionDate?: Date;
  activeTransactions: number;
  overdueTransactions: number;
  // İndirim bilgileri
  discountedSalesCount: number; // İndirimli satış adedi
  totalDiscount: number; // Toplam indirim tutarı
  // Ek istatistikler (opsiyonel)
  averageDiscount?: number; // Ortalama indirim oranı (%)
}

export interface CreditFilter {
  startDate?: Date;
  endDate?: Date;
  status?: CreditTransaction['status'];
  type?: CreditTransaction['type'];
  minAmount?: number;
  maxAmount?: number;
  hasDiscount?: boolean; // İndirimli satışlar filtresi
}

// Ek tip (raporlama için)
export interface CreditStats {
  totalCustomers: number;
  totalDebt: number;
  totalOverdue: number;
  activeCustomers: number; // Aktif borcu olan müşteri sayısı
  overdueCustomers: number; // Vadesi geçmiş borcu olan müşteri sayısı
  // İndirim istatistikleri
  discountedCustomers: number; // İndirim yapılan müşteri sayısı
  totalDiscountAmount: number; // Toplam indirim tutarı
  discountedTransactions: number; // İndirimli işlem sayısı
}