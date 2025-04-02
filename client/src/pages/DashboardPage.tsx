import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar, ChevronDown, Download, RefreshCw } from "lucide-react";

// Dashboard Bileşenleri
import OverviewTab from "../components/dashboard/OverviewTab";
import CashTab from "../components/dashboard/CashTab";
import SalesTab from "../components/dashboard/SalesTab";
import ProductsTab from "../components/dashboard/ProductsTab";

// Hooks ve Servisler
import { useSales } from "../hooks/useSales";
import { calculateStatsForDashboard } from "../utils/dashboardStats";
import {
  cashRegisterService,
  CashRegisterSession,
  CashRegisterStatus,
} from "../services/cashRegisterDB";
import { exportService } from "../services/exportSevices";
import ExportButton from "../components/ExportButton";
import { CashTransaction } from "../types/cashRegister";

// Dashboard sekme tipleri
type DashboardTabKey = "overview" | "cash" | "sales" | "products";

// Hook: Kasa verilerini ve kapanmış oturumları getirir
function useCashDataWithClosedSessions(startDate: Date, endDate: Date) {
  const [loading, setLoading] = useState<boolean>(true);

  // Kasa verileri
  const [cashData, setCashData] = useState({
    currentBalance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    veresiyeCollections: 0,
    isActive: false,
    openingBalance: 0,
    cashSalesTotal: 0,
    cardSalesTotal: 0,
    dailyData: [] as {
      date: string;
      deposits: number;
      withdrawals: number;
      veresiye: number;
      total: number;
    }[],
  });

  // Kapanmış oturumlar
  const [closedSessions, setClosedSessions] = useState<CashRegisterSession[]>(
    []
  );

  // En son kapatılan oturum
  const [lastClosedSession, setLastClosedSession] =
    useState<CashRegisterSession | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);

      try {
        // Veri yükleme işlemleri (değişmedi)
        const all = await cashRegisterService.getAllSessions();

        const sessionsInRange = all.filter((s) => {
          const d = new Date(s.openingDate);
          return d >= startDate && d <= endDate;
        });

        const activeSession = await cashRegisterService.getActiveSession();

        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let veresiyeCollections = 0;
        let totalCashSales = 0;
        let totalCardSales = 0;
        let totalOpeningBalance = 0;

        const dailyTransactions: {
          [key: string]: {
            date: string;
            deposits: number;
            withdrawals: number;
            veresiye: number;
            total: number;
          };
        } = {};

        // Oturumları işleme (değişmedi)
        for (const sess of sessionsInRange) {
          const details = await cashRegisterService.getSessionDetails(sess.id);

          if (sess.status === CashRegisterStatus.OPEN) {
            totalOpeningBalance += sess.openingBalance;
            totalCashSales += sess.cashSalesTotal || 0;
            totalCardSales += sess.cardSalesTotal || 0;

            if (details.transactions) {
              for (const tx of details.transactions) {
                const dt = new Date(tx.date);
                const dateStr = dt.toISOString().split("T")[0];

                if (!dailyTransactions[dateStr]) {
                  dailyTransactions[dateStr] = {
                    date: dateStr,
                    deposits: 0,
                    withdrawals: 0,
                    veresiye: 0,
                    total: 0,
                  };
                }

                if (tx.type === "GİRİŞ") {
                  totalDeposits += tx.amount;
                  dailyTransactions[dateStr].deposits += tx.amount;
                  dailyTransactions[dateStr].total += tx.amount;
                } else if (tx.type === "ÇIKIŞ") {
                  totalWithdrawals += tx.amount;
                  dailyTransactions[dateStr].withdrawals += tx.amount;
                  dailyTransactions[dateStr].total -= tx.amount;
                } else if (tx.type === "VERESIYE_TAHSILAT") {
                  totalDeposits += tx.amount;
                  veresiyeCollections += tx.amount;
                  dailyTransactions[dateStr].veresiye += tx.amount;
                  dailyTransactions[dateStr].deposits += tx.amount;
                  dailyTransactions[dateStr].total += tx.amount;
                }
              }
            }
          }
        }

        // Kapalı oturumları ayarla
        const closed = sessionsInRange
          .filter((s) => s.status === CashRegisterStatus.CLOSED)
          .sort((a, b) => {
            return (
              new Date(b.closingDate || b.openingDate).getTime() -
              new Date(a.closingDate || a.openingDate).getTime()
            );
          });

        setClosedSessions(closed);

        if (closed.length > 0) {
          setLastClosedSession(closed[0]);
        } else {
          setLastClosedSession(null);
        }

        // Aktif oturum bakiyesini hesapla
        let currBalance = 0;
        let isActive = false;

        if (activeSession) {
          isActive = true;
          currBalance =
            activeSession.openingBalance +
            (activeSession.cashSalesTotal || 0) +
            (activeSession.cashDepositTotal || 0) -
            (activeSession.cashWithdrawalTotal || 0);
        }

        // Kasa verilerini güncelle
        setCashData({
          currentBalance: currBalance,
          totalDeposits,
          totalWithdrawals,
          veresiyeCollections,
          isActive,
          openingBalance: totalOpeningBalance,
          cashSalesTotal: totalCashSales,
          cardSalesTotal: totalCardSales,
          dailyData: Object.values(
            dailyTransactions as {
              [key: string]: {
                date: string;
                deposits: number;
                withdrawals: number;
                veresiye: number;
                total: number;
              };
            }
          ).sort((a, b) => a.date.localeCompare(b.date)),
        });
      } catch (err) {
        console.error("Kasa verileri yüklenirken hata:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [startDate, endDate]);

  return { cashData, closedSessions, lastClosedSession, loading };
}

const DashboardPage: React.FC = () => {
  // URL parametrelerini al
  const { tabKey = "overview" } = useParams<{ tabKey?: DashboardTabKey }>();
  const navigate = useNavigate();

  // Tarih filtresi state'leri
  const [period, setPeriod] = useState<
    "day" | "week" | "month" | "year" | "custom"
  >("day");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Satış verileri
  const { sales, loading: salesLoading } = useSales(30000);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Sıralama state'i
  const [cashSortConfig, setCashSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "openingDate",
    direction: "desc",
  });

  // Seçili tarih aralığındaki satışlar
  const filteredSales = useMemo(() => {
    const s = startDate.getTime();
    const e = endDate.getTime();
    return sales.filter((sale) => {
      const t = new Date(sale.date).getTime();
      return t >= s && t <= e;
    });
  }, [sales, startDate, endDate]);

  // Kasa verileri
  const {
    cashData,
    closedSessions,
    lastClosedSession,
    loading: cashLoading,
  } = useCashDataWithClosedSessions(startDate, endDate);

  // Kapanmış oturumları sıralayan useMemo
  const sortedClosedSessions = useMemo(() => {
    let sessions = [...closedSessions];
    if (cashSortConfig) {
      sessions.sort((a, b) => {
        const key = cashSortConfig.key;
        let aVal, bVal;
        if (key === "totalSales") {
          aVal = (a.cashSalesTotal || 0) + (a.cardSalesTotal || 0);
          bVal = (b.cashSalesTotal || 0) + (b.cardSalesTotal || 0);
        } else {
          aVal = a[key as keyof CashRegisterSession];
          bVal = b[key as keyof CashRegisterSession];
          if (key === "openingDate" || key === "closingDate") {
            aVal = new Date(aVal || 0);
            bVal = new Date(bVal || 0);
          }
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
          return cashSortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }
        if (aVal instanceof Date && bVal instanceof Date) {
          return cashSortConfig.direction === "asc"
            ? aVal.getTime() - bVal.getTime()
            : bVal.getTime() - aVal.getTime();
        }
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        if (aVal < bVal) return cashSortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return cashSortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sessions;
  }, [closedSessions, cashSortConfig]);

  // Sütun başlığına tıklanınca sıralama yönünü değiştiren fonksiyon
  const handleCashSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (cashSortConfig.key === key && cashSortConfig.direction === "asc") {
      direction = "desc";
    }
    setCashSortConfig({ key, direction });
  };

  // Dashboard istatistikleri
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
    return calculateStatsForDashboard(filteredSales, period === "day");
  }, [filteredSales, period]);

  // Yükleniyor durumu
  const isLoading = salesLoading || cashLoading;

  // Veriyi yenile
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Dışa aktarma fonksiyonu
  // DashboardPage.tsx dosyasında yaklaşık olarak satır 473 civarında
// handleExport fonksiyonunu şu şekilde güncelleyin:

async function handleExport(fileType: "excel" | "pdf", reportType: "sale" | "product" | "cash") {
  setShowExportMenu(false);
  const dateRangeString = exportService.formatDateRange(startDate, endDate);
  try {
    if (fileType === "excel") {
      if (reportType === "cash") {
        // İşlem geçmişini yükle - tip tanımlamaları eklendi
        let allTransactions: CashTransaction[] = [];
        let veresiyeTx: CashTransaction[] = [];
        
        // Aktif oturum varsa verileri al
        const activeSession = await cashRegisterService.getActiveSession();
        if (activeSession) {
          const sessionDetails = await cashRegisterService.getSessionDetails(activeSession.id);
          allTransactions = sessionDetails.transactions || [];
          veresiyeTx = allTransactions.filter(t => 
            t.description?.toLowerCase().includes('veresiye') || 
            t.description?.toLowerCase().includes('tahsilat')
          );
        }
        
        console.log("Veri hazırlama başlıyor - Transactions sayısı:", allTransactions.length);

        const cashExportData = {
          summary: {
            openingBalance: cashData.openingBalance,
            currentBalance: cashData.currentBalance,
            totalDeposits: cashData.totalDeposits,
            totalWithdrawals: cashData.totalWithdrawals,
            veresiyeCollections: cashData.veresiyeCollections,
            cashSalesTotal: cashData.cashSalesTotal,
            cardSalesTotal: cashData.cardSalesTotal,
          },
          dailyData: cashData.dailyData || [],
          closedSessions,
          transactions: allTransactions, // DÜZELTME: Aktif oturumun işlemleri
          salesData: filteredSales.filter(s => s.status === 'completed'),
          veresiyeTransactions: veresiyeTx, // DÜZELTME: Veresiye işlemleri
          productSummary: productStats.map(product => ({
            productName: product.name,
            category: product.category || 'Kategori Yok',
            totalSales: product.quantity,
            totalRevenue: product.revenue,
            totalProfit: product.profit,
            profitMargin: product.profitMargin || 0 
          }))
        };
        
        console.log("Kasa Export Verileri:", {
          "dailyData sayısı": cashExportData.dailyData.length,
          "transactions sayısı": cashExportData.transactions.length,
          "veresiye sayısı": cashExportData.veresiyeTransactions.length, 
          "satış sayısı": cashExportData.salesData.length
        });
        
        await exportService.exportCashDataToExcel(
          cashExportData,
          `Kasa Raporu ${dateRangeString}`
        );
      } else {
        // Diğer raporlar aynı kalabilir
        await exportService.exportToExcel(
          filteredSales,
          dateRangeString,
          reportType
        );
      }
    } else {
      // PDF raporları aynı kalabilir
      if (reportType === "cash") {
        alert("Kasa raporu PDF olarak henüz desteklenmiyor!");
      } else {
        await exportService.exportToPDF(
          filteredSales,
          dateRangeString,
          reportType
        );
      }
    }
  } catch (err) {
    console.error("Dışa aktarım hatası:", err);
    alert("Dışa aktarım sırasında bir hata oluştu!");
  }
}

  // Period değişince tarih aralığını güncelle
  useEffect(() => {
    const [start, end] = exportService.getDateRange(period);
    setStartDate(start);
    setEndDate(end);
  }, [period]);

  // Tarih formatını güzelleştiren yardımcı fonksiyon
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "-";
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return new Date(date).toLocaleDateString("tr-TR", options);
  };

  // Tarih filtreleme bileşeni
  const renderDateFilter = () => (
    <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Sol Taraf - Hızlı Filtreler */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-50 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => {
                setPeriod("day");
                setShowDatePicker(false);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === "day"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
              }`}
            >
              Bugün
            </button>
            <button
              onClick={() => {
                setPeriod("week");
                setShowDatePicker(false);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === "week"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
              }`}
            >
              Bu Hafta
            </button>
            <button
              onClick={() => {
                setPeriod("month");
                setShowDatePicker(false);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === "month"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
              }`}
            >
              Bu Ay
            </button>
            <button
              onClick={() => {
                setPeriod("year");
                setShowDatePicker(false);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === "year"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
              }`}
            >
              Bu Yıl
            </button>
          </div>
        </div>

        {/* Sağ Taraf - Butonlar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Özel Tarih Seçici */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 py-2 px-3 rounded-md border transition-all ${
                showDatePicker || period === "custom"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/50"
              }`}
            >
              <Calendar
                size={16}
                className={
                  period === "custom" ? "text-indigo-600" : "text-gray-500"
                }
              />
              <span className="font-medium text-sm">
                {formatDate(startDate)} - {formatDate(endDate)}
              </span>
              <ChevronDown
                size={14}
                className={
                  period === "custom" ? "text-indigo-600" : "text-gray-400"
                }
              />
            </button>

            {/* Tarih Seçici Popup */}
            {showDatePicker && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl z-20 border border-gray-100 animate-in fade-in slide-in-from-top-5 duration-200">
                <div className="p-4 w-80">
                  <div className="text-sm font-semibold text-gray-800 mb-3">
                    Özel Tarih Aralığı
                  </div>

                  {/* Başlangıç Tarihi */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Başlangıç Tarihi
                    </label>
                    <input
                      type="date"
                      value={startDate.toISOString().split("T")[0]}
                      onChange={(e) => {
                        if (e.target.value) {
                          setStartDate(new Date(e.target.value));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Bitiş Tarihi */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bitiş Tarihi
                    </label>
                    <input
                      type="date"
                      value={endDate.toISOString().split("T")[0]}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEndDate(new Date(e.target.value));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      min={startDate.toISOString().split("T")[0]}
                    />
                  </div>

                  <button
                    onClick={() => {
                      setPeriod("custom");
                      setShowDatePicker(false);
                    }}
                    className="w-full py-2 mt-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
                  >
                    Tarihleri Uygula
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* YENİ: ExportButton Bileşeni - Dışa Aktarma Butonu yerine */}
          <ExportButton
            currentTab={tabKey as "overview" | "cash" | "sales" | "products"}
            startDate={startDate}
            endDate={endDate}
            isLoading={isLoading}
            sales={filteredSales}
            cashData={cashData}
            productStats={productStats}
            closedSessions={closedSessions}
            transactions={[]} 
          />

          {/* Yenileme Butonu */}
          <button
            onClick={handleRefresh}
            className={`flex items-center gap-2 py-2 px-3 rounded-md border border-gray-200 bg-white hover:border-indigo-300 transition-all ${
              isLoading ? "cursor-not-allowed opacity-75" : ""
            }`}
            disabled={isLoading}
          >
            <RefreshCw
              size={16}
              className={`text-gray-500 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="text-gray-700 font-medium text-sm">
              {isLoading ? "Yükleniyor" : "Yenile"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  // Seçili sekmeye göre içerik gösterme
  const renderTabContent = () => {
    switch (tabKey) {
      case "overview":
        return (
          <OverviewTab
            totalSales={totalSales}
            totalRevenue={totalRevenue}
            netProfit={netProfit}
            profitMargin={profitMargin}
            dailySalesData={dailySalesData}
            categoryData={categoryData}
            productStats={productStats}
            lastClosedSession={lastClosedSession}
            isLoading={isLoading}
            formatDate={formatDate}
            setCurrentTab={(tab) => navigate(`/dashboard/${tab}`)}
            period={period}
          />
        );
      case "cash":
        return (
          <CashTab
            cashData={cashData}
            closedSessions={closedSessions}
            lastClosedSession={lastClosedSession}
            sortedClosedSessions={sortedClosedSessions}
            isLoading={isLoading}
            formatDate={formatDate}
            handleCashSort={handleCashSort}
            cashSortConfig={cashSortConfig}
          />
        );
      case "sales":
        return (
          <SalesTab
            totalSales={totalSales}
            totalRevenue={totalRevenue}
            netProfit={netProfit}
            profitMargin={profitMargin}
            averageBasket={averageBasket}
            cancelRate={cancelRate}
            refundRate={refundRate}
            dailySalesData={dailySalesData}
            categoryData={categoryData}
            period={period}
          />
        );
      case "products":
        return (
          <ProductsTab
            productStats={productStats}
            isLoading={isLoading}
            handleExport={handleExport}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500">
            <div className="text-lg font-medium">Sekme bulunamadı</div>
            <p className="mt-2">Lütfen geçerli bir sekme seçin</p>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-container">
      {/* Tarih Filtreleme */}
      {renderDateFilter()}

      {/* Seçilen Sekmenin İçeriği */}
      <div className="transition-all duration-300 ease-in-out">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default DashboardPage;
