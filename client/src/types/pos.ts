import { Customer } from "./credit";
import { Product } from "./product";

// Temel type'lar
export type PaymentMethod =
  | "nakit"
  | "kart"
  | "veresiye"
  | "nakitpos"
  | "mixed";

export interface CartTab {
  id: string;
  cart: CartItem[];
  title: string;
}

export interface CartItem extends Product {
  quantity: number;
  total?: number; // KDV'siz toplam (salePrice * quantity)
  vatAmount?: number; // KDV tutarı
  totalWithVat?: number; // KDV'li toplam
  source?: 'manual' | 'barcode'; // Ürünün eklenme kaynağı
}

/**
 * Önceden tanımlı PaymentModalProps:
 * onComplete: (paymentMethod: PaymentMethod, cashReceived?: number, paymentData?: any) => void;
 */
export type NormalPaymentData = {
  mode: "normal";
  paymentMethod: PaymentMethod; // "nakit" | "kart" | "veresiye" | "nakitpos"
  received: number;
  discount?: DiscountInfo; 
};

export type ProductPaymentDetail = {
  itemId: number;
  paymentMethod: PaymentMethod;
  received: number;
  customer?: Customer | null;
};

export type EqualPaymentDetail = {
  paymentMethod: PaymentMethod;
  received: number;
  customer?: Customer | null;
};

// Split mod için:
export type SplitPaymentData = {
  mode: "split";
  splitOption: "product" | "equal";
  // Ürün bazında split ödemeler:
  productPayments?: ProductPaymentDetail[];
  // Eşit bölüşüm ödemeler:
  equalPayments?: EqualPaymentDetail[];
  discount?: DiscountInfo;
};

export type PaymentResult = NormalPaymentData | SplitPaymentData;

// Güncellenmiş PaymentModalProps:
export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  subtotal: number;
  vatAmount: number;
  onComplete: (paymentResult: PaymentResult) => void;
  customers: Customer[];
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  items?: { id: number; name: string; amount: number }[];
}

/** POS İle İlgili Tipler **/
export interface POSConfig {
  type: string; // POS markası/modeli
  baudRate: number; // İletişim hızı
  protocol: string; // Kullanılan protokol
  commandSet: {
    payment: string;
    cancel: string;
    status: string;
  };
  manualMode?: boolean; // Manuel mod - fiziksel POS cihazı olmadan çalışma modu
}

export interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
  bufferSize?: number;
  flowControl?: "none" | "hardware";
}

export interface SerialPort {
  readonly readable: ReadableStream;
  readonly writable: WritableStream;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
}

export interface SerialPortInfo {
  usbVendorId: number;
  usbProductId: number;
}

export type DiscountType = "percentage" | "amount";

// İndirim bilgilerini içeren arayüz
export interface DiscountInfo {
  type: DiscountType;       // Yüzde veya sabit tutar
  value: number;            // İndirim değeri (yüzde veya miktar)
  discountedTotal: number;  // İndirim sonrası toplam tutar
}