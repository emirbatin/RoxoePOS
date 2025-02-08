import {CartItem } from '../types/pos';
import {VatRate} from '../types/product'

// KDV'li fiyat hesaplama
export const calculatePriceWithVat = (salePrice: number, vatRate: VatRate): number => {
  return Number((salePrice * (1 + vatRate / 100)).toFixed(2));
};

// KDV tutarı hesaplama
export const calculateVatAmount = (salePrice: number, vatRate: VatRate): number => {
  return Number((salePrice * (vatRate / 100)).toFixed(2));
};

// KDV'siz fiyat hesaplama (KDV'li fiyattan)
export const calculatePriceWithoutVat = (priceWithVat: number, vatRate: VatRate): number => {
  return Number((priceWithVat / (1 + vatRate / 100)).toFixed(2));
};

// Sepet öğesi için KDV hesaplamaları
export const calculateCartItemTotals = (item: CartItem): CartItem => {
  return {
    ...item,
    total: Number((item.salePrice * item.quantity).toFixed(2)),         // KDV'siz toplam
    totalWithVat: Number((item.priceWithVat * item.quantity).toFixed(2)), // KDV'li toplam
    vatAmount: Number(((item.priceWithVat - item.salePrice) * item.quantity).toFixed(2)) // Toplam KDV tutarı
  };
};

// Sepet toplamı için KDV hesaplamaları
export const calculateCartTotals = (items: CartItem[]) => {
  const totals = {
    subtotal: 0,     // KDV'siz toplam (salePrice'lar toplamı)
    vatAmount: 0,    // Toplam KDV
    total: 0,        // KDV'li toplam
    vatBreakdown: new Map<VatRate, { 
      baseAmount: number;      // KDV'siz tutar
      vatAmount: number;       // KDV tutarı
      totalAmount: number;     // KDV'li tutar
    }>()
  };

  items.forEach(item => {
    const itemWithTotals = calculateCartItemTotals(item);
    
    totals.subtotal += itemWithTotals.total!;
    totals.vatAmount += itemWithTotals.vatAmount!;
    totals.total += itemWithTotals.totalWithVat!;

    // KDV oranlarına göre dağılım
    const currentVatGroup = totals.vatBreakdown.get(item.vatRate) || {
      baseAmount: 0,
      vatAmount: 0,
      totalAmount: 0
    };

    totals.vatBreakdown.set(item.vatRate, {
      baseAmount: currentVatGroup.baseAmount + itemWithTotals.total!,
      vatAmount: currentVatGroup.vatAmount + itemWithTotals.vatAmount!,
      totalAmount: currentVatGroup.totalAmount + itemWithTotals.totalWithVat!
    });
  });

  // Map'i Array'e çevir ve sırala
  const vatBreakdownArray = Array.from(totals.vatBreakdown.entries())
    .map(([rate, amounts]) => ({
      rate,
      ...amounts
    }))
    .sort((a, b) => a.rate - b.rate);

  return {
    ...totals,
    vatBreakdown: vatBreakdownArray
  };
};

// Para birimini formatla
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// KDV oranını formatla
export const formatVatRate = (rate: VatRate): string => {
  return `%${rate}`;
};