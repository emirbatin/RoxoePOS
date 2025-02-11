// DashboardPage.tsx
import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  ArrowUpRight,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Sale } from "../types/sales";
import DashboardFilters from "../components/DashboardFilters";
import { Table } from "../components/ui/Table";
import Card from "../components/ui/Card"; // Çok amaçlı Card bileşeni (stat için de kullanılacak)
import { salesDB } from "../services/salesDB";
import { exportService } from "../services/exportSevices";
import { Column } from "../types/table";
import { ProductStats } from "../types/product";
import { Pagination } from "../components/ui/Pagination";
import PageLayout from "../components/layout/PageLayout";

// Eğer StatCardItem tipini kullanmak isterseniz:
interface StatCardItem {
  title: string;
  icon: React.ReactNode;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  color?: "green" | "blue" | "red" | "orange" | "primary";
}

const DashboardPage: React.FC = () => {
  // State tanımlamaları
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">(
    "week"
  );
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Satış verilerini yükleme
  const loadSales = async () => {
    try {
      const allSales = await salesDB.getAllSales();
      setSalesData(allSales);
    } catch (error) {
      console.error("Satış verileri yüklenirken hata:", error);
    }
  };

  useEffect(() => {
    loadSales();
    const interval = setInterval(loadSales, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const [start, end] = exportService.getDateRange(period);
    setStartDate(start);
    setEndDate(end);
  }, [period]);

  // Export işlemi
  const handleExport = async (
    type: "excel" | "pdf",
    reportType: "sale" | "product"
  ) => {
    const dateRange = exportService.formatDateRange(startDate, endDate);
    try {
      if (type === "excel") {
        await exportService.exportToExcel(filteredSales, dateRange, reportType);
      } else {
        await exportService.exportToPDF(filteredSales, dateRange, reportType);
      }
    } catch (error) {
      console.error(`${type.toUpperCase()} export hatası:`, error);
      alert(`${type.toUpperCase()} dosyası oluşturulurken bir hata oluştu!`);
    }
  };

  // Tarih aralığına göre filtreleme
  const filteredSales = salesData.filter((sale) => {
    const saleDate = new Date(sale.date);
    return saleDate >= startDate && saleDate <= endDate;
  });

  // Stat hesaplamaları
  const totalStats = {
    totalSales: filteredSales.length,
    totalRevenue: filteredSales
      .filter((sale) => sale.status === "completed")
      .reduce((sum, sale) => sum + sale.total, 0),
    netProfit: filteredSales
      .filter((sale) => sale.status === "completed")
      .reduce((sum, sale) => {
        const saleProfit = sale.items.reduce(
          (itemSum, item) =>
            itemSum + (item.salePrice - item.purchasePrice) * item.quantity,
          0
        );
        return sum + saleProfit;
      }, 0),
    profitMargin:
      filteredSales
        .filter((sale) => sale.status === "completed")
        .reduce((sum, sale) => sum + sale.total, 0) > 0
        ? (filteredSales
            .filter((sale) => sale.status === "completed")
            .reduce((sum, sale) => {
              const saleProfit = sale.items.reduce(
                (itemSum, item) =>
                  itemSum +
                  (item.salePrice - item.purchasePrice) * item.quantity,
                0
              );
              return sum + saleProfit;
            }, 0) /
            filteredSales
              .filter((sale) => sale.status === "completed")
              .reduce((sum, sale) => sum + sale.total, 0)) *
          100
        : 0,
    averageBasket: filteredSales.length
      ? filteredSales.reduce((sum, sale) => sum + sale.total, 0) /
        filteredSales.length
      : 0,
    cancelRate: filteredSales.length
      ? (filteredSales.filter((s) => s.status === "cancelled").length /
          filteredSales.length) *
        100
      : 0,
    refundRate: filteredSales.length
      ? (filteredSales.filter((s) => s.status === "refunded").length /
          filteredSales.length) *
        100
      : 0,
  };

  // Kategori satış dağılımı
  const categorySales = salesData.reduce((acc, sale) => {
    sale.items.forEach((item) => {
      if (!acc[item.category]) {
        acc[item.category] = { count: 0, revenue: 0, profit: 0 };
      }
      acc[item.category].count += item.quantity;
      acc[item.category].revenue += item.priceWithVat * item.quantity;
      acc[item.category].profit +=
        (item.salePrice - item.purchasePrice) * item.quantity;
    });
    return acc;
  }, {} as Record<string, { count: number; revenue: number; profit: number }>);

  const categoryData = Object.entries(categorySales).map(([name, data]) => ({
    name,
    revenue: data.revenue || 0,
    profit: data.profit || 0,
  }));

  // Günlük satış verileri
  const dailySales = salesData.reduce((acc, sale) => {
    const date = new Date(sale.date).toLocaleDateString("tr-TR");
    if (!acc[date]) {
      acc[date] = {
        total: 0,
        count: 0,
        profit: 0,
        netRevenue: 0,
        refunds: 0,
        cancellations: 0,
      };
    }
    acc[date].total += sale.total;
    acc[date].count += 1;
    const saleProfit = sale.items.reduce(
      (sum, item) =>
        sum + (item.salePrice - item.purchasePrice) * item.quantity,
      0
    );
    acc[date].profit += saleProfit;
    if (sale.status === "refunded") acc[date].refunds += 1;
    if (sale.status === "cancelled") acc[date].cancellations += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number; profit: number; netRevenue: number; refunds: number; cancellations: number }>);

  const dailySalesData = Object.entries(dailySales)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  // Ürün istatistikleri hesaplama
  const productStats = filteredSales.reduce((acc, sale) => {
    if (sale.status !== "completed") return acc;
    sale.items.forEach((item) => {
      if (!acc[item.name]) {
        acc[item.name] = {
          name: item.name,
          category: item.category,
          quantity: 0,
          revenue: 0,
          profit: 0,
          averagePrice: item.salePrice,
        };
      }
      acc[item.name].quantity += item.quantity;
      acc[item.name].revenue += item.priceWithVat * item.quantity;
      acc[item.name].profit +=
        (item.salePrice - item.purchasePrice) * item.quantity;
    });
    return acc;
  }, {} as Record<string, { name: string; category: string; quantity: number; revenue: number; profit: number; averagePrice: number }>);

  const sortedProducts = Object.values(productStats).sort(
    (a, b) => b.quantity - a.quantity
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = sortedProducts.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPagesProducts = Math.ceil(sortedProducts.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  // Stat kartlar için Card bileşeni ile kullanılacak statCards dizisi
  const statCards: StatCardItem[] = [
    {
      title: "Toplam Satış",
      icon: <ShoppingCart size={24} />,
      value: totalStats.totalSales,
    },
    {
      title: "Brüt Ciro",
      icon: <DollarSign size={24} />,
      value: new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
      }).format(totalStats.totalRevenue),
    },
    {
      title: "Net Kâr",
      icon: <TrendingUp size={24} />,
      value: new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
      }).format(totalStats.netProfit),
      trend: 5.3,
      trendLabel: "Önceki döneme göre",
      color: "green",
    },
    {
      title: "Kâr Marjı",
      icon: <ArrowUpRight size={24} />,
      value: `%${totalStats.profitMargin.toFixed(1)}`,
      color: "blue",
    },
    {
      title: "İptal Oranı",
      icon: <XCircle size={24} />,
      value: `%${totalStats.cancelRate.toFixed(1)}`,
      color: "red",
    },
    {
      title: "İade Oranı",
      icon: <RotateCcw size={24} />,
      value: `%${totalStats.refundRate.toFixed(1)}`,
      color: "orange",
    },
  ];

  // Ürün satış performansı tablosu için columns tanımı (ProductStats tipi)
  const columns: Column<ProductStats>[] = [
    {
      key: "name",
      title: "Ürün",
      render: (product) => (
        <div className="text-sm font-medium text-gray-900">{product.name}</div>
      ),
    },
    {
      key: "category",
      title: "Kategori",
      render: (product) => (
        <div className="text-sm text-gray-500">{product.category}</div>
      ),
    },
    {
      key: "quantity",
      title: "Satış Adedi",
      className: "text-right",
      render: (product) => (
        <div className="text-sm font-medium">{product.quantity}</div>
      ),
    },
    {
      key: "averagePrice",
      title: "Birim Fiyat",
      className: "text-right",
      render: (product) => (
        <div className="text-sm">{`₺${product.averagePrice.toFixed(2)}`}</div>
      ),
    },
    {
      key: "revenue",
      title: "Toplam Ciro",
      className: "text-right",
      render: (product) => (
        <div className="text-sm">{`₺${product.revenue.toFixed(2)}`}</div>
      ),
    },
    {
      key: "profit",
      title: "Net Kâr",
      className: "text-right",
      render: (product) => (
        <div className="text-sm font-medium text-green-600">{`₺${product.profit.toFixed(
          2
        )}`}</div>
      ),
    },
    {
      key: "profitMargin",
      title: "Kâr Marjı",
      className: "text-right",
      render: (product) => (
        <div className="text-sm">{`%${(
          (product.profit / product.revenue) *
          100
        ).toFixed(1)}`}</div>
      ),
    },
  ];

  return (
    <PageLayout title="Dashboard">

      <div className="mt-6 mb-6">
        <DashboardFilters
          startDate={startDate}
          endDate={endDate}
          onDateChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          period={period}
          onPeriodChange={setPeriod}
          onExport={handleExport}
        />
      </div>
      
      {/* Stat Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 mt-6 mb-6">
        {statCards.map((card, index) => (
          <Card
            key={index}
            variant="stat"
            title={card.title}
            icon={card.icon}
            value={card.value}
            {...(card.trend !== undefined ? { trend: card.trend } : {})}
            {...(card.trendLabel ? { trendLabel: card.trendLabel } : {})}
            {...(card.color ? { color: card.color } : {})}
          />
        ))}
      </div>

      {/* Grafik ve Tablo Bölümleri */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Günlük Satışlar */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Günlük Satışlar</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailySalesData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total"
                  stroke="#8884d8"
                  name="Brüt Ciro (₺)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="profit"
                  stroke="#82ca9d"
                  name="Net Kâr (₺)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="count"
                  stroke="#ffc658"
                  name="Satış Adedi"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kategori Dağılımı */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Kategori Dağılımı</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="profit"
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {categoryData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `₺${value.toFixed(2)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kategori Bazlı Kârlılık */}
        <div className="bg-white p-6 rounded-lg border lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">
            Kategori Bazlı Kârlılık
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#8884d8" name="Brüt Ciro (₺)" />
                <Bar dataKey="profit" fill="#82ca9d" name="Net Kâr (₺)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ürün Satış Performansı Tablosu */}
        <div className="bg-white p-6 rounded-lg border lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Ürün Satış Performansı</h2>
            <span className="text-sm text-gray-500">
              Toplam {sortedProducts.length} ürün
            </span>
          </div>
          <Table<ProductStats, string>
            data={currentProducts}
            columns={columns}
            idField="name"
            className="w-full"
            emptyMessage="Henüz satış verisi bulunmuyor."
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPagesProducts}
            onPageChange={paginate}
            className="mt-4"
          />
        </div>
      </div>
    </PageLayout>
  );
};

export default DashboardPage;
