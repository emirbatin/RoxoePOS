import React, { useState, useEffect } from "react";
import { FileText, XCircle, RotateCcw } from "lucide-react";
import { Sale, SalesFilter, SalesSummary } from "../types/sales";
import { salesDB } from "../services/salesDB";
import ReasonModal from "../components/modals/ReasonModal";
import { useNavigate } from "react-router-dom";
import { VatRate } from "../types/product";
import { Table } from "../components/ui/Table";
import { Column } from "../types/table";
import { Pagination } from "../components/ui/Pagination";
import { useAlert } from "../components/AlertProvider";
import PageLayout from "../components/layout/PageLayout";
import SearchFilterPanel from "../components/SearchFilterPanel";

const SalesHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useAlert();

  // 1) Satış verileri ve filtreli liste
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  // 2) Filtre (opsiyonel alanlar)
  const [filter, setFilter] = useState<SalesFilter>({});
  // 3) Özet (istatistikler)
  const [summary, setSummary] = useState<SalesSummary>({
    totalSales: 0,
    subtotal: 0,
    vatAmount: 0,
    totalAmount: 0,
    cancelledCount: 0,
    refundedCount: 0,
    cashSales: 0,
    cardSales: 0,
    averageAmount: 0,
    vatBreakdown: [],
  });
  // 4) Arama ve diğer state’ler
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Sayfalama
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSales = filteredSales.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  // Kolonlar
  const columns: Column<Sale>[] = [
    {
      key: "receiptNo",
      title: "Fiş No",
      className: "whitespace-nowrap text-sm font-medium text-gray-900",
    },
    {
      key: "date",
      title: "Tarih",
      render: (sale) => (
        <span className="text-sm text-gray-500">
          {new Date(sale.date).toLocaleString("tr-TR")}
        </span>
      ),
    },
    {
      key: "total",
      title: "Tutar",
      render: (sale) => (
        <span className="text-sm text-gray-900">₺{sale.total.toFixed(2)}</span>
      ),
    },
    {
      key: "paymentMethod",
      title: "Ödeme",
      render: (sale) => (
        <div>
          {sale.paymentMethod === "mixed" ? (
            <span className="text-sm text-gray-500">Karışık (Split)</span>
          ) : (
            <span className="text-sm text-gray-500">
              {sale.paymentMethod === "veresiye" && "Veresiye"}
              {sale.paymentMethod === "kart" && "Kredi Kartı"}
              {sale.paymentMethod === "nakit" && "Nakit"}
              {sale.paymentMethod === "nakitpos" && "Nakit POS"}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      title: "Durum",
      render: (sale) => (
        <div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${sale.status === "completed" ? "bg-green-100 text-green-800" : ""}
              ${sale.status === "cancelled" ? "bg-red-100 text-red-800" : ""}
              ${sale.status === "refunded" ? "bg-orange-100 text-orange-800" : ""}`}
          >
            {sale.status === "completed" && "Tamamlandı"}
            {sale.status === "cancelled" && "İptal Edildi"}
            {sale.status === "refunded" && "İade Edildi"}
          </span>
          {(sale.cancelReason || sale.refundReason) && (
            <div className="text-xs text-gray-400 mt-1">
              {sale.cancelReason && `İptal sebebi: ${sale.cancelReason}`}
              {sale.refundReason && `İade sebebi: ${sale.refundReason}`}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      title: "İşlemler",
      className: "text-right",
      render: (sale) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/sales/${sale.id}`);
            }}
            className="text-blue-600 hover:text-blue-800"
            title="Detay"
          >
            <FileText size={18} />
          </button>
          {sale.status === "completed" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelSale(sale.id);
                }}
                className="text-red-600 hover:text-red-800"
                title="İptal Et"
              >
                <XCircle size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefundSale(sale.id);
                }}
                className="text-orange-600 hover:text-orange-800"
                title="İade Al"
              >
                <RotateCcw size={18} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // 1) Veri yükleme
  useEffect(() => {
    const loadSales = async () => {
      try {
        const allSales = await salesDB.getAllSales();
        setSales(allSales);
      } catch (error) {
        console.error("Satış verileri yüklenirken hata:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSales();

    // 30 sn'de bir yenilemek isterseniz
    const interval = setInterval(loadSales, 30000);
    return () => clearInterval(interval);
  }, []);

  // 2) Arama ve filtreleme
  useEffect(() => {
    let result = [...sales];

    // Arama
    if (searchTerm) {
      result = result.filter(
        (sale) =>
          sale.receiptNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sale.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Tarih aralığı
    if (filter.startDate) {
      // filter.startDate! => TypeScript'e "burada undefined değil" diyoruz
      result = result.filter((sale) => sale.date >= filter.startDate!);
    }
    if (filter.endDate) {
      result = result.filter((sale) => sale.date <= filter.endDate!);
    }

    // Durum
    if (filter.status) {
      result = result.filter((sale) => sale.status === filter.status);
    }

    // Min / Max Tutar
    if (filter.minAmount != null) {
      result = result.filter((sale) => sale.total >= filter.minAmount!);
    }
    if (filter.maxAmount != null) {
      result = result.filter((sale) => sale.total <= filter.maxAmount!);
    }

    // Ödeme Yöntemi
    if (filter.paymentMethod) {
      result = result.filter((sale) => sale.paymentMethod === filter.paymentMethod);
    }

    setFilteredSales(result);
    setCurrentPage(1);
  }, [sales, filter, searchTerm]);

  // 3) Özet hesaplamaları
  useEffect(() => {
    const newSummary: SalesSummary = {
      totalSales: filteredSales.length,
      subtotal: filteredSales.reduce(
        (sum, sale) =>
          sum +
          sale.items.reduce(
            (itemSum, item) => itemSum + item.salePrice * item.quantity,
            0
          ),
        0
      ),
      vatAmount: filteredSales.reduce(
        (sum, sale) =>
          sum +
          sale.items.reduce(
            (itemSum, item) =>
              itemSum + (item.priceWithVat - item.salePrice) * item.quantity,
            0
          ),
        0
      ),
      totalAmount: filteredSales.reduce((sum, sale) => sum + sale.total, 0),
      cancelledCount: filteredSales.filter((s) => s.status === "cancelled").length,
      refundedCount: filteredSales.filter((s) => s.status === "refunded").length,
      cashSales: filteredSales.filter((s) => s.paymentMethod === "nakit").length,
      cardSales: filteredSales.filter((s) => s.paymentMethod === "kart").length,
      averageAmount: filteredSales.length
        ? filteredSales.reduce((sum, s) => sum + s.total, 0) / filteredSales.length
        : 0,
      vatBreakdown: filteredSales.reduce((breakdown, sale) => {
        sale.items.forEach((item) => {
          const vatRate = item.vatRate as VatRate;
          const itemBaseAmount = item.salePrice * item.quantity;
          const itemVatAmount =
            (item.priceWithVat - item.salePrice) * item.quantity;

          const vatRateEntry = breakdown.find((entry) => entry.rate === vatRate);

          if (vatRateEntry) {
            vatRateEntry.baseAmount += itemBaseAmount;
            vatRateEntry.vatAmount += itemVatAmount;
            vatRateEntry.totalAmount += itemBaseAmount + itemVatAmount;
          } else {
            breakdown.push({
              rate: vatRate,
              baseAmount: itemBaseAmount,
              vatAmount: itemVatAmount,
              totalAmount: itemBaseAmount + itemVatAmount,
            });
          }
        });
        return breakdown;
      }, [] as {
        rate: VatRate;
        baseAmount: number;
        vatAmount: number;
        totalAmount: number;
      }[]),
    };
    setSummary(newSummary);
  }, [filteredSales]);

  // 4) Satış iptal/iade
  const handleCancelSale = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowCancelModal(true);
  };

  const handleRefundSale = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowRefundModal(true);
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!selectedSaleId) return;
    try {
      const updatedSale = await salesDB.cancelSale(selectedSaleId, reason);
      if (updatedSale) {
        setSales((prev) =>
          prev.map((sale) => (sale.id === selectedSaleId ? updatedSale : sale))
        );
        showSuccess("Satış başarıyla iptal edildi.");
      } else {
        showError("Satış iptal edilirken bir hata oluştu!");
      }
    } catch (error) {
      console.error("Satış iptali sırasında hata:", error);
      showError("Satış iptali sırasında bir hata oluştu!");
    } finally {
      setShowCancelModal(false);
      setSelectedSaleId(null);
    }
  };

  const handleRefundConfirm = async (reason: string) => {
    if (!selectedSaleId) return;
    try {
      const updatedSale = await salesDB.refundSale(selectedSaleId, reason);
      if (updatedSale) {
        setSales((prev) =>
          prev.map((sale) => (sale.id === selectedSaleId ? updatedSale : sale))
        );
        showSuccess("İade işlemi başarıyla tamamlandı.");
      } else {
        showError("İade işlemi sırasında bir hata oluştu!");
      }
    } catch (error) {
      console.error("İade işlemi sırasında hata:", error);
      showError("İade işlemi sırasında bir hata oluştu!");
    } finally {
      setShowRefundModal(false);
      setSelectedSaleId(null);
    }
  };

  // 5) Filtre reset
  const resetFilters = () => {
    setSearchTerm("");
    setFilter({});
    setShowFilter(false);
  };

  return (
    <PageLayout title="Satış Geçmişi">
      {/* Üst Kısım - Arama, Filtre Toggle ve Sıfırlama */}
      <SearchFilterPanel
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onReset={resetFilters}
        showFilter={showFilter}
        toggleFilter={() => setShowFilter((prev) => !prev)}
      />

      {/* Gelişmiş Filtre Alanı */}
      {showFilter && (
        <div className="p-4 border rounded-lg bg-white mb-6">
          <h3 className="font-medium mb-4">Filtreler</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Başlangıç Tarihi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                className="w-full p-2 border rounded-lg"
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    startDate: e.target.value ? new Date(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            {/* Bitiş Tarihi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                className="w-full p-2 border rounded-lg"
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    endDate: e.target.value ? new Date(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            {/* Durum */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum
              </label>
              <select
                className="w-full p-2 border rounded-lg"
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    status: (e.target.value || undefined) as
                      | "completed"
                      | "cancelled"
                      | "refunded"
                      | undefined,
                  }))
                }
              >
                <option value="">Tümü</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal Edildi</option>
                <option value="refunded">İade Edildi</option>
              </select>
            </div>
            {/* Min Tutar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Tutar
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-lg"
                placeholder="0.00"
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    minAmount: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
              />
            </div>
            {/* Max Tutar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maksimum Tutar
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-lg"
                placeholder="0.00"
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    maxAmount: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
              />
            </div>
            {/* Ödeme Yöntemi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ödeme Yöntemi
              </label>
              <select
                className="w-full p-2 border rounded-lg"
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    paymentMethod: (e.target.value || undefined) as
                      | "nakit"
                      | "kart"
                      | "veresiye"
                      | "nakitpos"
                      | "mixed"
                      | undefined,
                  }))
                }
              >
                <option value="">Tümü</option>
                <option value="nakit">Nakit</option>
                <option value="kart">Kredi Kartı</option>
                <option value="veresiye">Veresiye</option>
                <option value="nakitpos">POS (Nakit)</option>
                <option value="mixed">Karışık (Split)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Özet Kartı */}
      <div className="mb-6">
        <div className="bg-white p-4 border rounded-lg">
          <h3 className="font-medium mb-4">Satış Özeti</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Toplam Satış:</span>
              <span className="font-medium">{summary.totalSales}</span>
            </div>
            <div className="flex justify-between">
              <span>Toplam Tutar:</span>
              <span className="font-medium">
                ₺{summary.totalAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>İptal Edilen:</span>
              <span className="font-medium text-red-500">
                {summary.cancelledCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span>İade Edilen:</span>
              <span className="font-medium text-orange-500">
                {summary.refundedCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Nakit / Kart:</span>
              <span className="font-medium">
                {summary.cashSales} / {summary.cardSales}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ortalama Satış:</span>
              <span className="font-medium">
                ₺{summary.averageAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Satış Listesi */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <Table<Sale, string>
          data={currentSales}
          columns={columns}
          loading={isLoading}
          emptyMessage={
            searchTerm || Object.keys(filter).length > 0
              ? "Filtrelere uygun satış bulunamadı."
              : "Henüz satış kaydı bulunmuyor."
          }
          idField="id"
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="p-4 border-t"
        />
      </div>

      {/* İptal Modalı */}
      <ReasonModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setSelectedSaleId(null);
        }}
        onConfirm={handleCancelConfirm}
        title="Satış İptali"
        actionText="İptal Et"
        type="cancel"
      />

      {/* İade Modalı */}
      <ReasonModal
        isOpen={showRefundModal}
        onClose={() => {
          setShowRefundModal(false);
          setSelectedSaleId(null);
        }}
        onConfirm={handleRefundConfirm}
        title="Satış İadesi"
        actionText="İade Et"
        type="refund"
      />
    </PageLayout>
  );
};

export default SalesHistoryPage;