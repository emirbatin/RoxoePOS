import { Customer } from "./credit";
import { Product } from "./product";
// Temel type'lar
export type PaymentMethod = "nakit" | "kart" | "veresiye" | "nakitpos";

export interface CartTab {
  id: string;
  cart: CartItem[];
  title: string;
}

export interface CartItem extends Product {
  quantity: number;
  total?: number;           // KDV'siz toplam (salePrice * quantity)
  vatAmount?: number;       // KDV tutarı
  totalWithVat?: number;    // KDV'li toplam
}

export interface PaymentModalProps {
  isOpen: boolean; // Modal açık mı?
  onClose: () => void; // Modal kapatma işlemi
  total: number; // Toplam tutar
  subtotal: number; // KDV'siz toplam tutar
  vatAmount: number; // KDV tutarı
  onComplete: (paymentMethod: PaymentMethod, cashReceived?: number, paymentData?: any) => void; // Ödeme tamamlandığında çalışacak fonksiyon
  customers: Customer[]; // Müşteri listesi
  selectedCustomer: Customer | null; // Seçilen müşteri (null olabilir)
  setSelectedCustomer: (customer: Customer | null) => void; // Seçilen müşteriyi güncellemek için fonksiyon
  // Aşağıdaki satırı ekleyerek, opsiyonel olarak sepet öğelerini (örneğin, split ödeme için) aktarabilirsiniz:
  items?: { id: number; name: string; amount: number }[];
}

export interface POSConfig {
  type: string; // POS markası/modeli
  baudRate: number; // İletişim hızı
  protocol: string; // Kullanılan protokol
  commandSet: {
    // Cihaza özel komutlar
    payment: string;
    cancel: string;
    status: string;
  };
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
