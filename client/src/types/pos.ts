// Ürün için tip tanımı
export interface Product {
  id: number;
  name: string;
  price: number; // KDV hariç fiyat
  priceWithVat?: number; // KDV dahil fiyat (hesaplanacak)
  vatRate: VatRate;
  category: string;
  stock: number;
  barcode: string;
}

// Sepet öğesi için tip tanımı (ürüne ek olarak quantity içerir)
export interface CartItem extends Product {
  quantity: number;
}

// Kategori için tip tanımı
export interface Category {
  id: number;
  name: string;
  icon: string;
}

// Ödeme Modal Props için tip tanımı
export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onComplete: (paymentMethod: PaymentMethod, cashReceived?: number) => void;
}

// Ödeme yöntemi için tip tanımı
export type PaymentMethod = "nakit" | "kart";

// KDV Oranları için type
export type VatRate = 0 | 1 | 8 | 18 | 20;

// KDV Raporlaması için tipler
export interface VatSummary {
  rate: VatRate;
  baseAmount: number; // KDV matrahı
  vatAmount: number; // KDV tutarı
  totalAmount: number; // Toplam tutar
  count: number; // İşlem sayısı
}

export interface VatReport {
  summaries: VatSummary[];
  totalBaseAmount: number;
  totalVatAmount: number;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
}