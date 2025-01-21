import { CartItem, PaymentMethod } from './pos';

export interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeAmount?: number;
  date: Date;
  status: 'completed' | 'cancelled' | 'refunded';
  receiptNo: string;
  cancelReason?: string;
  refundReason?: string;
  refundDate?: Date;
}

export interface SalesFilter {
  startDate?: Date;
  endDate?: Date;
  status?: Sale['status'];
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: PaymentMethod;
}

export interface SalesSummary {
  totalSales: number;
  totalAmount: number;
  cancelledCount: number;
  refundedCount: number;
  cashSales: number;
  cardSales: number;
  averageAmount: number;
}