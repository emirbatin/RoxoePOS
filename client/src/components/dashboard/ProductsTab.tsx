import React, { useState, useMemo, useRef } from "react";
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
import { Download, Tag, DollarSign, Package, LineChart, XCircle } from "lucide-react";
import { Table } from "../../components/ui/Table";
import { Pagination } from "../../components/ui/Pagination";
import { ProductStats } from "../../types/product";
import Card from "../ui/Card";
import FilterPanel, { ActiveFilter, FilterValue } from "../ui/FilterPanel";
import { normalizedSearch } from "../../utils/turkishSearch";

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
  // Filtreleme state'i
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtre paneli görünürlüğü
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState<boolean>(false);

  // Sıralama state'i
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ProductStats;
    direction: "asc" | "desc";
  }>({ key: "quantity", direction: "desc" });

  // Sayfalama state'i
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Ürün kategorilerini getir
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(productStats.map(product => product.category))];
    return uniqueCategories.filter(category => category); // undefined ve null değerleri filtrele
  }, [productStats]);

  // Aktif filtre ve arama terimine göre ürünleri filtrele
  const filteredProducts = useMemo(() => {
    let result = [...productStats];
  
    // Arama terimini uygula
    if (searchTerm.trim()) {
      result = result.filter(
        (product) =>
          normalizedSearch(product.name, searchTerm) ||
          (product.category && normalizedSearch(product.category, searchTerm))
      );
    }
  
    // Aktif filtreleri uygula
    if (activeFilters.length > 0) {
      // Kategori filtrelerini ayır (OR mantığı için)
      const categoryFilters = activeFilters.filter(filter => filter.key === "category");
      // Diğer filtreler (AND mantığı için)
      const otherFilters = activeFilters.filter(filter => filter.key !== "category");
  
      // Önce kategori filtreleri için OR mantığını uygula
      if (categoryFilters.length > 0) {
        result = result.filter(product => 
          // Eğer bir ürün herhangi bir kategori filtresine uyuyorsa, ürünü dahil et
          categoryFilters.some(filter => product.category === filter.value)
        );
      }
  
      // Sonra diğer filtreler için AND mantığını uygula
      if (otherFilters.length > 0) {
        result = result.filter((product) => {
          return otherFilters.every((filter) => {
            switch (filter.key) {
              case "minQuantity":
                return product.quantity >= parseInt(filter.value);
              case "maxQuantity":
                return product.quantity <= parseInt(filter.value);
              case "minRevenue":
                return product.revenue >= parseFloat(filter.value);
              case "maxRevenue":
                return product.revenue <= parseFloat(filter.value);
              case "minProfit":
                return product.profit >= parseFloat(filter.value);
              case "maxProfit":
                return product.profit <= parseFloat(filter.value);
              case "minProfitMargin":
                return (product.profitMargin || 0) >= parseFloat(filter.value);
              case "maxProfitMargin":
                return (product.profitMargin || 0) <= parseFloat(filter.value);
              default:
                return true;
            }
          });
        });
      }
    }
  
    return result;
  }, [productStats, searchTerm, activeFilters]);

  // Sıralanmış ürünler
  const sortedProducts = useMemo(() => {
    let sortableProducts = [...filteredProducts];
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
  }, [filteredProducts, sortConfig]);

  // Sayfalama hesaplamaları
  const idxLast = currentPage * itemsPerPage;
  const idxFirst = idxLast - itemsPerPage;
  const currentProducts = sortedProducts.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  // Başlık tıklama işlevi
  const handleSort = (key: keyof ProductStats) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Kategori filtresi ekle
  const handleAddCategoryFilter = (category: string) => {
    // Zaten aynı kategori filtresi varsa ekleme
    if (activeFilters.some(filter => filter.key === "category" && filter.value === category)) {
      return;
    }

    const newFilter: ActiveFilter = {
      key: "category",
      label: "Kategori",
      value: category,
      color: "blue",
      icon: <Tag size={14} />,
    };

    setActiveFilters([...activeFilters, newFilter]);
    setCurrentPage(1); // Filtre değişince ilk sayfaya dön
    setIsFilterPanelVisible(false); // Kategori ekledikten sonra paneli kapat
  };

  // Filtre kaldırma işlevi
  const handleRemoveFilter = (key: string, value?: string) => {
    // value parametresi verilmişse, sadece belirli bir kategori filtresini kaldır
    if (key === "category" && value) {
      setActiveFilters(activeFilters.filter(filter => 
        !(filter.key === "category" && filter.value === value)
      ));
    } else {
      // Diğer filtreler için önceki mantığı kullan
      setActiveFilters(activeFilters.filter(filter => {
        // Eğer key doğrudan eşleşiyorsa veya key.startsWith(filterKey) ise kaldır
        // Bu, minQuantity ve maxQuantity gibi benzer filtreleri gruplamak için
        return !(filter.key === key || filter.key.startsWith(`${key}`));
      }));
    }
    setCurrentPage(1); // Filtre değişince ilk sayfaya dön
  };

  // Miktar filtresi ekle
  const handleAddQuantityFilter = (min?: number, max?: number) => {
    // Önce mevcut miktar filtrelerini kaldır
    const filtersWithoutQuantity = activeFilters.filter(
      filter => filter.key !== "minQuantity" && filter.key !== "maxQuantity"
    );
    
    const newFilters = [...filtersWithoutQuantity];

    if (min !== undefined) {
      newFilters.push({
        key: "minQuantity",
        label: "Min Adet",
        value: min.toString(),
        color: "amber",
        icon: <Package size={14} />,
      });
    }

    if (max !== undefined) {
      newFilters.push({
        key: "maxQuantity",
        label: "Max Adet",
        value: max.toString(),
        color: "amber",
        icon: <Package size={14} />,
      });
    }

    setActiveFilters(newFilters);
    setCurrentPage(1);
    
    // Sadece iki değer de girilmişse paneli kapat (kullanıcı deneyimi için)
    if (min !== undefined && max !== undefined) {
      setIsFilterPanelVisible(false);
    }
  };

  // Ciro filtresi ekle
  const handleAddRevenueFilter = (min?: number, max?: number) => {
    // Önce mevcut ciro filtrelerini kaldır
    const filtersWithoutRevenue = activeFilters.filter(
      filter => filter.key !== "minRevenue" && filter.key !== "maxRevenue"
    );
    
    const newFilters = [...filtersWithoutRevenue];

    if (min !== undefined) {
      newFilters.push({
        key: "minRevenue",
        label: "Min Ciro",
        value: min.toString(),
        color: "emerald",
        icon: <DollarSign size={14} />,
      });
    }

    if (max !== undefined) {
      newFilters.push({
        key: "maxRevenue",
        label: "Max Ciro",
        value: max.toString(),
        color: "emerald",
        icon: <DollarSign size={14} />,
      });
    }

    setActiveFilters(newFilters);
    setCurrentPage(1);
    
    // İki değer de girilmişse paneli kapat
    if (min !== undefined && max !== undefined) {
      setIsFilterPanelVisible(false);
    }
  };

  // Kâr filtresi ekle
  const handleAddProfitFilter = (min?: number, max?: number) => {
    // Önce mevcut kâr filtrelerini kaldır
    const filtersWithoutProfit = activeFilters.filter(
      filter => filter.key !== "minProfit" && filter.key !== "maxProfit"
    );
    
    const newFilters = [...filtersWithoutProfit];

    if (min !== undefined) {
      newFilters.push({
        key: "minProfit",
        label: "Min Kâr",
        value: min.toString(),
        color: "green",
        icon: <LineChart size={14} />,
      });
    }

    if (max !== undefined) {
      newFilters.push({
        key: "maxProfit",
        label: "Max Kâr",
        value: max.toString(),
        color: "green",
        icon: <LineChart size={14} />,
      });
    }

    setActiveFilters(newFilters);
    setCurrentPage(1);
    
    // İki değer de girilmişse paneli kapat
    if (min !== undefined && max !== undefined) {
      setIsFilterPanelVisible(false);
    }
  };

  // Tüm filtreleri temizle
  const handleResetFilters = () => {
    setActiveFilters([]);
    setSearchTerm("");
    setCurrentPage(1);
    setIsFilterPanelVisible(false); // Filtreler temizlendiğinde paneli kapat
  };

  // Özel filtre paneli render fonksiyonu
  const renderFilterPanelContent = () => {
    if (!isFilterPanelVisible) return null;
    
    return (
      <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl z-20 border border-gray-100 w-80 p-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-gray-800">Ürün Filtreleri</h3>
          <button
            onClick={handleResetFilters}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Tümünü Temizle
          </button>
        </div>

        <div className="space-y-4">
          {/* Kategori Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              onChange={(e) => e.target.value && handleAddCategoryFilter(e.target.value)}
              value=""
            >
              <option value="">Kategori Seçin</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Miktar Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Satış Adedi
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  placeholder="Min Adet"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  onBlur={(e) => {
                    if (e.target.value) {
                      const min = parseInt(e.target.value);
                      const maxFilter = activeFilters.find(f => f.key === "maxQuantity");
                      const max = maxFilter ? parseInt(maxFilter.value) : undefined;
                      handleAddQuantityFilter(min, max);
                    }
                  }}
                  defaultValue={activeFilters.find(f => f.key === "minQuantity")?.value || ""}
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Max Adet"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  onBlur={(e) => {
                    if (e.target.value) {
                      const max = parseInt(e.target.value);
                      const minFilter = activeFilters.find(f => f.key === "minQuantity");
                      const min = minFilter ? parseInt(minFilter.value) : undefined;
                      handleAddQuantityFilter(min, max);
                    }
                  }}
                  defaultValue={activeFilters.find(f => f.key === "maxQuantity")?.value || ""}
                />
              </div>
            </div>
          </div>

          {/* Ciro Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ciro Aralığı (₺)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₺</span>
                </div>
                <input
                  type="number"
                  placeholder="Min Ciro"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  onBlur={(e) => {
                    if (e.target.value) {
                      const min = parseFloat(e.target.value);
                      const maxFilter = activeFilters.find(f => f.key === "maxRevenue");
                      const max = maxFilter ? parseFloat(maxFilter.value) : undefined;
                      handleAddRevenueFilter(min, max);
                    }
                  }}
                  defaultValue={activeFilters.find(f => f.key === "minRevenue")?.value || ""}
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₺</span>
                </div>
                <input
                  type="number"
                  placeholder="Max Ciro"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  onBlur={(e) => {
                    if (e.target.value) {
                      const max = parseFloat(e.target.value);
                      const minFilter = activeFilters.find(f => f.key === "minRevenue");
                      const min = minFilter ? parseFloat(minFilter.value) : undefined;
                      handleAddRevenueFilter(min, max);
                    }
                  }}
                  defaultValue={activeFilters.find(f => f.key === "maxRevenue")?.value || ""}
                />
              </div>
            </div>
          </div>

          {/* Kâr Filtresi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kâr Aralığı (₺)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₺</span>
                </div>
                <input
                  type="number"
                  placeholder="Min Kâr"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  onBlur={(e) => {
                    if (e.target.value) {
                      const min = parseFloat(e.target.value);
                      const maxFilter = activeFilters.find(f => f.key === "maxProfit");
                      const max = maxFilter ? parseFloat(maxFilter.value) : undefined;
                      handleAddProfitFilter(min, max);
                    }
                  }}
                  defaultValue={activeFilters.find(f => f.key === "minProfit")?.value || ""}
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₺</span>
                </div>
                <input
                  type="number"
                  placeholder="Max Kâr"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  onBlur={(e) => {
                    if (e.target.value) {
                      const max = parseFloat(e.target.value);
                      const minFilter = activeFilters.find(f => f.key === "minProfit");
                      const min = minFilter ? parseFloat(minFilter.value) : undefined;
                      handleAddProfitFilter(min, max);
                    }
                  }}
                  defaultValue={activeFilters.find(f => f.key === "maxProfit")?.value || ""}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Kapat butonu */}
        <div className="pt-4 flex justify-end">
          <button
            onClick={() => setIsFilterPanelVisible(false)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Kapat
          </button>
        </div>
      </div>
    );
  };

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
    <div className="space-y-3">
      {/* Arama ve Filtre Paneli */}
      <div className="mb-4 relative">
        <FilterPanel
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          activeFilters={activeFilters}
          onFilterRemove={(key) => {
            // Kategori filtreleri için özel işlem yapma, çünkü render içinde bizim kendi 
            // butonlarımız olacak ve onlar handleRemoveFilter'ı çağıracak
            if (key === "category") return;
            handleRemoveFilter(key);
          }}
          onReset={handleResetFilters}
          mode="pos" // "basic" yerine "pos" kullanıyoruz, böylece dış kontrolü kullanır
          searchPlaceholder="Ürün adı veya kategoride ara..."
          filterPanelContent={renderFilterPanelContent()}
          inputRef={searchInputRef}
          isLoading={isLoading}
          toggleFilter={() => setIsFilterPanelVisible(!isFilterPanelVisible)}
          showFilter={isFilterPanelVisible}
          renderActiveFilters={() => (
            <>
              {/* Aktif filtreleri görüntüle */}
              {activeFilters.map((filter, index) => {
                const color = filter.color || "indigo";
                const bgColorClass = color === "blue" ? "bg-blue-50" : 
                                    color === "green" ? "bg-green-50" : 
                                    color === "emerald" ? "bg-emerald-50" : 
                                    color === "amber" ? "bg-amber-50" : 
                                    "bg-indigo-50";
                const textColorClass = color === "blue" ? "text-blue-700" : 
                                      color === "green" ? "text-green-700" : 
                                      color === "emerald" ? "text-emerald-700" : 
                                      color === "amber" ? "text-amber-700" : 
                                      "text-indigo-700";
                
                return (
                  <span
                    key={`${filter.key}-${index}`}
                    className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium ${bgColorClass} ${textColorClass}`}
                  >
                    {filter.icon || <Tag size={14} />}
                    {filter.label}: {filter.value}
                    <button
                      onClick={() => {
                        // Kategori filtresi için özel işlem
                        if (filter.key === "category") {
                          handleRemoveFilter("category", filter.value);
                        } 
                        // Diğer filtreler için normal işlem
                        else {
                          handleRemoveFilter(filter.key);
                        }
                      }}
                      className="text-gray-400 hover:text-gray-600 ml-1"
                    >
                      <XCircle size={14} />
                    </button>
                  </span>
                );
              })}
            </>
          )}
        />
      </div>

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
        <div className="px-6 py-3 border-b border-gray-100 flex justify-between items-center">
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

        <div className="px-6 py-3 border-t border-gray-100">
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
          <div className="px-6 py-3 border-b border-gray-100">
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
          <div className="px-6 py-3 border-b border-gray-100">
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