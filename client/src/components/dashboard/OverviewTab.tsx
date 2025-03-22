import React from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Table } from "../../components/ui/Table";
import { ProductStats } from "../../types/product";
import { CashRegisterSession } from "../../services/cashRegisterDB";
import Card from "../ui/Card";

interface OverviewTabProps {
  totalSales: number;
  totalRevenue: number;
  netProfit: number;
  profitMargin: number;
  dailySalesData: Array<{
    date: string;
    total: number;
    profit: number;
    count: number;
  }>;
  categoryData: Array<{
    name: string;
    revenue: number;
    profit: number;
    quantity: number;
  }>;
  productStats: ProductStats[];
  lastClosedSession: CashRegisterSession | null;
  isLoading: boolean;
  formatDate: (date: Date | string | undefined) => string;
  setCurrentTab: (tab: "overview" | "cash" | "sales" | "products") => void;
  period: "day" | "week" | "month" | "year" | "custom";
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  totalSales,
  totalRevenue,
  netProfit,
  profitMargin,
  dailySalesData,
  categoryData,
  productStats,
  lastClosedSession,
  isLoading,
  formatDate,
  setCurrentTab,
  period,
}) => {
  // Ürün tablosu kolonları
  const productColumns = [
    {
      key: "name",
      title: "Ürün",
      render: (p: ProductStats) => (
        <div className="text-sm font-medium text-gray-900">{p.name}</div>
      ),
    },
    {
      key: "category",
      title: "Kategori",
      render: (p: ProductStats) => (
        <div className="text-sm text-gray-500">{p.category}</div>
      ),
    },
    {
      key: "quantity",
      title: "Adet",
      className: "text-right",
      render: (p: ProductStats) => <div>{p.quantity}</div>,
    },
    {
      key: "revenue",
      title: "Ciro (₺)",
      className: "text-right",
      render: (p: ProductStats) => <div>{p.revenue.toFixed(2)}</div>,
    },
    {
      key: "profit",
      title: "Kâr (₺)",
      className: "text-right",
      render: (p: ProductStats) => (
        <div className="text-green-600 font-medium">{p.profit.toFixed(2)}</div>
      ),
    },
  ];

  // Sıralanmış ürünler
  const sortedProducts = [...productStats].sort(
    (a, b) => b.quantity - a.quantity
  );

  return (
    <div className="space-y-6">
      {/* Üst özet kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          variant="summary"
          title="Toplam Satış"
          value={totalSales}
          description="Toplam satış adedi"
          color="blue"
        />
        <Card
          variant="summary"
          title="Brüt Ciro"
          value={`₺${totalRevenue.toFixed(2)}`}
          description="Toplam gelir"
          color="indigo"
        />
        <Card
          variant="summary"
          title="Net Kâr"
          value={`₺${netProfit.toFixed(2)}`}
          description="Toplam kâr"
          color="green"
        />
        <Card
          variant="summary"
          title="Kâr Marjı"
          value={`%${profitMargin.toFixed(1)}`}
          description="Ortalama kârlılık"
          color="purple"
        />
      </div>

      {/* Grafik kartları */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Günlük Satış Trend Grafiği */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              Günlük Satış Trend
            </h2>
          </div>
          <div className="p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                    label={{
                      value: period === "day" ? "Saat" : "Tarih",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number"
                        ? `₺${value.toFixed(2)}`
                        : `${value}`
                    }
                    contentStyle={{
                      borderRadius: "6px",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                      border: "none",
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    name="Ciro"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Kâr"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Kategori Dağılımı Grafiği */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              Kategori Dağılımı
            </h2>
          </div>
          <div className="p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="revenue"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {categoryData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          [
                            "#4f46e5",
                            "#10b981",
                            "#f97316",
                            "#8b5cf6",
                            "#06b6d4",
                            "#ec4899",
                          ][index % 6]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number"
                        ? `₺${value.toFixed(2)}`
                        : `${value}`
                    }
                    contentStyle={{
                      borderRadius: "6px",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                      border: "none",
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Son Kapanan Kasa */}
      {lastClosedSession && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-800">
              Son Kapanan Kasa Özeti
            </h2>
            <span className="text-sm px-3 py-1 bg-gray-100 rounded-full text-gray-600">
              {formatDate(
                lastClosedSession.closingDate || lastClosedSession.openingDate
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 p-1">
            <div className="p-4 m-2 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-700 mb-1">Açılış Bakiyesi</div>
              <div className="text-lg font-medium text-blue-900">
                ₺{lastClosedSession.openingBalance.toFixed(2)}
              </div>
            </div>
            <div className="p-4 m-2 bg-green-50 rounded-lg">
              <div className="text-sm text-green-700 mb-1">Toplam Satış</div>
              <div className="text-lg font-medium text-green-900">
                ₺
                {(
                  (lastClosedSession.cashSalesTotal || 0) +
                  (lastClosedSession.cardSalesTotal || 0)
                ).toFixed(2)}
              </div>
            </div>
            <div className="p-4 m-2 bg-indigo-50 rounded-lg">
              <div className="text-sm text-indigo-700 mb-1">Sayım Sonucu</div>
              <div className="text-lg font-medium text-indigo-900">
                {lastClosedSession.countingAmount
                  ? `₺${lastClosedSession.countingAmount.toFixed(2)}`
                  : "Sayım yapılmadı"}
              </div>
            </div>
            <div className="p-4 m-2 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-700 mb-1">Kasa Farkı</div>
              <div
                className={`text-lg font-medium ${
                  !lastClosedSession.countingDifference
                    ? "text-gray-500"
                    : lastClosedSession.countingDifference < 0
                    ? "text-red-600"
                    : lastClosedSession.countingDifference > 0
                    ? "text-green-600"
                    : "text-gray-800"
                }`}
              >
                {lastClosedSession.countingDifference
                  ? `${
                      lastClosedSession.countingDifference > 0 ? "+" : ""
                    }₺${lastClosedSession.countingDifference.toFixed(2)}`
                  : "-"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* En Çok Satan Ürünler Tablosu */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-800">
            En Çok Satan Ürünler
          </h2>
          <button
            onClick={() => setCurrentTab("products")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Tümünü Gör
          </button>
        </div>
        {!sortedProducts.length ? (
          <div className="p-8 text-center text-gray-500">
            <p>Bu dönemde satış verisi bulunmuyor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              data={sortedProducts.slice(0, 5)}
              columns={productColumns}
              enableSorting={true}
              defaultSortKey="name"
              defaultSortDirection="asc"
              loading={isLoading}
              emptyMessage="Bu dönemde satış verisi bulunmuyor."
              showTotals={true}
              totalColumns={{ quantity: "sum", revenue: "sum", profit: "sum" }}
              totalData={sortedProducts} // Tüm verileri toplam hesaplama için gönderiyoruz
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewTab;
