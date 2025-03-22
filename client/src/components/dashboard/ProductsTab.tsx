import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";
import { Table } from "../../components/ui/Table";
import { Pagination } from "../../components/ui/Pagination";
import { ProductStats } from "../../types/product";
import Card from "../ui/Card";

interface ProductsTabProps {
  productStats: ProductStats[];
  isLoading: boolean;
  handleExport: (
    fileType: "excel" | "pdf",
    reportType: "sale" | "product" | "cash"
  ) => Promise<void>;
}

const ProductsTab: React.FC<ProductsTabProps> = ({
  productStats,
  isLoading,
  handleExport,
}) => {
  // Sıralama state'i
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ProductStats;
    direction: "asc" | "desc";
  }>({ key: "quantity", direction: "desc" });

  // Sayfalama state'i
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Başlık tıklama işlevi
  const handleSort = (key: keyof ProductStats) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Ürün verisini sıralamak için useMemo kullanımı
  const sortedProducts = useMemo(() => {
    let sortableProducts = [...productStats];
    if (sortConfig) {
      sortableProducts.sort((a, b) => {
        const key = sortConfig.key;
        let aVal = a[key];
        let bVal = b[key];

        // Sayısal değerler için karşılaştırma
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        // String değerler için karşılaştırma
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableProducts;
  }, [productStats, sortConfig]);

  // Sayfalama hesaplamaları
  const idxLast = currentPage * itemsPerPage;
  const idxFirst = idxLast - itemsPerPage;
  const currentProducts = sortedProducts.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

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

  return (
    <div className="space-y-6">
      {/* Üst Özet Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card
          variant="summary"
          title="Toplam Ürün"
          value={sortedProducts.length}
          description="Satılan farklı ürün"
          color="indigo"
        />

        <Card
          variant="summary"
          title="En Çok Satan"
          value={
            sortedProducts.length > 0
              ? [...sortedProducts].sort((a, b) => b.quantity - a.quantity)[0]
                  .name
              : "-"
          }
          description={
            sortedProducts.length > 0
              ? `${
                  [...sortedProducts].sort((a, b) => b.quantity - a.quantity)[0]
                    .quantity
                } adet`
              : "Veri yok"
          }
          color="blue"
        />

        <Card
          variant="summary"
          title="En Kârlı Ürün"
          value={
            sortedProducts.length > 0
              ? [...sortedProducts].sort((a, b) => b.profit - a.profit)[0].name
              : "-"
          }
          description={
            sortedProducts.length > 0
              ? `₺${[...sortedProducts]
                  .sort((a, b) => b.profit - a.profit)[0]
                  .profit.toFixed(2)}`
              : "Veri yok"
          }
          color="green"
        />

        <Card
          variant="summary"
          title="Ortalama Fiyat"
          value={
            sortedProducts.length > 0
              ? `₺${(
                  sortedProducts.reduce((sum, item) => sum + item.revenue, 0) /
                  sortedProducts.reduce((sum, item) => sum + item.quantity, 0)
                ).toFixed(2)}`
              : "₺0,00"
          }
          description="Ortalama birim fiyat"
          color="purple"
        />
      </div>

      {/* Ürün Performans Tablosu */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-800">
            Ürün Satış Performansı
          </h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Toplam {sortedProducts.length} ürün
            </span>
            <button
              onClick={() => handleExport("excel", "product")}
              className="text-sm font-medium flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Download size={14} />
              Excel'e Aktar
            </button>
          </div>
        </div>

        {/* Ürün Tablosu - Güncellenmiş */}
        <div className="overflow-hidden">
          <Table
            data={currentProducts}
            columns={productColumns}
            enableSorting={true}
            defaultSortKey="quantity"
            defaultSortDirection="desc"
            loading={isLoading}
            emptyMessage="Seçilen dönemde satış verisi bulunmuyor."
            showTotals={true}
            totalColumns={{ quantity: "sum", revenue: "sum", profit: "sum" }}
            className="border-none rounded-none"
            totalData={sortedProducts} // Tüm verileri toplam hesaplama için gönderiyoruz
          />
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="flex justify-center"
          />
        </div>
      </div>

      {/* Performans Grafikleri */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Ürün Barchart */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              En Çok Satan 5 Ürün
            </h2>
          </div>
          <div className="p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...sortedProducts]
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 5)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
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
                    width={150}
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
                  <Bar
                    dataKey="quantity"
                    name="Adet"
                    fill="#4f46e5"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top 5 Kârlı Ürün */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              En Kârlı 5 Ürün
            </h2>
          </div>
          <div className="p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...sortedProducts]
                    .sort((a, b) => b.profit - a.profit)
                    .slice(0, 5)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
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
                    width={150}
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
    </div>
  );
};

export default ProductsTab;
