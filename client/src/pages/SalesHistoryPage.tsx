import React, { useState, useEffect } from "react";
import {
  Calendar,
  Search,
  Filter,
  RefreshCw,
  FileText,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Sale, SalesFilter, SalesSummary } from "../types/sales";
import { salesService } from "../services/salesService";
import ReasonModal from "../components/ReasonModal";
import { useNavigate } from "react-router-dom";
import { VatRate } from "../types/pos";

const SalesHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [filter, setFilter] = useState<SalesFilter>({});
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
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  useEffect(() => {
    const loadSales = () => {
      try {
        const allSales = salesService.getAllSales();
        setSales(allSales);
        setIsLoading(false);
      } catch (error) {
        console.error("Satış verileri yüklenirken hata:", error);
        setIsLoading(false);
      }
    };

    loadSales();
    const interval = setInterval(loadSales, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let result = [...sales];

    if (searchTerm) {
      result = result.filter(
        (sale) =>
          sale.receiptNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sale.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filter.startDate) {
      result = result.filter((sale) => sale.date >= filter.startDate!);
    }
    if (filter.endDate) {
      result = result.filter((sale) => sale.date <= filter.endDate!);
    }

    if (filter.status) {
      result = result.filter((sale) => sale.status === filter.status);
    }

    if (filter.minAmount) {
      result = result.filter((sale) => sale.total >= filter.minAmount!);
    }
    if (filter.maxAmount) {
      result = result.filter((sale) => sale.total <= filter.maxAmount!);
    }

    if (filter.paymentMethod) {
      result = result.filter(
        (sale) => sale.paymentMethod === filter.paymentMethod
      );
    }

    setFilteredSales(result);
  }, [sales, filter, searchTerm]);

  useEffect(() => {
    const newSummary: SalesSummary = {
      totalSales: filteredSales.length,
      subtotal: filteredSales.reduce(
        (sum, sale) =>
          sum +
          sale.items.reduce(
            (itemSum, item) => itemSum + item.price * item.quantity,
            0
          ),
        0
      ),
      vatAmount: filteredSales.reduce(
        (sum, sale) =>
          sum +
          sale.items.reduce(
            (itemSum, item) =>
              itemSum + item.price * item.quantity * (item.vatRate / 100),
            0
          ),
        0
      ),
      totalAmount: filteredSales.reduce((sum, sale) => sum + sale.total, 0),
      cancelledCount: filteredSales.filter(
        (sale) => sale.status === "cancelled"
      ).length,
      refundedCount: filteredSales.filter((sale) => sale.status === "refunded")
        .length,
      cashSales: filteredSales.filter((sale) => sale.paymentMethod === "nakit")
        .length,
      cardSales: filteredSales.filter((sale) => sale.paymentMethod === "kart")
        .length,
      averageAmount: filteredSales.length
        ? filteredSales.reduce((sum, sale) => sum + sale.total, 0) /
          filteredSales.length
        : 0,
      vatBreakdown: filteredSales.reduce((breakdown, sale) => {
        sale.items.forEach((item) => {
          const vatRate = item.vatRate as VatRate;
          const itemBaseAmount = item.price * item.quantity;
          const itemVatAmount = itemBaseAmount * (vatRate / 100);

          const vatRateEntry = breakdown.find(
            (entry) => entry.rate === vatRate
          );

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
      }, [] as { rate: VatRate; baseAmount: number; vatAmount: number; totalAmount: number }[]),
    };

    setSummary(newSummary);
  }, [filteredSales]);

  const handleCancelSale = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowCancelModal(true);
  };

  const handleRefundSale = (saleId: string) => {
    setSelectedSaleId(saleId);
    setShowRefundModal(true);
  };

  const handleCancelConfirm = (reason: string) => {
    if (selectedSaleId) {
      const updatedSale = salesService.cancelSale(selectedSaleId, reason);
      if (updatedSale) {
        setSales((prevSales) =>
          prevSales.map((sale) =>
            sale.id === selectedSaleId ? updatedSale : sale
          )
        );
        alert("Satış başarıyla iptal edildi.");
      } else {
        alert("Satış iptal edilirken bir hata oluştu!");
      }
    }
    setShowCancelModal(false);
    setSelectedSaleId(null);
  };

  const handleRefundConfirm = (reason: string) => {
    if (selectedSaleId) {
      const updatedSale = salesService.refundSale(selectedSaleId, reason);
      if (updatedSale) {
        setSales((prevSales) =>
          prevSales.map((sale) =>
            sale.id === selectedSaleId ? updatedSale : sale
          )
        );
        alert("İade işlemi başarıyla tamamlandı.");
      } else {
        alert("İade işlemi sırasında bir hata oluştu!");
      }
    }
    setShowRefundModal(false);
    setSelectedSaleId(null);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilter({});
    setShowFilter(false);
  };

  return (
    <div className="p-6">
      {/* Üst Kısım - Filtreler ve Özet */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Arama ve Filtre */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Fiş no veya satış ID ara..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                className="absolute left-3 top-2.5 text-gray-400"
                size={20}
              />
            </div>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`p-2 border rounded-lg hover:bg-gray-50 ${
                showFilter ? "bg-primary-50 border-primary-500" : ""
              }`}
              title="Filtreleri Göster/Gizle"
            >
              <Filter size={20} className="text-gray-600" />
            </button>
            <button
              onClick={resetFilters}
              className="p-2 border rounded-lg hover:bg-gray-50"
              title="Filtreleri Sıfırla"
            >
              <RefreshCw size={20} className="text-gray-600" />
            </button>
          </div>

          {showFilter && (
            <div className="p-4 border rounded-lg bg-white">
              <h3 className="font-medium mb-4">Filtreler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        startDate: e.target.value
                          ? new Date(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </div>
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
                        endDate: e.target.value
                          ? new Date(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durum
                  </label>
                  <select
                    className="w-full p-2 border rounded-lg"
                    onChange={(e) =>
                      setFilter((prev) => ({
                        ...prev,
                        status: e.target.value as Sale["status"] | undefined,
                      }))
                    }
                    value={filter.status || ""}
                  >
                    <option value="">Tümü</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="cancelled">İptal Edildi</option>
                    <option value="refunded">İade Edildi</option>
                  </select>
                </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ödeme Yöntemi
                  </label>
                  <select
                    className="w-full p-2 border rounded-lg"
                    onChange={(e) =>
                      setFilter((prev) => ({
                        ...prev,
                        paymentMethod: e.target.value as
                          | "nakit"
                          | "kart"
                          | undefined,
                      }))
                    }
                    value={filter.paymentMethod || ""}
                  >
                    <option value="">Tümü</option>
                    <option value="nakit">Nakit</option>
                    <option value="kart">Kredi Kartı</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Özet Kartı */}
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
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm || Object.keys(filter).length > 0
                ? "Filtrelere uygun satış bulunamadı."
                : "Henüz satış kaydı bulunmuyor."}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fiş No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tarih
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tutar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ödeme
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Durum
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {sale.receiptNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sale.date.toLocaleString("tr-TR")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₺{sale.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sale.paymentMethod === "nakit" ? "💵 Nakit" : "💳 Kart"}
                      {sale.paymentMethod === "nakit" && sale.cashReceived && (
                        <div className="text-xs text-gray-400">
                          Alınan: ₺{sale.cashReceived.toFixed(2)}
                          <br />
                          Para üstü: ₺{sale.changeAmount?.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${
                          sale.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : ""
                        }
                        ${
                          sale.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : ""
                        }
                        ${
                          sale.status === "refunded"
                            ? "bg-orange-100 text-orange-800"
                            : ""
                        }
                      `}
                      >
                        {sale.status === "completed" && "Tamamlandı"}
                        {sale.status === "cancelled" && "İptal Edildi"}
                        {sale.status === "refunded" && "İade Edildi"}
                      </span>
                      {(sale.cancelReason || sale.refundReason) && (
                        <div className="text-xs text-gray-400 mt-1">
                          {sale.cancelReason &&
                            `İptal sebebi: ${sale.cancelReason}`}
                          {sale.refundReason &&
                            `İade sebebi: ${sale.refundReason}`}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => navigate(`/sales/${sale.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Detay"
                      >
                        <FileText size={18} />
                      </button>
                      {sale.status === "completed" && (
                        <>
                          <button
                            onClick={() => handleCancelSale(sale.id)}
                            className="text-red-600 hover:text-red-800"
                            title="İptal Et"
                          >
                            <XCircle size={18} />
                          </button>
                          <button
                            onClick={() => handleRefundSale(sale.id)}
                            className="text-orange-600 hover:text-orange-800"
                            title="İade Al"
                          >
                            <RotateCcw size={18} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
    </div>
  );
};

export default SalesHistoryPage;
