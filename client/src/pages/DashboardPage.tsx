import React, { useState, useMemo, useEffect } from "react";
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
import DashboardFilters from "../components/DashboardFilters";
import PageLayout from "../components/layout/PageLayout";
import Card from "../components/ui/Card";
import { exportService } from "../services/exportSevices";
import { Sale } from "../types/sales";
import { ProductStats } from "../types/product";
import { Table } from "../components/ui/Table";
import { Pagination } from "../components/ui/Pagination";
import { useSales } from '../hooks/useSales';   // <-- Satış verileri için custom hook
import { calculateStatsForDashboard } from "../utils/dashboardStats"; 
// Yukarıdaki fonksiyon hayali bir utils. Siz projenize göre yazabilirsiniz.

const DashboardPage: React.FC = () => {
  // 1) Satış verisini çekiyoruz (30 sn'de bir otomatik yenilemek isterseniz)
  const { sales, loading: salesLoading, refresh: refreshSales } = useSales(30000);

  // 2) Tarih seçimi ve “period” state
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("week");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  // 3) Tarih aralığına göre satışları filtreleyelim
  const filteredSales = useMemo(() => {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    return sales.filter((sale) => {
      const saleDateMs = new Date(sale.date).getTime();
      return saleDateMs >= startTime && saleDateMs <= endTime;
    });
  }, [sales, startDate, endDate]);

  // 4) Dashboard istatistikleri hesaplama
  // Burada "calculateStatsForDashboard" adlı hayali bir fonksiyonla
  // - totalSales, totalRevenue, netProfit, profitMargin,
  // - dailySalesData (LineChart), categoryData (Pie, BarChart), productStats vb. döndürdüğünü varsayıyoruz.
  const {
    totalSales,
    totalRevenue,
    netProfit,
    profitMargin,
    averageBasket,
    cancelRate,
    refundRate,
    dailySalesData,
    categoryData,
    productStats,
  } = useMemo(() => {
    return calculateStatsForDashboard(filteredSales);
  }, [filteredSales]);

  // 5) Ürün satış performansı tablo verisi
  // productStats => [{ name, category, quantity, revenue, profit }, ...]
  const sortedProducts = productStats.sort((a, b) => b.quantity - a.quantity);

  // Sayfalama
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = sortedProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  // 6) Export işlemi
  const handleExport = async (
    fileType: "excel" | "pdf",
    reportType: "sale" | "product"
  ) => {
    // Tarih aralığı metni oluştur
    const dateRangeString = exportService.formatDateRange(startDate, endDate);
    try {
      if (fileType === "excel") {
        await exportService.exportToExcel(filteredSales, dateRangeString, reportType);
      } else {
        await exportService.exportToPDF(filteredSales, dateRangeString, reportType);
      }
    } catch (error) {
      console.error(`${fileType.toUpperCase()} export hatası:`, error);
      alert(`${fileType.toUpperCase()} oluşturulurken bir hata oluştu!`);
    }
  };

  // 7) Period değiştikçe startDate ve endDate ayarlayalım (ör. bu da proje özel fonksiyon olabilir)
  useEffect(() => {
    const [start, end] = exportService.getDateRange(period);
    setStartDate(start);
    setEndDate(end);
  }, [period]);

  // Tabloda göstereceğimiz kolonlar (örnek)
  const columns = [
    {
      key: "name",
      title: "Ürün",
      render: (item: ProductStats) => (
        <div className="text-sm font-medium text-gray-900">{item.name}</div>
      ),
    },
    {
      key: "category",
      title: "Kategori",
      render: (item: ProductStats) => (
        <div className="text-sm text-gray-500">{item.category}</div>
      ),
    },
    {
      key: "quantity",
      title: "Satış Adedi",
      className: "text-right",
      render: (item: ProductStats) => (
        <div className="text-sm font-medium">{item.quantity}</div>
      ),
    },
    {
      key: "revenue",
      title: "Ciro (₺)",
      className: "text-right",
      render: (item: ProductStats) => (
        <div className="text-sm">{item.revenue.toFixed(2)}</div>
      ),
    },
    {
      key: "profit",
      title: "Kâr (₺)",
      className: "text-right",
      render: (item: ProductStats) => (
        <div className="text-sm text-green-600 font-medium">{item.profit.toFixed(2)}</div>
      ),
    },
  ];

  return (
    <PageLayout title="Dashboard">
      {/* Filtreler */}
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

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 mt-6 mb-6">
        <Card
          variant="stat"
          title="Toplam Satış"
          icon={<ShoppingCart size={24} />}
          value={totalSales}
        />
        <Card
          variant="stat"
          title="Brüt Ciro"
          icon={<DollarSign size={24} />}
          value={new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
          }).format(totalRevenue)}
        />
        <Card
          variant="stat"
          title="Net Kâr"
          icon={<TrendingUp size={24} />}
          value={new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
          }).format(netProfit)}
          trend={5.3}
          trendLabel="Önceki Dönem"
          color="green"
        />
        <Card
          variant="stat"
          title="Kâr Marjı"
          icon={<ArrowUpRight size={24} />}
          value={`%${profitMargin.toFixed(1)}`}
          color="blue"
        />
        <Card
          variant="stat"
          title="İptal Oranı"
          icon={<XCircle size={24} />}
          value={`%${cancelRate.toFixed(1)}`}
          color="red"
        />
        <Card
          variant="stat"
          title="İade Oranı"
          icon={<RotateCcw size={24} />}
          value={`%${refundRate.toFixed(1)}`}
          color="orange"
        />
      </div>

      {/* Grafikler ve Tablo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Günlük Satışlar */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Günlük Satışlar</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySalesData}>
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
                  name="Brüt Ciro"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="profit"
                  stroke="#82ca9d"
                  name="Net Kâr"
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
                  {categoryData.map((_, idx) => (
                    <Cell key={idx} fill="#82ca9d" />
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
          <h2 className="text-lg font-semibold mb-4">Kategori Bazlı Kârlılık</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#8884d8" name="Ciro" />
                <Bar dataKey="profit" fill="#82ca9d" name="Kâr" />
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
            loading={salesLoading}
            emptyMessage="Satış verisi bulunmuyor."
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="mt-4"
          />
        </div>
      </div>
    </PageLayout>
  );
};

export default DashboardPage;