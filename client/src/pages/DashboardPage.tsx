import React, { useState, useMemo, useEffect } from "react";
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
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  CreditCard,
  Calendar,
  ChevronDown,
  Download,
  RefreshCw,
  FileText,
} from "lucide-react";

import PageLayout from "../components/layout/PageLayout";
import DashboardFilters from "../components/DashboardFilters";
import Card from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Pagination } from "../components/ui/Pagination";

import { useSales } from "../hooks/useSales";
import { calculateStatsForDashboard } from "../utils/dashboardStats";
import {
  cashRegisterService,
  CashTransactionType,
  CashRegisterSession,
  CashRegisterStatus,
} from "../services/cashRegisterDB";
import { exportService } from "../services/exportSevices";

import { ProductStats } from "../types/product";

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
        // 1) Tüm oturumları getir
        const all = await cashRegisterService.getAllSessions();

        // 2) Tarih aralığındaki oturumları filtrele
        const sessionsInRange = all.filter((s) => {
          const d = new Date(s.openingDate);
          return d >= startDate && d <= endDate;
        });

        // 3) Aktif oturumu bul
        const activeSession = await cashRegisterService.getActiveSession();

        // 4) Veri toplaması için değişkenler
        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let veresiyeCollections = 0;
        let totalCashSales = 0;
        let totalCardSales = 0;
        let totalOpeningBalance = 0;

        const dailyTransactions: Record<
          string,
          {
            date: string;
            deposits: number;
            withdrawals: number;
            veresiye: number;
            total: number;
          }
        > = {};

        // 5) Oturumları döngüyle işle
        for (const sess of sessionsInRange) {
          const details = await cashRegisterService.getSessionDetails(sess.id);

          if (sess.status === CashRegisterStatus.OPEN) {
            // Aktif oturum verileri
            totalOpeningBalance += sess.openingBalance;
            totalCashSales += sess.cashSalesTotal;
            totalCardSales += sess.cardSalesTotal;

            // İşlemleri günlük olarak topla
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

                if (tx.type === CashTransactionType.DEPOSIT) {
                  totalDeposits += tx.amount;
                  dailyTransactions[dateStr].deposits += tx.amount;
                  dailyTransactions[dateStr].total += tx.amount;
                } else if (tx.type === CashTransactionType.WITHDRAWAL) {
                  totalWithdrawals += tx.amount;
                  dailyTransactions[dateStr].withdrawals += tx.amount;
                  dailyTransactions[dateStr].total -= tx.amount;
                } else if (tx.type === CashTransactionType.CREDIT_COLLECTION) {
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

        // 6) Kapalı oturumları ayarla
        const closed = sessionsInRange
          .filter((s) => s.status === CashRegisterStatus.CLOSED)
          .sort((a, b) => {
            // En yakın tarihli olanları başa getir
            return (
              new Date(b.closingDate || b.openingDate).getTime() -
              new Date(a.closingDate || a.openingDate).getTime()
            );
          });

        setClosedSessions(closed);

        // En son kapatılan oturumu ayarla
        if (closed.length > 0) {
          setLastClosedSession(closed[0]);
        } else {
          setLastClosedSession(null);
        }

        // 7) Aktif oturum bakiyesini hesapla
        let currBalance = 0;
        let isActive = false;

        if (activeSession) {
          isActive = true;
          currBalance =
            activeSession.openingBalance +
            activeSession.cashSalesTotal +
            activeSession.cashDepositTotal -
            activeSession.cashWithdrawalTotal;
        }

        // 8) Kasa verilerini güncelle
        setCashData({
          currentBalance: currBalance,
          totalDeposits,
          totalWithdrawals,
          veresiyeCollections,
          isActive,
          openingBalance: totalOpeningBalance,
          cashSalesTotal: totalCashSales,
          cardSalesTotal: totalCardSales,
          dailyData: Object.values(dailyTransactions).sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
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

// Dashboard sekme tipleri
type DashboardTabKey = "overview" | "cash" | "sales" | "products";

const DashboardPage: React.FC = () => {
  // Tarih filtresi state'leri
  const [period, setPeriod] = useState<
    "day" | "week" | "month" | "year" | "custom"
  >("week");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Sekme state'i
  const [currentTab, setCurrentTab] = useState<DashboardTabKey>("overview");

  // Satış verileri
  const { sales, loading: salesLoading } = useSales(30000);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Son kapatılan kasanın gününe ait satışların gerçek kârını hesaplama
  const [lastClosedSessionProfit, setLastClosedSessionProfit] = useState<{
    revenue: number;
    cost: number;
    profit: number;
  }>({
    revenue: 0,
    cost: 0,
    profit: 0,
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

  // Dashboard istatistikleri
  const {
    totalSales,
    totalRevenue,
    netProfit,
    profitMargin,
    averageBasket,
    cancelRate, // Bu değerleri alıyoruz
    refundRate, // Bu değerleri alıyoruz
    dailySalesData,
    categoryData,
    productStats,
  } = useMemo(() => {
    return calculateStatsForDashboard(filteredSales);
  }, [filteredSales]);

  // Ürün tablosu ayarları
  const sortedProducts = [...productStats].sort(
    (a, b) => b.quantity - a.quantity
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;
  const idxLast = currentPage * itemsPerPage;
  const idxFirst = idxLast - itemsPerPage;
  const currentProducts = sortedProducts.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  // Yükleniyor durumu
  const isLoading = salesLoading || cashLoading;

  // Veriyi yenile
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Dışa aktarma fonksiyonu
  const handleExport = async (
    fileType: "excel" | "pdf",
    reportType: "sale" | "product" | "cash"
  ) => {
    const dateRangeString = exportService.formatDateRange(startDate, endDate);
    try {
      if (fileType === "excel") {
        if (reportType === "cash") {
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
            dailyData: cashData.dailyData,
            closedSessions,
          };
          await exportService.exportCashDataToExcel(
            cashExportData,
            `Kasa Raporu ${dateRangeString}`
          );
        } else {
          await exportService.exportToExcel(
            filteredSales,
            dateRangeString,
            reportType
          );
        }
      } else {
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
  };

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

  // Kapalı kasa oturumları tablosu kolonları
  const closedColumns = [
    {
      key: "openingDate",
      title: "Açılış Tarihi",
      render: (sess: CashRegisterSession) => (
        <span className="text-sm">
          {new Date(sess.openingDate).toLocaleString("tr-TR")}
        </span>
      ),
    },
    {
      key: "closingDate",
      title: "Kapanış Tarihi",
      render: (sess: CashRegisterSession) =>
        sess.closingDate ? (
          <span className="text-sm">
            {new Date(sess.closingDate).toLocaleString("tr-TR")}
          </span>
        ) : (
          <span className="text-xs text-gray-500">-</span>
        ),
    },
    {
      key: "openingBalance",
      title: "Açılış Bakiye",
      render: (sess: CashRegisterSession) => (
        <span className="text-sm text-blue-600 font-medium">
          ₺{sess.openingBalance.toFixed(2)}
        </span>
      ),
    },
    {
      key: "cashSalesTotal",
      title: "Nakit Satış",
      render: (sess: CashRegisterSession) => (
        <span className="text-sm">
          ₺{sess.cashSalesTotal?.toFixed(2) || "0.00"}
        </span>
      ),
    },
    {
      key: "cardSalesTotal",
      title: "Kart Satış",
      render: (sess: CashRegisterSession) => (
        <span className="text-sm">
          ₺{sess.cardSalesTotal?.toFixed(2) || "0.00"}
        </span>
      ),
    },
    {
      key: "cashDepositTotal",
      title: "Nakit Giriş",
      render: (sess: CashRegisterSession) => (
        <span className="text-sm">
          +{sess.cashDepositTotal?.toFixed(2) || "0.00"}
        </span>
      ),
    },
    {
      key: "cashWithdrawalTotal",
      title: "Nakit Çıkış",
      render: (sess: CashRegisterSession) => (
        <span className="text-sm text-red-500">
          -{sess.cashWithdrawalTotal?.toFixed(2) || "0.00"}
        </span>
      ),
    },
    {
      key: "countingAmount",
      title: "Sayım",
      render: (sess: CashRegisterSession) =>
        sess.countingAmount != null ? (
          <span className="text-sm text-gray-600">
            ₺{sess.countingAmount.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-gray-500">-</span>
        ),
    },
    {
      key: "countingDifference",
      title: "Fark",
      render: (sess: CashRegisterSession) =>
        sess.countingDifference != null ? (
          <span
            className={`text-sm ${
              sess.countingDifference < 0
                ? "text-red-600"
                : sess.countingDifference > 0
                ? "text-green-600"
                : "text-gray-600"
            }`}
          >
            {sess.countingDifference > 0 && "+"}
            {sess.countingDifference.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-gray-500">-</span>
        ),
    },
  ];

  // Tarih filtreleme bileşeni
  /** Modern Tarih Filtreleme Bileşeni */
  const renderDateFilter = () => (
    <div className="mb-6 bg-white rounded-lg shadow-sm">
      <div className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              <Calendar size={18} className="text-indigo-600" />
              <span className="text-gray-700 font-medium">
                {formatDate(startDate)} - {formatDate(endDate)}
              </span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 p-5 bg-white rounded-lg shadow-lg z-10 w-80 border border-gray-200">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Başlangıç
                    </label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={startDate.toISOString().split("T")[0]}
                      onChange={(e) => setStartDate(new Date(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bitiş
                    </label>
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={endDate.toISOString().split("T")[0]}
                      onChange={(e) => setEndDate(new Date(e.target.value))}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => {
                      setPeriod("day");
                      setShowDatePicker(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      period === "day"
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Bugün
                  </button>
                  <button
                    onClick={() => {
                      setPeriod("week");
                      setShowDatePicker(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      period === "week"
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Bu Hafta
                  </button>
                  <button
                    onClick={() => {
                      setPeriod("month");
                      setShowDatePicker(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      period === "month"
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Bu Ay
                  </button>
                  <button
                    onClick={() => {
                      setPeriod("year");
                      setShowDatePicker(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      period === "year"
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Bu Yıl
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setPeriod("custom");
                      setShowDatePicker(false);
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    Uygula
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative group">
            <button className="flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
              <Download size={18} className="text-indigo-600" />
              <span className="text-gray-700 font-medium">Dışa Aktar</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            <div className="absolute top-full right-0 mt-2 p-2 hidden group-hover:block bg-white rounded-lg shadow-lg z-10 border border-gray-200 w-48">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                Excel
              </div>
              <button
                onClick={() => handleExport("excel", "sale")}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Satış Raporu
              </button>
              <button
                onClick={() => handleExport("excel", "product")}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Ürün Raporu
              </button>
              <button
                onClick={() => handleExport("excel", "cash")}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Kasa Raporu
              </button>

              <div className="mt-1 pt-1 border-t border-gray-100"></div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                PDF
              </div>
              <button
                onClick={() => handleExport("pdf", "sale")}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Satış Raporu
              </button>
              <button
                onClick={() => handleExport("pdf", "product")}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Ürün Raporu
              </button>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            className={`flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors ${
              isLoading ? "cursor-not-allowed opacity-75" : ""
            }`}
            disabled={isLoading}
          >
            <RefreshCw
              size={18}
              className={`text-indigo-600 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="text-gray-700 font-medium">
              {isLoading ? "Yükleniyor..." : "Yenile"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  // Sekme düğmeleri
  /** Modern ve Şık Sekme Düğmeleri */
  const renderTabButtons = () => {
    const tabs: {
      key: DashboardTabKey;
      label: string;
      icon: React.ReactNode;
    }[] = [
      { key: "overview", label: "Genel Özet", icon: <TrendingUp size={18} /> },
      { key: "cash", label: "Kasa Raporu", icon: <DollarSign size={18} /> },
      {
        key: "sales",
        label: "Satış Analizi",
        icon: <ShoppingCart size={18} />,
      },
      {
        key: "products",
        label: "Ürün Performansı",
        icon: <FileText size={18} />,
      },
    ];

    return (
      <div className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const active = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setCurrentTab(tab.key)}
                className={`flex items-center gap-2 py-4 px-6 transition-colors relative ${
                  active
                    ? "text-indigo-600 font-medium"
                    : "text-gray-600 hover:text-indigo-500 hover:bg-indigo-50/30"
                }`}
              >
                <span
                  className={`${active ? "text-indigo-600" : "text-gray-400"}`}
                >
                  {tab.icon}
                </span>
                {tab.label}
                {active && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /** 1) Genel Özet Sekmesi */
  /** 1) Modern ve Şık Genel Özet Sekmesi */
  const renderOverviewTab = () => {
    return (
      <div className="space-y-6">
        {/* Üst özet kartları */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-blue-50">
              <h3 className="text-sm font-medium text-blue-700">
                Toplam Satış
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                {totalSales}
              </div>
              <p className="text-xs text-gray-500 mt-1">Toplam satış adedi</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-indigo-50">
              <h3 className="text-sm font-medium text-indigo-700">Brüt Ciro</h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">{`₺${totalRevenue.toFixed(
                2
              )}`}</div>
              <p className="text-xs text-gray-500 mt-1">Toplam gelir</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-green-50">
              <h3 className="text-sm font-medium text-green-700">Net Kâr</h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">{`₺${netProfit.toFixed(
                2
              )}`}</div>
              <p className="text-xs text-gray-500 mt-1">Toplam kâr</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-purple-50">
              <h3 className="text-sm font-medium text-purple-700">Kâr Marjı</h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">{`%${profitMargin.toFixed(
                1
              )}`}</div>
              <p className="text-xs text-gray-500 mt-1">Ortalama kârlılık</p>
            </div>
          </div>
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
                      dot={{ stroke: "#4f46e5", strokeWidth: 2, r: 4 }}
                      activeDot={{ stroke: "#4f46e5", strokeWidth: 2, r: 6 }}
                      name="Ciro"
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ stroke: "#10b981", strokeWidth: 2, r: 4 }}
                      activeDot={{ stroke: "#10b981", strokeWidth: 2, r: 6 }}
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
                <div className="text-sm text-blue-700 mb-1">
                  Açılış Bakiyesi
                </div>
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
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ürün
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Kategori
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Adet
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Ciro
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Kâr
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedProducts.slice(0, 5).map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-800">
                          {product.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {product.category}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-800">
                          {product.quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-800">
                          ₺{product.revenue.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-green-600">
                          ₺{product.profit.toFixed(2)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  /** 2) Modern ve Kullanıcı Dostu Kasa Raporu Sekmesi */
  const renderCashTab = () => {
    // Günlük nakit artışı: Gün sonu kasa - Başlangıç bakiyesi
    const dailyCashIncrease = lastClosedSession
      ? (lastClosedSession.countingAmount ??
          lastClosedSession.openingBalance +
            (lastClosedSession.cashSalesTotal || 0) +
            (lastClosedSession.cashDepositTotal || 0) -
            (lastClosedSession.cashWithdrawalTotal || 0)) -
        lastClosedSession.openingBalance
      : 0;

    return (
      <div className="space-y-6">
        {/* Üst özet kartları */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-blue-50">
              <h3 className="text-sm font-medium text-blue-700">
                Kasa Bakiyesi
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">{`₺${cashData.currentBalance.toFixed(
                2
              )}`}</div>
              <p className="text-xs text-gray-500 mt-1">Toplam bakiye</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-green-50">
              <h3 className="text-sm font-medium text-green-700">
                Nakit Satışlar
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">{`₺${cashData.cashSalesTotal.toFixed(
                2
              )}`}</div>
              <p className="text-xs text-gray-500 mt-1">
                Nakit ile yapılan satışlar
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-indigo-50">
              <h3 className="text-sm font-medium text-indigo-700">
                Kart Satışlar
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">{`₺${cashData.cardSalesTotal.toFixed(
                2
              )}`}</div>
              <p className="text-xs text-gray-500 mt-1">
                Kart ile yapılan satışlar
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-purple-50">
              <h3 className="text-sm font-medium text-purple-700">
                Toplam Satış
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">{`₺${(
                cashData.cashSalesTotal + cashData.cardSalesTotal
              ).toFixed(2)}`}</div>
              <p className="text-xs text-gray-500 mt-1">
                Tüm satışların toplamı
              </p>
            </div>
          </div>
        </div>

        {/* Günün Gerçek Artışı - Ana Kart */}
        {lastClosedSession && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-5 flex flex-col md:flex-row justify-between items-center">
              <div className="text-white">
                <h2 className="text-xl font-bold">Günün Gerçek Artışı</h2>
                <p className="text-blue-100 mt-1">
                  Açılış bakiyesi (₺
                  {lastClosedSession.openingBalance.toFixed(2)}) hariç, gün
                  sonunda kasada oluşan artış
                </p>
              </div>
              <div className="bg-white px-6 py-3 rounded-lg shadow-inner mt-4 md:mt-0">
                <span
                  className={`text-2xl md:text-3xl font-bold ${
                    dailyCashIncrease >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {dailyCashIncrease >= 0 ? "+" : ""}₺
                  {dailyCashIncrease.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Detay kartları */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 bg-blue-600 px-2 py-2">
              <div className="p-3 m-1 bg-white rounded-md flex flex-col">
                <span className="text-xs font-medium text-gray-500">
                  Açılış
                </span>
                <span className="text-base font-medium text-gray-800">
                  ₺{lastClosedSession.openingBalance.toFixed(2)}
                </span>
              </div>
              <div className="p-3 m-1 bg-white rounded-md flex flex-col">
                <span className="text-xs font-medium text-gray-500">
                  Nakit Satışlar
                </span>
                <span className="text-base font-medium text-green-600">
                  +₺{(lastClosedSession.cashSalesTotal || 0).toFixed(2)}
                </span>
              </div>
              <div className="p-3 m-1 bg-white rounded-md flex flex-col">
                <span className="text-xs font-medium text-gray-500">
                  Nakit Girişler
                </span>
                <span className="text-base font-medium text-green-600">
                  +₺{(lastClosedSession.cashDepositTotal || 0).toFixed(2)}
                </span>
              </div>
              <div className="p-3 m-1 bg-white rounded-md flex flex-col">
                <span className="text-xs font-medium text-gray-500">
                  Nakit Çıkışlar
                </span>
                <span className="text-base font-medium text-red-600">
                  -₺{(lastClosedSession.cashWithdrawalTotal || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Nakit Akışı ve Sayım */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Nakit akışı kartı */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-medium text-gray-800">Nakit Akışı</h2>
            </div>

            <div className="divide-y divide-gray-100">
              <div className="px-6 py-4 flex justify-between items-center">
                <div className="flex items-center">
                  <div className="p-2 rounded-md bg-green-50 mr-3">
                    <ArrowDown className="text-green-500 h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-700">
                      Veresiye Tahsilatı
                    </span>
                    <span className="text-xs text-gray-500">
                      Alacak tahsilatları
                    </span>
                  </div>
                </div>
                <div className="text-base font-medium text-green-600">
                  +₺{cashData.veresiyeCollections.toFixed(2)}
                </div>
              </div>

              <div className="px-6 py-4 flex justify-between items-center">
                <div className="flex items-center">
                  <div className="p-2 rounded-md bg-green-50 mr-3">
                    <ArrowDown className="text-green-500 h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-700">
                      Diğer Nakit Girişler
                    </span>
                    <span className="text-xs text-gray-500">
                      Diğer tüm nakit girişleri
                    </span>
                  </div>
                </div>
                <div className="text-base font-medium text-green-600">
                  +₺
                  {(
                    cashData.totalDeposits - cashData.veresiyeCollections
                  ).toFixed(2)}
                </div>
              </div>

              <div className="px-6 py-4 flex justify-between items-center">
                <div className="flex items-center">
                  <div className="p-2 rounded-md bg-red-50 mr-3">
                    <ArrowUp className="text-red-500 h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-700">
                      Nakit Çıkışlar
                    </span>
                    <span className="text-xs text-gray-500">
                      Ödemeler ve giderler
                    </span>
                  </div>
                </div>
                <div className="text-base font-medium text-red-600">
                  -₺{cashData.totalWithdrawals.toFixed(2)}
                </div>
              </div>

              <div className="px-6 py-4 flex justify-between items-center bg-gray-50">
                <div className="flex items-center">
                  <div className="p-2 rounded-md bg-blue-50 mr-3">
                    <DollarSign className="text-blue-500 h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-700">
                      Net Nakit Akışı
                    </span>
                    <span className="text-xs text-gray-500">
                      Toplam değişim
                    </span>
                  </div>
                </div>
                <div
                  className={`text-lg font-semibold ${
                    cashData.totalDeposits - cashData.totalWithdrawals >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {cashData.totalDeposits - cashData.totalWithdrawals >= 0
                    ? "+"
                    : ""}
                  ₺
                  {(cashData.totalDeposits - cashData.totalWithdrawals).toFixed(
                    2
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Kasa sayımı kartı */}
          {lastClosedSession && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-medium text-gray-800">
                  Son Kasa Sayımı
                </h2>
              </div>

              <div className="px-6 py-5">
                <div className="flex justify-between items-center mb-5">
                  <span className="text-sm font-medium text-gray-500">
                    Tarih
                  </span>
                  <span className="text-sm font-medium text-gray-800">
                    {new Date(
                      lastClosedSession.closingDate ||
                        lastClosedSession.openingDate
                    ).toLocaleDateString("tr-TR")}
                  </span>
                </div>

                <div className="flex justify-between items-center mb-5">
                  <span className="text-sm font-medium text-gray-500">
                    Teorik Kasa
                  </span>
                  <span className="text-sm font-medium text-gray-800">
                    ₺
                    {(
                      lastClosedSession.openingBalance +
                      (lastClosedSession.cashSalesTotal || 0) +
                      (lastClosedSession.cashDepositTotal || 0) -
                      (lastClosedSession.cashWithdrawalTotal || 0)
                    ).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center mb-5">
                  <span className="text-sm font-medium text-gray-500">
                    Sayım Sonucu
                  </span>
                  <span className="text-sm font-medium text-gray-800">
                    {lastClosedSession.countingAmount
                      ? `₺${lastClosedSession.countingAmount.toFixed(2)}`
                      : "Sayım yapılmadı"}
                  </span>
                </div>

                {lastClosedSession.countingDifference != null && (
                  <div className="flex justify-between items-center mt-8">
                    <span className="text-base font-medium text-gray-700">
                      Sayım Farkı
                    </span>
                    <span
                      className={`px-4 py-2 rounded-full text-sm font-medium ${
                        lastClosedSession.countingDifference < 0
                          ? "bg-red-100 text-red-800"
                          : lastClosedSession.countingDifference > 0
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {lastClosedSession.countingDifference > 0 && "+"}₺
                      {lastClosedSession.countingDifference.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Günlük Hareketler Grafiği */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              Günlük Kasa Hareketleri
            </h2>
          </div>

          <div className="p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashData.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="#94a3b8"
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
                    dataKey="deposits"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ stroke: "#22c55e", strokeWidth: 2, r: 4 }}
                    activeDot={{ stroke: "#22c55e", strokeWidth: 2, r: 6 }}
                    name="Nakit Girişler"
                  />
                  <Line
                    type="monotone"
                    dataKey="withdrawals"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ stroke: "#ef4444", strokeWidth: 2, r: 4 }}
                    activeDot={{ stroke: "#ef4444", strokeWidth: 2, r: 6 }}
                    name="Nakit Çıkışlar"
                  />
                  <Line
                    type="monotone"
                    dataKey="veresiye"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ stroke: "#a855f7", strokeWidth: 2, r: 4 }}
                    activeDot={{ stroke: "#a855f7", strokeWidth: 2, r: 6 }}
                    name="Veresiye"
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ stroke: "#3b82f6", strokeWidth: 2, r: 4 }}
                    activeDot={{ stroke: "#3b82f6", strokeWidth: 2, r: 6 }}
                    name="Net Değişim"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Kapanmış Kasa Oturumları */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-800">
              Son Kapatılan Kasalar
            </h2>
            <span className="text-sm text-blue-600 cursor-pointer">
              Tümünü Gör
            </span>
          </div>

          {closedSessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>Seçilen dönemde kapalı kasa oturumu bulunmuyor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tarih
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Nakit Satış
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Kart Satış
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Toplam Satış
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Sayım Farkı
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {closedSessions.slice(0, 5).map((session, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-800">
                          {new Date(
                            session.closingDate || session.openingDate
                          ).toLocaleDateString("tr-TR")}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(
                            session.closingDate || session.openingDate
                          ).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-800">
                          ₺{(session.cashSalesTotal || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-800">
                          ₺{(session.cardSalesTotal || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-800">
                          ₺
                          {(
                            (session.cashSalesTotal || 0) +
                            (session.cardSalesTotal || 0)
                          ).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {session.countingDifference != null ? (
                          <span
                            className={`px-2 py-1 text-xs inline-flex items-center rounded-full font-medium ${
                              session.countingDifference < 0
                                ? "bg-red-100 text-red-800"
                                : session.countingDifference > 0
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {session.countingDifference > 0 && "+"}₺
                            {session.countingDifference.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  /** 3) Modern ve Şık Satış Analizi Sekmesi */
  /** 3) Modern ve Şık Satış Analizi Sekmesi */
  const renderSalesAnalysisTab = () => {
    return (
      <div className="space-y-6">
        {/* Üst özet kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-indigo-50">
              <h3 className="text-sm font-medium text-indigo-700">
                Toplam Satış Adedi
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                {totalSales}
              </div>
              <p className="text-xs text-gray-500 mt-1">Seçili dönem</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-blue-50">
              <h3 className="text-sm font-medium text-blue-700">
                Günlük Ortalama
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                {dailySalesData.length > 0
                  ? (totalSales / dailySalesData.length).toFixed(1)
                  : "0"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Satış / Gün</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-green-50">
              <h3 className="text-sm font-medium text-green-700">
                Ortalama Sepet
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                ₺
                {totalSales > 0
                  ? (totalRevenue / totalSales).toFixed(2)
                  : "0,00"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Tutar / Satış</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-purple-50">
              <h3 className="text-sm font-medium text-purple-700">
                Kârlılık Oranı
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                %{profitMargin.toFixed(1)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Kâr / Ciro</p>
            </div>
          </div>

          {/* YENİ - İptal Oranı Kartı */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-red-50">
              <h3 className="text-sm font-medium text-red-700">İptal Oranı</h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                %{cancelRate.toFixed(1)}
              </div>
              <p className="text-xs text-gray-500 mt-1">İptal / Toplam</p>
            </div>
          </div>

          {/* YENİ - İade Oranı Kartı */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-orange-50">
              <h3 className="text-sm font-medium text-orange-700">
                İade Oranı
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                %{refundRate.toFixed(1)}
              </div>
              <p className="text-xs text-gray-500 mt-1">İade / Toplam</p>
            </div>
          </div>
        </div>

        {/* Günlük Satışlar Grafiği */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              Günlük Satışlar
            </h2>
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

        {/* YENİ - İptal ve İade Analizi */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
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
            <div className="px-6 py-4 border-b border-gray-100">
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
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-800">
              Satış Performansı
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-6">
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

  /** 4) Modern ve Şık Ürün Performansı Sekmesi */
  const renderProductsTab = () => {
    return (
      <div className="space-y-6">
        {/* Üst Özet Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-indigo-50">
              <h3 className="text-sm font-medium text-indigo-700">
                Toplam Ürün
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                {sortedProducts.length}
              </div>
              <p className="text-xs text-gray-500 mt-1">Satılan farklı ürün</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-blue-50">
              <h3 className="text-sm font-medium text-blue-700">
                En Çok Satan
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-lg font-semibold text-gray-800 truncate">
                {sortedProducts.length > 0 ? sortedProducts[0].name : "-"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {sortedProducts.length > 0
                  ? `${sortedProducts[0].quantity} adet`
                  : "Veri yok"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-green-50">
              <h3 className="text-sm font-medium text-green-700">
                En Kârlı Ürün
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-lg font-semibold text-gray-800 truncate">
                {sortedProducts.length > 0
                  ? [...sortedProducts].sort((a, b) => b.profit - a.profit)[0]
                      .name
                  : "-"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {sortedProducts.length > 0
                  ? `₺${[...sortedProducts]
                      .sort((a, b) => b.profit - a.profit)[0]
                      .profit.toFixed(2)}`
                  : "Veri yok"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-purple-50">
              <h3 className="text-sm font-medium text-purple-700">
                Ortalama Fiyat
              </h3>
            </div>
            <div className="px-5 py-4">
              <div className="text-2xl font-semibold text-gray-800">
                ₺
                {sortedProducts.length > 0
                  ? (
                      sortedProducts.reduce(
                        (sum, item) => sum + item.revenue,
                        0
                      ) /
                      sortedProducts.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                      )
                    ).toFixed(2)
                  : "0,00"}
              </div>
              <p className="text-xs text-gray-500 mt-1">Ortalama birim fiyat</p>
            </div>
          </div>
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

          <div className="overflow-x-auto">
            {/* Responsive, yüksek kaliteli tablo */}
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ürün
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    Adet
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    Ciro (₺)
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    Kâr (₺)
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    Kâr (%)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                      </div>
                      <div className="mt-2 text-sm text-gray-500">
                        Veriler yükleniyor...
                      </div>
                    </td>
                  </tr>
                ) : currentProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-gray-500"
                    >
                      Seçilen dönemde satış verisi bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  currentProducts.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-800">
                          {product.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {product.category}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-800">
                          {product.quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-800">
                          {product.revenue.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-green-600">
                          {product.profit.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-blue-600">
                          {((product.profit / product.revenue) * 100).toFixed(
                            1
                          )}
                          %
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
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
                    data={sortedProducts.slice(0, 5)}
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
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      width={150}
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
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      width={150}
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

  return (
    <PageLayout>
      {/* Tarih Filtreleme */}
      {renderDateFilter()}

      {/* Sekme Düğmeleri */}
      {renderTabButtons()}

      {/* Seçilen Sekmenin İçeriği */}
      {currentTab === "overview" && renderOverviewTab()}
      {currentTab === "cash" && renderCashTab()}
      {currentTab === "sales" && renderSalesAnalysisTab()}
      {currentTab === "products" && renderProductsTab()}
    </PageLayout>
  );
};

export default DashboardPage;
