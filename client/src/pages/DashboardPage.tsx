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
  BarChart2,
  Users,
  XCircle,
  RotateCcw,
} from "lucide-react";

import { Sale } from "../types/sales";

import DashboardFilters from "../components/DashboardFilters";
import { StatCard } from "../components/StatCard";

import { salesDB } from "../services/salesDB";
import { exportService } from "../services/exportSevices";

const DashboardPage: React.FC = () => {
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [dateRange, setDateRange] = useState<"week" | "month">("week");
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">(
    "week"
  );
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const loadSales = async () => {
    try {
      const allSales = await salesDB.getAllSales();
      setSalesData(allSales);
    } catch (error) {
      console.error("Satış verileri yüklenirken hata oluştu:", error);
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

  const filteredSales = salesData.filter((sale) => {
    const saleDate = new Date(sale.date);
    return saleDate >= startDate && saleDate <= endDate;
  });

  const handleExport = async (type: "excel" | "pdf") => {
    const dateRange = exportService.formatDateRange(startDate, endDate);

    try {
      if (type === "excel") {
        await exportService.exportToExcel(filteredSales, dateRange);
      } else {
        await exportService.exportToPDF(filteredSales, dateRange);
      }
    } catch (error) {
      console.error(`${type.toUpperCase()} export hatası:`, error);
      alert(`${type.toUpperCase()} dosyası oluşturulurken bir hata oluştu!`);
    }
  };

  const totalStats = {
    totalSales: filteredSales.length,
    totalRevenue: filteredSales
      .filter((sale) => sale.status === "completed")
      .reduce((sum, sale) => sum + sale.total, 0),
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

  const categorySales = salesData.reduce((acc, sale) => {
    sale.items.forEach((item) => {
      if (!acc[item.category]) {
        acc[item.category] = { count: 0, revenue: 0 };
      }
      acc[item.category].count += item.quantity;
      acc[item.category].revenue += item.price * item.quantity;
    });
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  const categoryChartData = Object.entries(categorySales).map(
    ([name, data]) => ({
      name,
      value: data.revenue,
    })
  );

  const dailySales = salesData.reduce((acc, sale) => {
    const date = new Date(sale.date).toLocaleDateString("tr-TR");
    if (!acc[date]) {
      acc[date] = { total: 0, count: 0, refunds: 0, cancellations: 0 };
    }

    acc[date].total += sale.total;
    acc[date].count += 1;

    if (sale.status === "refunded") {
      acc[date].refunds += 1;
    }

    if (sale.status === "cancelled") {
      acc[date].cancellations += 1;
    }

    return acc;
  }, {} as Record<string, { total: number; count: number; refunds: number; cancellations: number }>);

  const dailySalesData = Object.entries(dailySales)
    .map(([date, data]) => ({
      date,
      total: data.total,
      count: data.count,
      refunds: data.refunds,
      cancellations: data.cancellations,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  return (
    <div className="p-6 space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard
          title="Toplam Satış"
          value={totalStats.totalSales.toString()}
          icon={<ShoppingCart size={24} />}
        />
        <StatCard
          title="Toplam Ciro"
          value={`₺${totalStats.totalRevenue.toFixed(2)}`}
          icon={<DollarSign size={24} />}
        />
        <StatCard
          title="Ortalama Sepet"
          value={`₺${totalStats.averageBasket.toFixed(2)}`}
          icon={<BarChart2 size={24} />}
        />
        <StatCard
          title="İptal Oranı"
          value={`%${totalStats.cancelRate.toFixed(1)}`}
          icon={<XCircle size={24} />}
          color="red"
        />
        <StatCard
          title="İade Oranı"
          value={`%${totalStats.refundRate.toFixed(1)}`}
          icon={<RotateCcw size={24} />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  name="Ciro (₺)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="count"
                  stroke="#82ca9d"
                  name="Satış Adedi"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="refunds"
                  stroke="#FF8042"
                  name="İade Adedi"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cancellations"
                  stroke="#FF0000"
                  name="İptal Adedi"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Kategori Dağılımı</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {categoryChartData.map((_, index) => (
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

        <div className="bg-white p-6 rounded-lg border lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">En Çok Satan Ürünler</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Ciro (₺)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
