export type VatRate = 0 | 1 | 8 | 18 | 20;

export interface Product {
  id: number;
  name: string;
  purchasePrice: number; // Alış fiyatı (KDV'siz)
  salePrice: number; // Satış fiyatı (KDV'siz)
  vatRate: VatRate; // KDV oranı
  priceWithVat: number; // KDV'li fiyat
  category: string;
  stock: number;
  barcode: string;
  imageUrl?: string; // Ürün resmi (opsiyonel)
}

export interface ProductStats {
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  profit: number;
  averagePrice: number;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface ProductGroup {
  id: number;
  name: string;
  order: number;
  isDefault?: boolean;
  productIds?: number[]; // İlişkili ürün ID'leri
}
