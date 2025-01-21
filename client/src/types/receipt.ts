import { CartItem } from './pos';

export interface ReceiptInfo {
  receiptNo: string;
  date: Date;
  items: CartItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'nakit' | 'kart';
  cashReceived?: number;
  changeAmount?: number;
}

export interface ReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptInfo;
  onPrint?: () => void;
}