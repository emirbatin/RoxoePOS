import { CartItem, PaymentMethod } from "./pos";
import { VatRate } from "./product";

export interface ReceiptInfo {
  receiptNo: string;
  date: Date;
  items: CartItem[];
  subtotal: number; // KDV'siz toplam
  vatAmount: number; // Toplam KDV tutarı
  total: number; // KDV'li toplam
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeAmount?: number;
  vatBreakdown?: Array<{
    // KDV oranlarına göre dağılım
    rate: VatRate;
    baseAmount: number;
    vatAmount: number;
    totalAmount: number;
  }>;
}

export interface ReceiptConfig {
  storeName: string;
  legalName: string;
  address: string[];
  phone: string;
  taxOffice: string;
  taxNumber: string;
  mersisNo: string;
  footer: {
    message: string;
    returnPolicy: string;
  };
  logo?: string;
}

export interface ReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptInfo;
  onPrint?: () => void;
}

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptInfo;
}
