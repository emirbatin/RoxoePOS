import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Dashboard Bileşenleri
import OverviewTab from "../components/dashboard/OverviewTab";
import CashTab from "../components/dashboard/CashTab";
import SalesTab from "../components/dashboard/SalesTab";
import ProductsTab from "../components/dashboard/ProductsTab";
import DateFilter from "../components/ui/DatePicker"; // Yeni DateFilter bileşeni

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
function useCashDataWithClosedSessions(
  startDate: Date,
  endDate: Date,
  period: "day" | "week" | "month" | "year" | "custom"
) {
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
        // Tüm oturumları getir
        const all = await cashRegisterService.getAllSessions();

        // Seçilen tarih aralığındaki oturumları filtrele
        const sessionsInRange = all.filter((s) => {
          const sessionDate = new Date(s.openingDate);

          // Başlangıç ve bitiş günü tam gün olarak ayarla
          const startDateTime = new Date(startDate);
          startDateTime.setHours(0, 0, 0, 0);

          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);

          return sessionDate >= startDateTime && sessionDate <= endDateTime;
        });

        // Aktif oturumu getir
        const activeSession = await cashRegisterService.getActiveSession();

        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let veresiyeCollections = 0;
        let totalCashSales = 0;
        let totalCardSales = 0;
        let totalOpeningBalance = 0;

        // Günlük/saatlik işlemler için obje
        const transactionsData: {
          [key: string]: {
            date: string;
            deposits: number;
            withdrawals: number;
            veresiye: number;
            total: number;
          };
        } = {};

        // Bugün için saat bazlı görünüm hazırlama (boş saatleri doldurmak için)
        if (period === "day") {
          // Günün tüm saatleri için varsayılan değerlerle girdiler oluştur
          for (let hour = 0; hour < 24; hour++) {
            const hourKey = `${hour.toString().padStart(2, "0")}:00`;
            transactionsData[hourKey] = {
              date: hourKey,
              deposits: 0,
              withdrawals: 0,
              veresiye: 0,
              total: 0,
            };
          }
        }

        // Oturumları işle
        for (const sess of sessionsInRange) {
          const details = await cashRegisterService.getSessionDetails(sess.id);

          // Her oturum için verileri topla (aktif veya kapalı)
          totalOpeningBalance += sess.openingBalance;
          totalCashSales += sess.cashSalesTotal || 0;
          totalCardSales += sess.cardSalesTotal || 0;

          if (details.transactions) {
            for (const tx of details.transactions) {
              const dt = new Date(tx.date);

              // period "day" ise saat formatında key kullan, yoksa tarih formatında
              let dataKey;
              if (period === "day") {
                // Saat formatında kayıt (HH:00)
                dataKey = `${dt.getHours().toString().padStart(2, "0")}:00`;
              } else {
                // Tarih formatında kayıt (yyyy-MM-dd)
                dataKey = dt.toISOString().split("T")[0];
              }

              if (!transactionsData[dataKey]) {
                transactionsData[dataKey] = {
                  date: dataKey,
                  deposits: 0,
                  withdrawals: 0,
                  veresiye: 0,
                  total: 0,
                };
              }

              if (tx.type === "GİRİŞ") {
                totalDeposits += tx.amount;
                transactionsData[dataKey].deposits += tx.amount;
                transactionsData[dataKey].total += tx.amount;
              } else if (tx.type === "ÇIKIŞ") {
                totalWithdrawals += tx.amount;
                transactionsData[dataKey].withdrawals += tx.amount;
                transactionsData[dataKey].total -= tx.amount;
              } else if (tx.type === "VERESIYE_TAHSILAT") {
                totalDeposits += tx.amount;
                veresiyeCollections += tx.amount;
                transactionsData[dataKey].veresiye += tx.amount;
                transactionsData[dataKey].deposits += tx.amount;
                transactionsData[dataKey].total += tx.amount;
              }
            }
          }
        }

        // Kapalı oturumları ayarla ve sırala
        const closed = sessionsInRange
          .filter((s) => s.status === CashRegisterStatus.CLOSED)
          .sort((a, b) => {
            return (
              new Date(b.closingDate || b.openingDate).getTime() -
              new Date(a.closingDate || a.openingDate).getTime()
            );
          });

        setClosedSessions(closed);

        // Son kapatılan oturumu ayarla
        if (closed.length > 0) {
          setLastClosedSession(closed[0]);
        } else {
          setLastClosedSession(null);
        }

        // Mevcut kasa bakiyesini hesapla
        let currBalance = 0;
        let isActive = false;
        let openingBalance = period === "day" ? 0 : totalOpeningBalance;

        if (activeSession) {
          // Aktif oturum varsa
          isActive = true;
          currBalance =
            activeSession.openingBalance +
            (activeSession.cashSalesTotal || 0) +
            (activeSession.cashDepositTotal || 0) -
            (activeSession.cashWithdrawalTotal || 0);

          // Günlük görünümde açılış bakiyesini aktif oturumdan al
          if (period === "day") {
            openingBalance = activeSession.openingBalance;
          }
        } else if (closed.length > 0) {
          // Aktif oturum yoksa, son kapanan oturumun verilerini kullan
          const lastSession = closed[0];

          // Son kapanan oturumun kapanış bakiyesini hesapla
          currBalance =
            lastSession.countingAmount !== null &&
            lastSession.countingAmount !== undefined
              ? lastSession.countingAmount
              : lastSession.openingBalance +
                (lastSession.cashSalesTotal || 0) +
                (lastSession.cashDepositTotal || 0) -
                (lastSession.cashWithdrawalTotal || 0);

          // Günlük görünümde açılış bakiyesini son kapanan oturumdan al
          if (period === "day") {
            openingBalance = lastSession.openingBalance;
          }
        }

        // Sıralama için veriyi hazırla
        let dailyData;
        if (period === "day") {
          // Saatlere göre sırala (00:00'dan 23:00'a)
          dailyData = Object.values(transactionsData).sort((a, b) => {
            return (
              parseInt(a.date.split(":")[0]) - parseInt(b.date.split(":")[0])
            );
          });
        } else {
          // Tarihe göre sırala
          dailyData = Object.values(transactionsData).sort((a, b) =>
            a.date.localeCompare(b.date)
          );
        }

        // Kasa verilerini güncelle
        setCashData({
          currentBalance: currBalance,
          totalDeposits,
          totalWithdrawals,
          veresiyeCollections,
          isActive,
          openingBalance,
          cashSalesTotal: totalCashSales,
          cardSalesTotal: totalCardSales,
          dailyData,
        });
      } catch (err) {
        console.error("Kasa verileri yüklenirken hata:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [startDate, endDate, period]);

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
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Satış verileri
  const { sales, loading: salesLoading } = useSales(30000);

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
    // Başlangıç tarihini günün başlangıcına ayarla (00:00:00)
    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);

    // Bitiş tarihini günün sonuna ayarla (23:59:59.999)
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    // Tarih aralığını konsola yazdır (hata ayıklama için)
    console.log(
      "Filtreleme yapılıyor:",
      `${startDateTime.toLocaleString()} - ${endDateTime.toLocaleString()}`
    );

    // Satışları filtrele
    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      // Doğru şekilde kontrol et: satış tarihi >= başlangıç tarihi VE satış tarihi <= bitiş tarihi
      return saleDate >= startDateTime && saleDate <= endDateTime;
    });
  }, [sales, startDate, endDate]);

  // Kasa verileri
  const {
    cashData,
    closedSessions,
    lastClosedSession,
    loading: cashLoading,
  } = useCashDataWithClosedSessions(startDate, endDate, period);

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
  async function handleExport(
    fileType: "excel" | "pdf",
    reportType: "sale" | "product" | "cash"
  ) {
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
            const sessionDetails = await cashRegisterService.getSessionDetails(
              activeSession.id
            );
            allTransactions = sessionDetails.transactions || [];
            veresiyeTx = allTransactions.filter(
              (t) =>
                t.description?.toLowerCase().includes("veresiye") ||
                t.description?.toLowerCase().includes("tahsilat")
            );
          }

          console.log(
            "Veri hazırlama başlıyor - Transactions sayısı:",
            allTransactions.length
          );

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
            transactions: allTransactions,
            salesData: filteredSales.filter((s) => s.status === "completed"),
            veresiyeTransactions: veresiyeTx,
            productSummary: productStats.map((product) => ({
              productName: product.name,
              category: product.category || "Kategori Yok",
              totalSales: product.quantity,
              totalRevenue: product.revenue,
              totalProfit: product.profit,
              profitMargin: product.profitMargin || 0,
            })),
          };

          console.log("Kasa Export Verileri:", {
            "dailyData sayısı": cashExportData.dailyData.length,
            "transactions sayısı": cashExportData.transactions.length,
            "veresiye sayısı": cashExportData.veresiyeTransactions.length,
            "satış sayısı": cashExportData.salesData.length,
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

  // Tarih değişimleri için callback
  const handleDateChange = (start: Date, end: Date) => {
    console.log("Tarih değişiyor:", start, end);
    setStartDate(start);
    setEndDate(end);
  };

  // Periyot değişimi için callback
  const handlePeriodChange = (
    newPeriod: "day" | "week" | "month" | "year" | "custom"
  ) => {
    console.log("Periyot değişiyor:", newPeriod);
    setPeriod(newPeriod);
  };

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
            period={period}
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
    <div className="dashboard-container p-2">
      {/* Yeni DateFilter bileşeni */}
      <DateFilter
        startDate={startDate}
        endDate={endDate}
        period={period}
        onPeriodChange={handlePeriodChange}
        onDateChange={handleDateChange}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        exportButton={
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
        }
      />

      {/* Seçilen Sekmenin İçeriği */}
      <div className="transition-all duration-300 ease-in-out">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default DashboardPage;
