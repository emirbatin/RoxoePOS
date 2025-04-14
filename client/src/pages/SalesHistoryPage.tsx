import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  XCircle,
  RotateCcw,
  Calendar,
  CreditCard,
  DollarSign,
  Percent,
  Tag,
} from "lucide-react";
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
// Eski bileşeni kaldırıp, yeni birleştirilmiş bileşeni import ediyoruz
import FilterPanel from "../components/ui/FilterPanel";
import {
  cashRegisterService,
  CashTransactionType,
} from "../services/cashRegisterDB";
import { SalesHelper } from "../types/sales";

const SalesHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useAlert();
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  // 4) Arama ve diğer state'ler
  const [searchTerm, setSearchTerm] = useState("");
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
        <span className="text-sm text-gray-900">
          {sale.originalTotal ? (
            <div>
              <span className="line-through text-gray-400">
                ₺{sale.originalTotal.toFixed(2)}
              </span>
              <span className="ml-1 font-medium">₺{sale.total.toFixed(2)}</span>
              {sale.discount && (
                <div className="text-xs text-green-600 font-medium mt-1">
                  {sale.discount.type === "percentage"
                    ? `%${sale.discount.value} indirim`
                    : `₺${sale.discount.value.toFixed(2)} indirim`}
                </div>
              )}
            </div>
          ) : (
            <span>₺{sale.total.toFixed(2)}</span>
          )}
        </span>
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
              ${
                sale.status === "completed" ? "bg-green-100 text-green-800" : ""
              }
              ${sale.status === "cancelled" ? "bg-red-100 text-red-800" : ""}
              ${
                sale.status === "refunded"
                  ? "bg-orange-100 text-orange-800"
                  : ""
              }`}
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
        setIsLoading(true);
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
      result = result.filter(
        (sale) => new Date(sale.date) >= filter.startDate!
      );
    }
    if (filter.endDate) {
      result = result.filter((sale) => new Date(sale.date) <= filter.endDate!);
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
      result = result.filter(
        (sale) => sale.paymentMethod === filter.paymentMethod
      );
    }

    // İndirim filtresi
    if (filter.hasDiscount === true) {
      result = result.filter((sale) => !!sale.discount);
    }
    if (filter.hasDiscount === false) {
      result = result.filter((sale) => !sale.discount);
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
      // İndirimli tutarları topluyoruz (mevcut total değerleri)
      totalAmount: filteredSales.reduce((sum, sale) => sum + sale.total, 0),
      // Toplam indirim tutarı (tüm satışların indirim miktarı)
      totalDiscount: filteredSales.reduce(
        (sum, sale) => sum + SalesHelper.calculateDiscountAmount(sale),
        0
      ),
      // Orijinal toplam tutar (indirimsiz)
      originalAmount: filteredSales.reduce(
        (sum, sale) => sum + (sale.originalTotal || sale.total),
        0
      ),
      // İndirimli satış sayısı
      discountedSalesCount: filteredSales.filter((s) => s.discount).length,
      cancelledCount: filteredSales.filter((s) => s.status === "cancelled")
        .length,
      refundedCount: filteredSales.filter((s) => s.status === "refunded")
        .length,
      cashSales: filteredSales.filter((s) => s.paymentMethod === "nakit")
        .length,
      cardSales: filteredSales.filter((s) => s.paymentMethod === "kart").length,
      averageAmount: filteredSales.length
        ? filteredSales.reduce((sum, s) => sum + s.total, 0) /
          filteredSales.length
        : 0,
      vatBreakdown: filteredSales.reduce(
        (breakdown, sale) => {
          sale.items.forEach((item) => {
            const vatRate = item.vatRate as VatRate;
            const itemBaseAmount = item.salePrice * item.quantity;
            const itemVatAmount =
              (item.priceWithVat - item.salePrice) * item.quantity;

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
        },
        [] as {
          rate: VatRate;
          baseAmount: number;
          vatAmount: number;
          totalAmount: number;
        }[]
      ),
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
      // Önce satış bilgilerini alalım - fiyat bilgilerine ihtiyaç var
      const saleToCancel = await salesDB.getSaleById(selectedSaleId);
      if (!saleToCancel) {
        showError("İptal edilecek satış bulunamadı!");
        return;
      }

      const updatedSale = await salesDB.cancelSale(selectedSaleId, reason);
      if (updatedSale) {
        setSales((prev) =>
          prev.map((sale) => (sale.id === selectedSaleId ? updatedSale : sale))
        );

        // YENİ: Kasa entegrasyonu - Nakit satışsa kasadan çıkış yap
        try {
          // Aktif kasa dönemi kontrolü
          const activeSession = await cashRegisterService.getActiveSession();
          if (activeSession) {
            if (
              saleToCancel.paymentMethod === "nakit" ||
              saleToCancel.paymentMethod === "nakitpos"
            ) {
              // Nakit satış iptali - kasadan para çıkışı
              await cashRegisterService.addCashTransaction(
                activeSession.id,
                CashTransactionType.WITHDRAWAL, // "ÇIKIŞ" değerini enum üzerinden kullanıyoruz
                saleToCancel.total,
                `Satış İptali - Fiş No: ${saleToCancel.receiptNo}`
              );
            }
            // Diğer ödeme tipleri kasada nakit hareketi yapmaz
          } else {
            console.warn(
              "Satış iptal edildi ancak açık kasa dönemi bulunamadı. Kasa kayıtları güncellenmedi."
            );
          }
        } catch (cashError) {
          console.error("Kasa kaydı güncellenirken hata:", cashError);
          // Ana iptal işlemi tamamlandı, kasa hatası gösterilmeyebilir
        }

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
      // Önce satış bilgilerini alalım - fiyat bilgilerine ihtiyaç var
      const saleToRefund = await salesDB.getSaleById(selectedSaleId);
      if (!saleToRefund) {
        showError("İade edilecek satış bulunamadı!");
        return;
      }

      const updatedSale = await salesDB.refundSale(selectedSaleId, reason);
      if (updatedSale) {
        setSales((prev) =>
          prev.map((sale) => (sale.id === selectedSaleId ? updatedSale : sale))
        );

        // YENİ: Kasa entegrasyonu - Nakit satışsa kasadan çıkış yap
        try {
          // Aktif kasa dönemi kontrolü
          const activeSession = await cashRegisterService.getActiveSession();
          if (activeSession) {
            if (
              saleToRefund.paymentMethod === "nakit" ||
              saleToRefund.paymentMethod === "nakitpos"
            ) {
              // Nakit satış iadesi - kasadan para çıkışı
              await cashRegisterService.addCashTransaction(
                activeSession.id,
                CashTransactionType.WITHDRAWAL, // "ÇIKIŞ" değerini enum üzerinden kullanıyoruz
                saleToRefund.total,
                `Satış İadesi - Fiş No: ${saleToRefund.receiptNo}`
              );
            }
            // Diğer ödeme tipleri kasada nakit hareketi yapmaz
          } else {
            console.warn(
              "Satış iade edildi ancak açık kasa dönemi bulunamadı. Kasa kayıtları güncellenmedi."
            );
          }
        } catch (cashError) {
          console.error("Kasa kaydı güncellenirken hata:", cashError);
          // Ana iade işlemi tamamlandı, kasa hatası gösterilmeyebilir
        }

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

  // Veriyi yeniden yükleme
  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      const allSales = await salesDB.getAllSales();
      setSales(allSales);
      showSuccess("Veriler yenilendi");
    } catch (error) {
      console.error("Satış verileri yüklenirken hata:", error);
      showError("Veriler yenilenirken bir hata oluştu!");
    } finally {
      setIsLoading(false);
    }
  };

  // 5) Filtre reset
  const resetFilters = () => {
    setSearchTerm("");
    setFilter({});
  };

  // Tarih yardımcı fonksiyonları
  const startOfDay = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  };

  const endOfDay = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
  };

  return (
    <PageLayout>
      {/* Birleştirilmiş FilterPanel'i kullanıyoruz */}
      <div className="bg-white rounded-lg shadow-sm p-3">
        <FilterPanel
          mode="sales"
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          filter={filter}
          onFilterChange={setFilter}
          onReset={resetFilters}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          inputRef={searchInputRef}
          searchPlaceholder="Fiş numarası veya ID ara..."
          startOfDay={startOfDay}
          endOfDay={endOfDay}
        />
      </div>

      {/* Satış Özeti */}
      <div className="my-3">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Satış Özeti</h3>
            {filteredSales.length > 0 && (
              <div className="text-sm text-gray-600">
                Gösterilen: {indexOfFirstItem + 1} -{" "}
                {Math.min(indexOfLastItem, filteredSales.length)} / Toplam:{" "}
                {filteredSales.length} satış
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Temel Metrikler */}
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-xs font-medium text-indigo-700 mb-1">
                Toplam Satış
              </div>
              <div className="text-2xl font-semibold text-indigo-900">
                {summary.totalSales}
              </div>
              <div className="mt-2 text-xs text-indigo-700">
                <span className="font-medium">Tamamlanan: </span>
                {summary.totalSales -
                  summary.cancelledCount -
                  summary.refundedCount}
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-xs font-medium text-green-700 mb-1">
                Toplam Tutar
              </div>
              <div className="text-2xl font-semibold text-green-900">
                ₺{summary.totalAmount.toFixed(2)}
              </div>
              <div className="mt-2 text-xs text-green-700">
                <span className="font-medium">Ortalama Satış: </span>₺
                {summary.averageAmount.toFixed(2)}
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-xs font-medium text-orange-700 mb-1">
                Ödeme Dağılımı
              </div>
              <div className="text-2xl font-semibold text-orange-900">
                {summary.cashSales} / {summary.cardSales}
              </div>
              <div className="mt-2 text-xs text-orange-700">
                <span className="font-medium">Nakit / Kart</span>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-xs font-medium text-red-700 mb-1">
                İptal/İade
              </div>
              <div className="text-2xl font-semibold text-red-900">
                {summary.cancelledCount + summary.refundedCount}
              </div>
              <div className="mt-2 text-xs text-red-700">
                <span className="font-medium">İptal: </span>
                {summary.cancelledCount}
                <span className="font-medium ml-2">İade: </span>
                {summary.refundedCount}
              </div>
            </div>
          </div>

          {/* İndirim Bilgileri (varsa) */}
          {(summary.totalDiscount || 0) > 0 && (
            <div className="mt-6 p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <div className="text-sm font-medium text-green-800">
                    İndirim Bilgileri
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    Toplam {summary.discountedSalesCount} adet indirimli satış
                  </div>
                </div>
                <div className="flex mt-2 sm:mt-0 gap-4">
                  <div>
                    <div className="text-xs text-green-700">
                      İndirimsiz Tutar
                    </div>
                    <div className="text-base font-semibold text-green-900">
                      ₺{(summary.originalAmount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-green-700">İndirim Tutarı</div>
                    <div className="text-base font-semibold text-green-900">
                      ₺{(summary.totalDiscount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-green-700">İndirim Oranı</div>
                    <div className="text-base font-semibold text-green-900">
                      %
                      {(
                        ((summary.totalDiscount || 0) /
                          (summary.originalAmount || 1)) *
                        100
                      ).toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Satış Listesi - Güncellenmiş Excel Benzeri Tablo */}
      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
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
          enableSorting={true}
          defaultSortKey="date"
          defaultSortDirection="desc"
          className="border-none rounded-none"
          showTotals={true}
          totalColumns={{ total: "sum" }}
          totalData={filteredSales}
          onRowClick={(sale) => navigate(`/sales/${sale.id}`)}
        />

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="p-4 border-t"
          />
        )}
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
