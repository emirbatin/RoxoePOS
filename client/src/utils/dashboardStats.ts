// utils/dashboardStats.ts

import { ProductStats } from "../types/product";
import { Sale, SalesHelper } from "../types/sales";

/**
 * Kategori bazlı veri noktası (ciro, kâr)
 */
export interface CategoryStat {
  name: string; // Kategori adı
  revenue: number; // O kategorideki toplam ciro (indirimli)
  profit: number; // O kategorideki toplam kâr (indirimli fiyat üzerinden)
  quantity: number; // O kategorideki toplam ürün adedi
  // İndirim bilgileri
  originalRevenue: number; // İndirim öncesi ciro
  discount: number; // Toplam indirim tutarı
  discountRate: number; // Ortalama indirim oranı (%)
  discountedSalesCount: number; // İndirimli satış sayısı
}

/**
 * Günlük satış verisi, grafikte kullanılır.
 */
export interface DailySalesData {
  date: string; // "yyyy-MM-dd" veya saat bazında "HH:00" gibi
  total: number; // Toplam ciro (indirimli)
  profit: number; // Toplam kâr (indirimli fiyat üzerinden)
  count: number; // Satış adedi
  // İndirim bilgileri
  originalTotal: number; // İndirim öncesi toplam
  discount: number; // İndirim tutarı
  discountRate: number; // İndirim oranı (%)
  discountedSalesCount: number; // İndirimli satış sayısı
}

/**
 * calculateStatsForDashboard fonksiyonunun döndürdüğü tüm veriler.
 */
export interface DashboardStats {
  totalSales: number; // Toplam satış adedi (tümü veya completed)
  totalRevenue: number; // Toplam ciro (completed, indirimli fiyatlar)
  netProfit: number; // Toplam net kâr (completed, indirimli fiyatlar üzerinden)
  profitMargin: number; // (netProfit / totalRevenue) * 100
  averageBasket: number; // (Toplam ciro / completedSales adedi)
  averagePrice: number; // (Toplam ciro / toplam satılan ürün adedi)
  cancelRate: number; // (İptal edilen satış adedi / toplam satış adedi) * 100
  refundRate: number; // (İade edilen satış adedi / toplam satış adedi) * 100
  // İndirim istatistikleri
  totalRevenueBeforeDiscount: number; // İndirim öncesi toplam ciro
  totalDiscountAmount: number; // Toplam indirim tutarı
  discountedSalesCount: number; // İndirimli satış sayısı
  discountRate: number; // Ortalama indirim oranı (%)
  // Veriler
  dailySalesData: DailySalesData[];
  categoryData: CategoryStat[];
  productStats: ProductStats[];
  categoryList: string[]; // Benzersiz kategorilerin listesi
}

/**
 * Eğer groupByHour true ise günlük satış verileri saat bazında gruplanır,
 * aksi halde varsayılan olarak tarih bazında (gg.aa.yyyy) gruplama yapılır.
 */
export function calculateStatsForDashboard(
  sales: Sale[],
  groupByHour: boolean = false
): DashboardStats {
  // 1) Tamamlanan satışlar, iptal, iade sayıları
  const completedSales = sales.filter((sale) => sale.status === "completed");
  const cancelledCount = sales.filter(
    (sale) => sale.status === "cancelled"
  ).length;
  const refundedCount = sales.filter(
    (sale) => sale.status === "refunded"
  ).length;

  const totalSales = sales.length; // Tüm satış kaydı adedi
  const completedCount = completedSales.length;

  // 2) Toplam ciro ve net kâr (indirimli fiyatlar)
  let totalRevenue = 0;
  let netProfit = 0;

  // 3) İndirim istatistikleri
  let totalRevenueBeforeDiscount = 0;
  let totalDiscountAmount = 0;
  let discountedSalesCount = 0;

  // 4) Toplam satılan ürün adedi
  let totalQuantity = 0;

  // 5) Kategori/Ürün/Days map'leri
  const categoryMap: Record<
    string,
    {
      revenue: number;
      profit: number;
      quantity: number;
      originalRevenue: number;
      discount: number;
      discountedSalesCount: number;
    }
  > = {};

  const productMap: Record<
    string,
    {
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      profit: number;
      originalRevenue: number;
      discount: number;
      discountRate: number;
    }
  > = {};

  const dailyMap: Record<
    string,
    {
      total: number;
      profit: number;
      count: number;
      originalTotal: number;
      discount: number;
      discountedSalesCount: number;
    }
  > = {};

  // İndirimli satışları takip etmek için kategori bazlı set
  const categorySaleTracking: Record<string, Set<string>> = {};

  // 6) Döngü: completedSales
  for (const sale of completedSales) {
    // Satışın indirimli toplamı
    totalRevenue += sale.total;

    // İndirim öncesi toplam (varsa)
    const saleOriginalTotal = sale.originalTotal || sale.total;
    totalRevenueBeforeDiscount += saleOriginalTotal;

    // İndirim tutarı
    const saleDiscountAmount = SalesHelper.calculateDiscountAmount(sale);
    totalDiscountAmount += saleDiscountAmount;

    // İndirim var mı?
    const hasDiscount = !!sale.discount;
    if (hasDiscount) {
      discountedSalesCount++;
    }

    // İndirim oranı (satış bazında)
    const saleDiscountRate = hasDiscount
      ? (saleDiscountAmount / saleOriginalTotal) * 100
      : 0;

    let saleProfit = 0;
    for (const item of sale.items) {
      const originalItemRevenue = item.priceWithVat * item.quantity;
      let itemRevenue = originalItemRevenue;
      let itemDiscount = 0;

      if (hasDiscount) {
        const discountRate = saleDiscountAmount / saleOriginalTotal;
        itemDiscount = originalItemRevenue * discountRate;
        itemRevenue = originalItemRevenue - itemDiscount;
      }

      const itemPurchaseCost = item.purchasePrice * item.quantity;
      const itemProfit = itemRevenue - itemPurchaseCost;

      saleProfit += itemProfit;
      totalQuantity += item.quantity;

      // Kategori işlemleri
      const catKey = item.category || "Diğer";
      if (!categoryMap[catKey]) {
        categoryMap[catKey] = {
          revenue: 0,
          profit: 0,
          quantity: 0,
          originalRevenue: 0,
          discount: 0,
          discountedSalesCount: 0,
        };
      }
      if (!categorySaleTracking[catKey]) {
        categorySaleTracking[catKey] = new Set<string>();
      }
      categoryMap[catKey].revenue += itemRevenue;
      categoryMap[catKey].profit += itemProfit;
      categoryMap[catKey].quantity += item.quantity;
      categoryMap[catKey].originalRevenue += originalItemRevenue;
      categoryMap[catKey].discount += itemDiscount;
      if (
        hasDiscount &&
        itemDiscount > 0 &&
        !categorySaleTracking[catKey].has(sale.id)
      ) {
        categoryMap[catKey].discountedSalesCount++;
        categorySaleTracking[catKey].add(sale.id);
      }

      // Ürün işlemleri
      const productKey = item.name;
      if (!productMap[productKey]) {
        productMap[productKey] = {
          name: item.name,
          category: item.category || "Diğer",
          quantity: 0,
          revenue: 0,
          profit: 0,
          originalRevenue: 0,
          discount: 0,
          discountRate: 0,
        };
      }
      productMap[productKey].quantity += item.quantity;
      productMap[productKey].revenue += itemRevenue;
      productMap[productKey].profit += itemProfit;
      productMap[productKey].originalRevenue += originalItemRevenue;
      productMap[productKey].discount += itemDiscount;
    }

    netProfit += saleProfit;

    // Günlük veri: Eğer groupByHour true ise saat bazında, aksi halde tarih bazında gruplama yap
    let dateKey: string;
    if (groupByHour) {
      const saleDate = new Date(sale.date);
      const hour = saleDate.getHours();
      dateKey = `${hour.toString().padStart(2, "0")}:00`;
    } else {
      dateKey = new Date(sale.date).toLocaleDateString("tr-TR");
    }

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        total: 0,
        profit: 0,
        count: 0,
        originalTotal: 0,
        discount: 0,
        discountedSalesCount: 0,
      };
    }
    dailyMap[dateKey].total += sale.total;
    dailyMap[dateKey].profit += saleProfit;
    dailyMap[dateKey].count += 1;
    dailyMap[dateKey].originalTotal += saleOriginalTotal;
    dailyMap[dateKey].discount += saleDiscountAmount;
    if (hasDiscount) {
      dailyMap[dateKey].discountedSalesCount++;
    }
  }

  // Ürün bazlı indirim oranı hesaplama
  for (const key in productMap) {
    if (productMap[key].originalRevenue > 0) {
      productMap[key].discountRate =
        (productMap[key].discount / productMap[key].originalRevenue) * 100;
    }
  }

  // Günlük verileri diziye çevirip sıralama
  const dailySalesData: DailySalesData[] = Object.entries(dailyMap)
    .map(([date, data]) => ({
      date, // groupByHour true ise "HH:00", false ise "gg.aa.yyyy" formatında
      total: data.total,
      profit: data.profit,
      count: data.count,
      originalTotal: data.originalTotal,
      discount: data.discount,
      discountRate:
        data.originalTotal > 0 ? (data.discount / data.originalTotal) * 100 : 0,
      discountedSalesCount: data.discountedSalesCount,
    }))
    .sort((a, b) => {
      if (groupByHour) {
        // Saat bazında: "09:00" -> 9, "15:00" -> 15
        return parseInt(a.date.substr(0, 2)) - parseInt(b.date.substr(0, 2));
      } else {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return da - db;
      }
    });

  // Kategori listesi
  const categoryList = Object.keys(categoryMap);

  // Kategori verisi
  const categoryData: CategoryStat[] = Object.entries(categoryMap).map(
    ([name, data]) => ({
      name,
      revenue: data.revenue,
      profit: data.profit,
      quantity: data.quantity,
      originalRevenue: data.originalRevenue,
      discount: data.discount,
      discountRate:
        data.originalRevenue > 0
          ? (data.discount / data.originalRevenue) * 100
          : 0,
      discountedSalesCount: data.discountedSalesCount,
    })
  );

  // Ürün istatistikleri
  const productStats: ProductStats[] = Object.values(productMap);

  // İptal ve iade oranları
  const cancelRate = totalSales > 0 ? (cancelledCount / totalSales) * 100 : 0;
  const refundRate = totalSales > 0 ? (refundedCount / totalSales) * 100 : 0;

  // Kâr marjı
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Ortalama sepet
  const averageBasket = completedCount > 0 ? totalRevenue / completedCount : 0;

  // Ortalama fiyat
  const averagePrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;

  // Ortalama indirim oranı
  const discountRate =
    totalRevenueBeforeDiscount > 0
      ? (totalDiscountAmount / totalRevenueBeforeDiscount) * 100
      : 0;

  return {
    totalSales,
    totalRevenue,
    netProfit,
    profitMargin,
    averageBasket,
    averagePrice,
    cancelRate,
    refundRate,
    totalRevenueBeforeDiscount,
    totalDiscountAmount,
    discountedSalesCount,
    discountRate,
    dailySalesData,
    categoryData,
    productStats,
    categoryList,
  };
}
