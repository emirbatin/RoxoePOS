// utils/dashboardStats.ts

import { ProductStats } from "../types/product";
import { Sale } from "../types/sales";

/**
 * Kategori bazlı veri noktası (ciro, kâr)
 */
export interface CategoryStat {
  name: string; // Kategori adı
  revenue: number; // O kategorideki toplam ciro
  profit: number; // O kategorideki toplam kâr
}

/**
 * Günlük satış verisi, grafikte kullanılır.
 */
export interface DailySalesData {
  date: string; // "yyyy-MM-dd" gibi
  total: number; // Günlük ciro
  profit: number; // Günlük kâr
  count: number; // Günlük satış adedi
}

/**
 * calculateStatsForDashboard fonksiyonunun döndürdüğü tüm veriler.
 */
export interface DashboardStats {
  totalSales: number; // Toplam satış adedi (tümü veya completed)
  totalRevenue: number; // Toplam ciro (completed)
  netProfit: number; // Toplam net kâr (completed)
  profitMargin: number; // (netProfit / totalRevenue) * 100
  averageBasket: number; // (Toplam ciro / completedSales adedi)
  averagePrice: number; // (Toplam ciro / toplam satılan ürün adedi)
  cancelRate: number; // (İptal edilen satış adedi / toplam satış adedi) * 100
  refundRate: number; // (İade edilen satış adedi / toplam satış adedi) * 100
  dailySalesData: DailySalesData[];
  categoryData: CategoryStat[];
  productStats: ProductStats[];
}

export function calculateStatsForDashboard(sales: Sale[]): DashboardStats {
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

  // 2) Toplam ciro ve net kâr
  let totalRevenue = 0;
  let netProfit = 0;

  // 3) Tüm satılan ürün adedini tutacağımız değişken
  let totalQuantity = 0;

  // 4) Kategori/Ürün/Days map'leri
  const categoryMap: Record<string, { revenue: number; profit: number }> = {};
  const productMap: Record<
    string,
    {
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      profit: number;
    }
  > = {};
  const dailyMap: Record<
    string,
    { total: number; profit: number; count: number }
  > = {};

  // 5) Döngü: completedSales
  for (const sale of completedSales) {
    totalRevenue += sale.total;

    let saleProfit = 0;
    for (const item of sale.items) {
      const itemRevenue = item.priceWithVat * item.quantity;
      const itemProfit = (item.salePrice - item.purchasePrice) * item.quantity;

      saleProfit += itemProfit;
      totalQuantity += item.quantity; // Toplam ürün adedi

      // Kategori
      const catKey = item.category || "Diğer";
      if (!categoryMap[catKey]) {
        categoryMap[catKey] = { revenue: 0, profit: 0 };
      }
      categoryMap[catKey].revenue += itemRevenue;
      categoryMap[catKey].profit += itemProfit;

      // Ürün
      const productKey = item.name;
      if (!productMap[productKey]) {
        productMap[productKey] = {
          name: item.name,
          category: item.category || "Diğer",
          quantity: 0,
          revenue: 0,
          profit: 0,
        };
      }
      productMap[productKey].quantity += item.quantity;
      productMap[productKey].revenue += itemRevenue;
      productMap[productKey].profit += itemProfit;
    }

    netProfit += saleProfit;

    // Günlük veri
    const dateKey = new Date(sale.date).toLocaleDateString("tr-TR");
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { total: 0, profit: 0, count: 0 };
    }
    dailyMap[dateKey].total += sale.total;
    dailyMap[dateKey].profit += saleProfit;
    dailyMap[dateKey].count += 1;
  }

  const dailySalesData: DailySalesData[] = Object.entries(dailyMap)
    .map(([date, data]) => ({
      date,
      total: data.total,
      profit: data.profit,
      count: data.count,
    }))
    .sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da - db;
    });

  // 7) categoryData
  const categoryData: CategoryStat[] = Object.entries(categoryMap).map(
    ([name, data]) => ({
      name,
      revenue: data.revenue,
      profit: data.profit,
    })
  );

  // 8) productStats
  const productStats: ProductStats[] = Object.values(productMap);

  // 9) İptal/iade oranları
  const cancelRate = totalSales > 0 ? (cancelledCount / totalSales) * 100 : 0;
  const refundRate = totalSales > 0 ? (refundedCount / totalSales) * 100 : 0;
  // Kâr marjı
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  // Ortalama sepet (completed sales bazında)
  const averageBasket = completedCount > 0 ? totalRevenue / completedCount : 0;
  // Ortalama fiyat (tüm satılan ürünlerdeki ciro / toplam ürün adedi)
  const averagePrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;

  return {
    totalSales, // (veya completedCount)
    totalRevenue,
    netProfit,
    profitMargin,
    averageBasket,
    averagePrice,
    cancelRate,
    refundRate,
    dailySalesData,
    categoryData,
    productStats,
  };
}
