// Temel type'lar
export type PaymentMethod = 'nakit' | 'kart' | 'veresiye' | 'nakitpos';
export type VatRate = 0 | 1 | 8 | 18 | 20;

export interface Product {
  id: number;
  name: string;
  price: number;        // KDV'siz fiyat
  vatRate: VatRate;     // KDV oranı
  priceWithVat: number; // KDV'li fiyat
  category: string;
  stock: number;
  barcode: string;
}

export interface CartTab {
  id: string;
  cart: CartItem[];
  title: string;
}

export interface CartItem extends Product {
  quantity: number;
  totalWithoutVat?: number; // Toplam KDV'siz tutar (hesaplanacak)
  totalVatAmount?: number;  // Toplam KDV tutarı (hesaplanacak)
  totalWithVat?: number;    // Toplam KDV'li tutar (hesaplanacak)
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  subtotal: number;    // KDV'siz toplam
  vatAmount: number;   // Toplam KDV tutarı
  onComplete: (paymentMethod: PaymentMethod, cashReceived?: number) => void;
}