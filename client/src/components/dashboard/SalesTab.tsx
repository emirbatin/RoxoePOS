import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
import Card from "../ui/Card";

interface SalesTabProps {
  totalSales: number;
  totalRevenue: number;
  netProfit: number;
  profitMargin: number;
  averageBasket: number;
  cancelRate: number;
  refundRate: number;
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
  period: "day" | "week" | "month" | "year" | "custom";
}

const SalesTab: React.FC<SalesTabProps> = ({
  totalSales,
  totalRevenue,
  netProfit,
  profitMargin,
  averageBasket,
  cancelRate,
  refundRate,
  dailySalesData,
  categoryData,
  period,
}) => {
  return (
    <div className="space-y-3">
      {/* Üst özet kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card
          variant="summary"
          title="Toplam Satış Adedi"
          value={totalSales}
          description="Seçili dönem"
          color="indigo"
        />

        <Card
          variant="summary"
          title="Günlük Ortalama"
          value={
            dailySalesData.length > 0
              ? (totalSales / dailySalesData.length).toFixed(1)
              : "0"
          }
          description="Satış / Gün"
          color="blue"
        />

        <Card
          variant="summary"
          title="Ortalama Sepet"
          value={
            totalSales > 0
              ? `₺${(totalRevenue / totalSales).toFixed(2)}`
              : "₺0,00"
          }
          description="Tutar / Satış"
          color="green"
        />

        <Card
          variant="summary"
          title="Kârlılık Oranı"
          value={`%${profitMargin.toFixed(1)}`}
          description="Kâr / Ciro"
          color="purple"
        />

        <Card
          variant="summary"
          title="İptal Oranı"
          value={`%${cancelRate.toFixed(1)}`}
          description="İptal / Toplam"
          color="red"
        />

        <Card
          variant="summary"
          title="İade Oranı"
          value={`%${refundRate.toFixed(1)}`}
          description="İade / Toplam"
          color="orange"
        />
      </div>

      {/* Günlük Satışlar Grafiği */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-800">Günlük Satışlar</h2>
        </div>
        <div className="p-4">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySalesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? value % 1 === 0
                        ? value
                        : `₺${value.toFixed(2)}`
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
                  yAxisId="left"
                  type="monotone"
                  dataKey="total"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ stroke: "#4f46e5", strokeWidth: 2, r: 4 }}
                  activeDot={{ stroke: "#4f46e5", strokeWidth: 2, r: 6 }}
                  name="Brüt Ciro"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ stroke: "#10b981", strokeWidth: 2, r: 4 }}
                  activeDot={{ stroke: "#10b981", strokeWidth: 2, r: 6 }}
                  name="Net Kâr"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="count"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ stroke: "#f97316", strokeWidth: 2, r: 4 }}
                  activeDot={{ stroke: "#f97316", strokeWidth: 2, r: 6 }}
                  name="Satış Adedi"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* İptal ve İade Analizi */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-800">
            İptal ve İade Analizi
          </h2>
        </div>
        <div className="p-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: "İptal",
                    oran: cancelRate,
                    adet: Math.round((totalSales * cancelRate) / 100),
                  },
                  {
                    name: "İade",
                    oran: refundRate,
                    adet: Math.round((totalSales * refundRate) / 100),
                  },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  yAxisId="left"
                  label={{
                    value: "Oran (%)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{
                    value: "Adet",
                    angle: 90,
                    position: "insideRight",
                  }}
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <Tooltip
                  formatter={(value, name) => [
                    name === "oran"
                      ? typeof value === "number"
                        ? `%${value.toFixed(1)}`
                        : value
                      : value,
                    name === "oran" ? "Oran (%)" : "Adet",
                  ]}
                  contentStyle={{
                    borderRadius: "6px",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                    border: "none",
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="oran"
                  name="Oran (%)"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="right"
                  dataKey="adet"
                  name="Adet"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Kategori Grafikleri */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kategori Dağılımı */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-100">
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
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={3}
                    dataKey="profit"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {categoryData.map((_, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={
                          [
                            "#4f46e5",
                            "#10b981",
                            "#f97316",
                            "#8b5cf6",
                            "#06b6d4",
                            "#ec4899",
                          ][idx % 6]
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

        {/* Kategori Bazlı Kârlılık */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              Kategori Bazlı Kârlılık
            </h2>
          </div>
          <div className="p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={75}
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
                  />
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
                  <Bar
                    dataKey="revenue"
                    name="Ciro"
                    fill="#4f46e5"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="profit"
                    name="Kâr"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Aylık Satış Trendi - İlerleme çubuğu tarzında */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-800">
            Satış Performansı
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {/* Kategori başlıkları ve ilerleme çubukları */}
            {categoryData.slice(0, 5).map((category, index) => (
              <div key={index}>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium text-gray-800">
                    {category.name}
                  </div>
                  <div className="text-sm font-medium text-gray-800">
                    ₺{category.revenue.toFixed(2)}
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${
                        (category.revenue /
                          Math.max(...categoryData.map((c) => c.revenue))) *
                        100
                      }%`,
                      backgroundColor: [
                        "#4f46e5",
                        "#10b981",
                        "#f97316",
                        "#8b5cf6",
                        "#06b6d4",
                        "#ec4899",
                      ][index % 6],
                    }}
                  ></div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="text-xs text-gray-500">
                    Satış: {category.quantity}
                  </div>
                  <div className="text-xs text-green-600">
                    Kâr: ₺{category.profit.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesTab;
