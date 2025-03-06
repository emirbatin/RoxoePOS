// types/product.ts

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

/**
 * Ürün istatistikleri - İndirim bilgileriyle genişletilmiş
 */
export interface ProductStats {
  name: string;
  category: string;
  quantity: number;     // Satılan toplam adet
  revenue: number;      // Toplam ciro (indirimli)
  profit: number;       // Toplam kâr (indirimli fiyat - maliyet)
  averagePrice?: number; // Birim başına ortalama fiyat
  
  // İndirim bilgileri
  originalRevenue?: number; // İndirim öncesi toplam ciro
  discount?: number;        // Toplam indirim tutarı
  discountRate?: number;    // Ortalama indirim oranı (%)
  discountedSalesCount?: number; // İndirimli satış adedi
  
  // Maliyet ve karlılık metrikleri
  costPrice?: number;       // Toplam maliyet (purchasePrice * quantity)
  profitMargin?: number;    // Kâr marjı (%)
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

/**
 * Stok hareketi için arayüz
 */
export interface StockMovement {
  id: number;
  productId: number;
  date: Date;
  quantity: number;      // Pozitif giriş, negatif çıkış
  reference?: string;    // Referans (örn. fatura no, satış no)
  description: string;   // Açıklama
  type: 'purchase' | 'sale' | 'return' | 'adjustment' | 'inventory';
}

/**
 * İndirimli satış için ürün bilgisi arayüzü
 */
export interface DiscountedProductInfo {
  productId: number;
  productName: string;
  category: string;
  originalPrice: number;  // İndirim öncesi fiyat
  discountedPrice: number; // İndirim sonrası fiyat
  discountAmount: number;  // İndirim tutarı
  discountRate: number;    // İndirim oranı (%)
  quantity: number;        // Satılan adet
}

/**
 * Ürün filtreleme için
 */
export interface ProductFilter {
  searchTerm?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  vatRate?: VatRate;
  hasDiscount?: boolean; // İndirimli ürünleri filtrele
}

/**
 * Ürün istatistikleri için sıralama kriterleri
 */
export type ProductStatsSortBy = 
  | 'name'
  | 'quantity'
  | 'revenue'
  | 'profit'
  | 'discountRate'
  | 'discount'
  | 'profitMargin';

/**
 * Ürün istatistikleri için filtre
 */
export interface ProductStatsFilter {
  category?: string;
  minSales?: number;
  hasDiscount?: boolean;
  minDiscountRate?: number;
  minProfitMargin?: number;
  sortBy?: ProductStatsSortBy;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Ürün analiz özeti
 */
export interface ProductAnalysisSummary {
  totalProducts: number;          // Toplam ürün sayısı
  totalQuantitySold: number;      // Toplam satılan ürün adedi
  totalRevenue: number;           // Toplam ciro
  totalProfit: number;            // Toplam kâr
  totalDiscount: number;          // Toplam indirim tutarı
  discountedProductsCount: number; // İndirimli ürün sayısı
  averageDiscountRate: number;     // Ortalama indirim oranı
  averageProfitMargin: number;     // Ortalama kâr marjı
  topSellingProducts: ProductStats[]; // En çok satan ürünler
  mostDiscountedProducts: ProductStats[]; // En çok indirim yapılan ürünler
  mostProfitableProducts: ProductStats[]; // En kârlı ürünler
}