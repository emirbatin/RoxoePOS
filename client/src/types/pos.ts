import { Customer } from "./credit";

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

export interface Category {
  id: number;
  name: string;
  icon: string;
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

export interface PaymentModalProps {
  isOpen: boolean; // Modal açık mı?
  onClose: () => void; // Modal kapatma işlemi
  total: number; // Toplam tutar
  subtotal: number; // KDV'siz toplam tutar
  vatAmount: number; // KDV tutarı
  onComplete: (paymentMethod: PaymentMethod, cashReceived?: number) => void; // Ödeme tamamlandığında çalışacak fonksiyon
  customers: Customer[]; // Müşteri listesi
  selectedCustomer: Customer | null; // Seçilen müşteri (null olabilir)
  setSelectedCustomer: (customer: Customer | null) => void; // Seçilen müşteriyi güncellemek için fonksiyon
}

export interface POSConfig {
  type: string;          // POS markası/modeli
  baudRate: number;      // İletişim hızı
  protocol: string;      // Kullanılan protokol
  commandSet: {          // Cihaza özel komutlar
    payment: string;
    cancel: string;
    status: string;
  };
}

export interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
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

