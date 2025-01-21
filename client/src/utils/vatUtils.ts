import { VatRate, CartItem } from '../types/pos';

// KDV'li fiyat hesaplama
export const calculatePriceWithVat = (price: number, vatRate: VatRate): number => {
  return Number((price * (1 + vatRate / 100)).toFixed(2));
};

// KDV tutarı hesaplama
export const calculateVatAmount = (price: number, vatRate: VatRate): number => {
  return Number((price * (vatRate / 100)).toFixed(2));
};

// KDV'siz fiyat hesaplama (KDV'li fiyattan)
export const calculatePriceWithoutVat = (priceWithVat: number, vatRate: VatRate): number => {
  return Number((priceWithVat / (1 + vatRate / 100)).toFixed(2));
};

// Sepet öğesi için KDV hesaplamaları
export const calculateCartItemTotals = (item: CartItem): CartItem => {
  const totalWithoutVat = Number((item.price * item.quantity).toFixed(2));
  const totalVatAmount = Number((totalWithoutVat * (item.vatRate / 100)).toFixed(2));
  const totalWithVat = Number((totalWithoutVat + totalVatAmount).toFixed(2));

  return {
    ...item,
    totalWithoutVat,
    totalVatAmount,
    totalWithVat
  };
};

// Sepet toplamı için KDV hesaplamaları
export const calculateCartTotals = (items: CartItem[]) => {
  const totals = {
    subtotal: 0,      // KDV'siz toplam
    vatAmount: 0,     // Toplam KDV
    total: 0,         // KDV'li toplam
    vatBreakdown: new Map<VatRate, { baseAmount: number; vatAmount: number; totalAmount: number }>()
  };

  items.forEach(item => {
    const itemWithTotals = calculateCartItemTotals(item);
    totals.subtotal += itemWithTotals.totalWithoutVat!;
    totals.vatAmount += itemWithTotals.totalVatAmount!;
    totals.total += itemWithTotals.totalWithVat!;

    // KDV oranlarına göre dağılım
    const currentVatGroup = totals.vatBreakdown.get(item.vatRate) || {
      baseAmount: 0,
      vatAmount: 0,
      totalAmount: 0
    };

    totals.vatBreakdown.set(item.vatRate, {
      baseAmount: currentVatGroup.baseAmount + itemWithTotals.totalWithoutVat!,
      vatAmount: currentVatGroup.vatAmount + itemWithTotals.totalVatAmount!,
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