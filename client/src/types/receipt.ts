import { CartItem, PaymentMethod, VatRate } from './pos';

export interface ReceiptInfo {
  receiptNo: string;
  date: Date;
  items: CartItem[];
  subtotal: number;    // KDV'siz toplam
  vatAmount: number;   // Toplam KDV tutarı
  total: number;       // KDV'li toplam
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeAmount?: number;
  vatBreakdown?: Array<{  // KDV oranlarına göre dağılım
    rate: VatRate;
    baseAmount: number;
    vatAmount: number;
    totalAmount: number;
  }>;
}

export interface ReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptInfo;
  onPrint?: () => void;
}