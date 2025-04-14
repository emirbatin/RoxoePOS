import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  Download,
} from "lucide-react";
import { CashRegisterSession } from "../../services/cashRegisterDB";
import { Table } from "../../components/ui/Table";
import Card from "../ui/Card";

interface CashTabProps {
  cashData: {
    currentBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    veresiyeCollections: number;
    isActive: boolean;
    openingBalance: number;
    cashSalesTotal: number;
    cardSalesTotal: number;
    dailyData: Array<{
      date: string;
      deposits: number;
      withdrawals: number;
      veresiye: number;
      total: number;
    }>;
  };
  closedSessions: CashRegisterSession[];
  lastClosedSession: CashRegisterSession | null;
  sortedClosedSessions: CashRegisterSession[];
  isLoading: boolean;
  formatDate: (date: Date | string | undefined) => string;
  handleCashSort: (key: string) => void;
  cashSortConfig: {
    key: string;
    direction: "asc" | "desc";
  };
  period: "day" | "week" | "month" | "year" | "custom"; // Periyot bilgisi
}

const CashTab: React.FC<CashTabProps> = ({
  cashData,
  closedSessions,
  lastClosedSession,
  sortedClosedSessions,
  isLoading,
  formatDate,
  handleCashSort,
  cashSortConfig,
  period,
}) => {
  // Günlük nakit artışı hesaplama - isActive durumuna göre
  const dailyCashIncrease = cashData.isActive
    ? cashData.currentBalance - cashData.openingBalance
    : lastClosedSession
    ? (lastClosedSession.countingAmount ??
        lastClosedSession.openingBalance +
          (lastClosedSession.cashSalesTotal || 0) +
          (lastClosedSession.cashDepositTotal || 0) -
          (lastClosedSession.cashWithdrawalTotal || 0)) -
      lastClosedSession.openingBalance
    : 0;

  // Nakit / Kart satış verisi
  const salesData = [
    { name: "Nakit Satış", value: cashData.cashSalesTotal },
    { name: "Kart Satış", value: cashData.cardSalesTotal },
  ];

  // Renk paleti
  const COLORS = ["#4f46e5", "#10b981", "#ef4444", "#8b5cf6"];

  // Kasa oturumları için tablo sütunlarını tanımla
  const sessionColumns = [
    {
      key: "openingDate",
      title: "Tarih",
      render: (session: CashRegisterSession) => (
        <div className="text-sm text-gray-600">
          {new Date(session.openingDate).toLocaleDateString("tr-TR")}
        </div>
      ),
    },
    {
      key: "openingBalance",
      title: "Açılış Bakiye",
      className: "text-right",
      render: (session: CashRegisterSession) => (
        <div className="text-sm font-medium text-blue-600">
          ₺{session.openingBalance.toFixed(2)}
        </div>
      ),
    },
    {
      key: "cashSalesTotal",
      title: "Nakit Satış",
      className: "text-right",
      render: (session: CashRegisterSession) => (
        <div className="text-sm text-gray-600">
          ₺{session.cashSalesTotal?.toFixed(2) || "0.00"}
        </div>
      ),
    },
    {
      key: "cardSalesTotal",
      title: "Kart Satış",
      className: "text-right",
      render: (session: CashRegisterSession) => (
        <div className="text-sm text-gray-600">
          ₺{session.cardSalesTotal?.toFixed(2) || "0.00"}
        </div>
      ),
    },
    {
      key: "cashDepositTotal",
      title: "Nakit Giriş",
      className: "text-right",
      render: (session: CashRegisterSession) => (
        <div className="text-sm text-green-600">
          +₺{session.cashDepositTotal?.toFixed(2) || "0.00"}
        </div>
      ),
    },
    {
      key: "cashWithdrawalTotal",
      title: "Nakit Çıkış",
      className: "text-right",
      render: (session: CashRegisterSession) => (
        <div className="text-sm text-red-500">
          -₺{session.cashWithdrawalTotal?.toFixed(2) || "0.00"}
        </div>
      ),
    },
    {
      key: "countingDifference",
      title: "Fark",
      className: "text-right",
      render: (session: CashRegisterSession) => (
        <div>
          {session.countingDifference != null ? (
            <span
              className={
                session.countingDifference < 0
                  ? "text-sm text-red-600"
                  : session.countingDifference > 0
                  ? "text-sm text-green-600"
                  : "text-sm text-gray-600"
              }
            >
              {session.countingDifference > 0 && "+"}₺
              {session.countingDifference.toFixed(2)}
            </span>
          ) : (
            <span className="text-sm text-gray-500">-</span>
          )}
        </div>
      ),
    },
  ];

  // Table için veri hazırlama
  const displaySessions = useMemo(() => {
    return sortedClosedSessions.slice(0, 5);
  }, [sortedClosedSessions]);

  // Toplam hesaplanacak sütunlar
  const totalColumns: Partial<
    Record<keyof CashRegisterSession, "sum" | "count">
  > = {
    openingBalance: "sum",
    cashSalesTotal: "sum",
    cardSalesTotal: "sum",
    cashDepositTotal: "sum",
    cashWithdrawalTotal: "sum",
    countingDifference: "sum",
  };

  // Gösterilecek oturum (aktif oturum veya son kapanan oturum)
  const sessionToShow = cashData.isActive
    ? {
        openingBalance: cashData.openingBalance,
        cashDepositTotal: cashData.totalDeposits,
        cashWithdrawalTotal: cashData.totalWithdrawals,
        countingAmount: null, // Aktif oturumda sayım sonucu olmaz
      }
    : lastClosedSession;

  // Grafik için zaman formatını belirleme
  const isSameDay = (dateStr: string) => {
    // "00:00" formatındaki string kontrol ediliyor (saatlik görünüm)
    return dateStr.includes(":");
  };

  // Grafik için özel eksen formatı
  const formatXAxis = (value: string) => {
    if (isSameDay(value)) {
      // Saatlik görünüm için formatla: "09:00" -> "09:00"
      return value;
    } else {
      // Diğer görünümler için tarih formatı kullan
      return new Date(value).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Ana Metrikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          variant="summary"
          title="Kasa Bakiyesi"
          value={`₺${cashData.currentBalance.toFixed(2)}`}
          description="Güncel toplam bakiye"
          color="indigo"
        />
        <Card
          variant="summary"
          title="Nakit Satışlar"
          value={`₺${cashData.cashSalesTotal.toFixed(2)}`}
          description="Nakit ile yapılan satışlar"
          color="green"
        />
        <Card
          variant="summary"
          title="Kart Satışlar"
          value={`₺${cashData.cardSalesTotal.toFixed(2)}`}
          description="Kart ile yapılan satışlar"
          color="blue"
        />
        <Card
          variant="summary"
          title="Toplam Satış"
          value={`₺${(
            cashData.cashSalesTotal + cashData.cardSalesTotal - cashData.totalWithdrawals
          ).toFixed(2)}`}
          description="Tüm satışların toplamı"
          color="purple"
        />
      </div>

      {/* Günün Artışı Kartı */}
      {period === "day" && sessionToShow && (
        <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-lg shadow text-white p-5">
          <div className="flex flex-col md:flex-row justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">Günün Gerçek Artışı</h2>
              <p className="text-indigo-100 mt-1">
                Açılış bakiyesi (₺{sessionToShow.openingBalance.toFixed(2)})
                hariç, kasadaki net değişim
              </p>
            </div>
            <div className="bg-white px-6 py-3 rounded-lg shadow mt-4 md:mt-0">
              <div
                className={`text-2xl font-bold ${
                  dailyCashIncrease >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {dailyCashIncrease >= 0 ? "+" : ""}₺
                {dailyCashIncrease.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="bg-white bg-opacity-90 p-3 rounded-lg text-gray-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <div className="text-xs font-medium">Açılış</div>
              </div>
              <div className="text-lg font-semibold mt-1">
                ₺{sessionToShow.openingBalance.toFixed(2)}
              </div>
            </div>

            <div className="bg-white bg-opacity-90 p-3 rounded-lg text-gray-800">
              <div className="flex items-center gap-2">
                <ArrowDown className="h-4 w-4 text-green-600" />
                <div className="text-xs font-medium">Nakit Girişler</div>
              </div>
              <div className="text-lg font-semibold text-green-600 mt-1">
                +₺
                {(cashData.isActive
                  ? cashData.totalDeposits
                  : sessionToShow.cashDepositTotal || 0
                ).toFixed(2)}
              </div>
            </div>

            <div className="bg-white bg-opacity-90 p-3 rounded-lg text-gray-800">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4 text-red-600" />
                <div className="text-xs font-medium">Nakit Çıkışlar</div>
              </div>
              <div className="text-lg font-semibold text-red-600 mt-1">
                -₺
                {(cashData.isActive
                  ? cashData.totalWithdrawals
                  : sessionToShow.cashWithdrawalTotal || 0
                ).toFixed(2)}
              </div>
            </div>

            <div className="bg-white bg-opacity-90 p-3 rounded-lg text-gray-800">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-indigo-600" />
                <div className="text-xs font-medium">Sayım Sonucu</div>
              </div>
              <div className="text-lg font-semibold mt-1">
                {cashData.isActive
                  ? "Henüz Yapılmadı"
                  : sessionToShow.countingAmount
                  ? `₺${sessionToShow.countingAmount.toFixed(2)}`
                  : "Yapılmadı"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* İki sütun düzen: Nakit Akışı ve Gelir-Gider Dağılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nakit Akışı Kartı */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-lg font-medium text-gray-900">Nakit Akışı</h3>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="px-4 py-3 flex justify-between items-center">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-md mr-3">
                  <ArrowDown className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700">
                    Veresiye Tahsilatı
                  </span>
                  <span className="text-xs text-gray-500">
                    Müşteri alacakları
                  </span>
                </div>
              </div>
              <div className="text-base font-medium text-green-600">
                +₺{cashData.veresiyeCollections.toFixed(2)}
              </div>
            </div>

            <div className="px-4 py-3 flex justify-between items-center">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-md mr-3">
                  <ArrowDown className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700">
                    Diğer Nakit Girişler
                  </span>
                  <span className="text-xs text-gray-500">
                    Tüm nakit girişleri
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

            <div className="px-4 py-3 flex justify-between items-center">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-md mr-3">
                  <ArrowUp className="h-4 w-4 text-red-600" />
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

            <div className="px-4 py-3 flex justify-between items-center bg-gray-50">
              <div className="flex items-center">
                <div className="p-2 bg-indigo-100 rounded-md mr-3">
                  <DollarSign className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700">
                    Net Nakit Akışı
                  </span>
                  <span className="text-xs text-gray-500">Toplam değişim</span>
                </div>
              </div>
              <div
                className={`text-lg font-bold ${
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

        {/* Satış Dağılımı Grafiği */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-lg font-medium text-gray-900">
              Satış Dağılımı
            </h3>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  dataKey="value"
                >
                  <Cell fill={COLORS[0]} />
                  <Cell fill={COLORS[1]} />
                </Pie>
                <Tooltip
                  formatter={(value) => [`₺${Number(value).toFixed(2)}`, ""]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Kasa Hareketleri Grafiği - Günlük veya Saatlik */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {period === "day"
              ? "Saatlik Kasa Hareketleri"
              : "Günlük Kasa Hareketleri"}
          </h3>
          <button className="p-2 text-gray-500 hover:text-indigo-500 hover:bg-gray-100 rounded-full">
            <Download size={18} />
          </button>
        </div>
        <div className="p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cashData.dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                tickFormatter={formatXAxis}
                interval={period === "day" ? 2 : 0} // Saatlik görünümde her 3. saati göster
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                formatter={(value) => [`₺${Number(value).toFixed(2)}`, ""]}
                labelFormatter={(label) =>
                  isSameDay(label)
                    ? `Saat: ${label}`
                    : `Tarih: ${new Date(label).toLocaleDateString("tr-TR")}`
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
                name="Nakit Girişler"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ stroke: "#10b981", strokeWidth: 2, r: 4 }}
                activeDot={{ stroke: "#10b981", strokeWidth: 2, r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="withdrawals"
                name="Nakit Çıkışlar"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ stroke: "#ef4444", strokeWidth: 2, r: 4 }}
                activeDot={{ stroke: "#ef4444", strokeWidth: 2, r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Net Değişim"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={{ stroke: "#4f46e5", strokeWidth: 2, r: 4 }}
                activeDot={{ stroke: "#4f46e5", strokeWidth: 2, r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Kasa Oturumları Tablosu - Table bileşeni ile güncellendi */}
      {sortedClosedSessions.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              Son Kasa Oturumları
            </h3>
            <button className="text-sm text-indigo-600 hover:text-indigo-800">
              Tümünü Gör
            </button>
          </div>

          <div className="overflow-hidden">
            <Table
              data={displaySessions}
              columns={sessionColumns}
              enableSorting={true}
              defaultSortKey="openingDate"
              defaultSortDirection="desc"
              loading={isLoading}
              emptyMessage="Kasa oturum verisi bulunmuyor."
              showTotals={true}
              totalColumns={totalColumns}
              totalData={sortedClosedSessions}
              className="border-none rounded-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CashTab;
