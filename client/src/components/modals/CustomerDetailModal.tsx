import React, { useEffect, useState } from "react";
import {
  X,
  CreditCard,
  DollarSign,
  Clock,
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  Tag,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { Customer, CreditTransaction } from "../../types/credit";
import { salesDB } from "../../services/salesDB";
import { Sale } from "../../types/sales";
import { useNavigate } from "react-router-dom";

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  transactions: CreditTransaction[];
  onAddDebt: (customer: Customer) => void;
  onAddPayment: (customer: Customer) => void;
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen,
  onClose,
  customer,
  transactions,
  onAddDebt,
  onAddPayment,
}) => {
  const navigate = useNavigate();
  const [relatedSales, setRelatedSales] = useState<Record<string, Sale>>({});

  // Vadesi yaklaşan işlemler için state
  const [approachingDueTransactions, setApproachingDueTransactions] = useState<
    CreditTransaction[]
  >([]);

  // Debug info state
  const [debugInfo, setDebugInfo] = useState({
    transactionsLength: 0,
    hasTransactions: false,
    sortedTransactionsLength: 0,
  });

  // Tarih karşılaştırma yardımcı fonksiyonları
  const isSameOrBefore = (date1: Date, date2: Date) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    // Sadece tarih kısmını karşılaştırmak için saat/dakika/saniye kısımlarını sıfırlıyoruz
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);

    return d1.getTime() <= d2.getTime();
  };

  const isSameOrAfter = (date1: Date, date2: Date) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    // Sadece tarih kısmını karşılaştırmak için saat/dakika/saniye kısımlarını sıfırlıyoruz
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);

    return d1.getTime() >= d2.getTime();
  };

  // Vadesi yaklaşan işlemleri hesapla (7 gün içinde vadesi dolacaklar)
  useEffect(() => {
    if (isOpen && Array.isArray(transactions)) {
      // Müşterinin borcu 0 ise, yaklaşan vade göstermeyelim
      if (customer.currentDebt === 0) {
        setApproachingDueTransactions([]);
        return;
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0); // Saat kısmını sıfırlıyoruz

      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999); // Günün sonunu temsil etmek için

      // ÖNEMLİ: Sadece aktif borçları göster, ödenmiş borçları gösterme!
      const approaching = transactions.filter(
        (tx) =>
          tx.type === "debt" &&
          tx.status === "active" && // ÖNEMLİ - aktif borçlar
          tx.dueDate &&
          isSameOrAfter(new Date(tx.dueDate), now) &&
          isSameOrBefore(new Date(tx.dueDate), nextWeek)
      );

      console.log(
        "Yaklaşan vadeler hesaplandı:",
        approaching.length,
        approaching
      );
      setApproachingDueTransactions(approaching);
    }
  }, [isOpen, transactions, customer.currentDebt]);

  function logTransactionStatuses() {
    if (isOpen && Array.isArray(transactions)) {
      const statusCounts = {
        active: 0,
        paid: 0,
        overdue: 0,
        other: 0,
      };

      transactions.forEach((tx) => {
        if (tx.status === "active") statusCounts.active++;
        else if (tx.status === "paid") statusCounts.paid++;
        else if (tx.status === "overdue") statusCounts.overdue++;
        else statusCounts.other++;
      });

      console.log("İşlem durumları:", statusCounts);

      // Vadesi yaklaşan işlemler
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const futureDate = new Date();
      futureDate.setDate(now.getDate() + 7);
      futureDate.setHours(23, 59, 59, 999);

      const approaching = transactions.filter(
        (tx) =>
          tx.type === "debt" &&
          tx.dueDate &&
          isSameOrAfter(new Date(tx.dueDate), now) &&
          isSameOrBefore(new Date(tx.dueDate), futureDate)
      );

      console.log(
        "Tüm yaklaşan vadeler (status'ten bağımsız):",
        approaching.length
      );
      console.log(
        "Aktif yaklaşan vadeler:",
        approaching.filter((tx) => tx.status === "active").length
      );
      console.log(
        "Ödenmiş yaklaşan vadeler:",
        approaching.filter((tx) => tx.status === "paid").length
      );
    }
  }
  useEffect(() => {
    if (isOpen) {
      logTransactionStatuses();
    }
  }, [isOpen, transactions]);

  // Navigate to sale detail
  const goToSaleDetail = (saleId: string) => {
    onClose();
    navigate(`/sales/${saleId}`);
  };

  // Load related sales
  useEffect(() => {
    if (isOpen) {
      // Update debug info
      setDebugInfo({
        transactionsLength: transactions.length,
        hasTransactions: transactions.length > 0,
        sortedTransactionsLength: 0,
      });

      if (transactions.length > 0) {
        const loadRelatedSales = async () => {
          try {
            // Find transactions with receipt numbers
            const salesWithReceiptNo = transactions.filter(
              (t) => t.description && t.description.includes("Fiş No:")
            );

            const loadedSales: Record<string, Sale> = {};

            for (const tx of salesWithReceiptNo) {
              try {
                // Extract receipt number
                const match = tx.description.match(/Fiş No: ([A-Z0-9-]+)/);
                if (match && match[1]) {
                  const receiptNo = match[1];

                  // Get all sales and filter by receipt number
                  const allSales = await salesDB.getAllSales();
                  const sale = allSales.find((s) => s.receiptNo === receiptNo);

                  if (sale) {
                    loadedSales[tx.id] = sale;
                  }
                }
              } catch (error) {
                console.error("Satış verileri yüklenirken hata:", error);
              }
            }

            setRelatedSales(loadedSales);
          } catch (error) {
            console.error("İlgili satışlar yüklenirken hata:", error);
          }
        };

        loadRelatedSales();
      }
    }
  }, [isOpen, transactions]);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  };

  const limitUsagePercent = (customer.currentDebt / customer.creditLimit) * 100;
  const activeTransactions = transactions.filter(
    (t) => t.status === "active" || t.status === "overdue"
  );
  const overdueTransactions = transactions.filter(
    (t) => t.status === "overdue"
  );

  // Discounted sales count and total discount amount
  const discountedSales = Object.values(relatedSales).filter(
    (sale) =>
      sale &&
      (sale.discount || (sale.originalTotal && sale.originalTotal > sale.total))
  );

  const totalDiscount = discountedSales.reduce((sum, sale) => {
    const originalAmount = sale.originalTotal || sale.total;
    return sum + (originalAmount - sale.total);
  }, 0);

  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Update debug info for sorted transactions length
  if (debugInfo.sortedTransactionsLength !== sortedTransactions.length) {
    setDebugInfo((prev) => ({
      ...prev,
      sortedTransactionsLength: sortedTransactions.length,
    }));
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all w-full max-w-4xl">
          {/* Header */}
          <div className="px-6 py-3 border-b flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {customer.name}

                {/* Approaching Due Badge - Borç 0 değilse */}
                {customer.currentDebt > 0 &&
                  approachingDueTransactions.length > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                      <Clock size={12} className="mr-1" />
                      {approachingDueTransactions.length} Yaklaşan Vade
                    </span>
                  )}

                {/* Overdue Badge */}
                {overdueTransactions.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                    <AlertTriangle size={12} className="mr-1" />
                    {overdueTransactions.length} Vadesi Geçmiş
                  </span>
                )}
              </h3>
              <div className="text-sm text-gray-500 mt-1">
                {customer.phone}
                {customer.address && ` • ${customer.address}`}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-3">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <DollarSign size={20} />
                  <span>Mevcut Borç</span>
                </div>
                <div className="text-2xl font-semibold text-blue-700">
                  {formatCurrency(customer.currentDebt)}
                </div>
                <div className="text-sm text-blue-600 mt-1">
                  {activeTransactions.length} aktif işlem
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-orange-700 mb-2">
                  <CreditCard size={20} />
                  <span>Limit Kullanımı</span>
                </div>
                <div className="text-2xl font-semibold text-orange-700">
                  %{limitUsagePercent.toFixed(0)}
                </div>
                <div className="text-sm text-orange-600 mt-1">
                  {formatCurrency(customer.creditLimit - customer.currentDebt)}{" "}
                  kullanılabilir
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <AlertTriangle size={20} />
                  <span>Vadesi Geçen</span>
                </div>
                <div className="text-2xl font-semibold text-red-700">
                  {overdueTransactions.length}
                </div>
                <div className="text-sm text-red-600 mt-1">
                  İşlemde vade aşımı
                </div>
              </div>

              {/* Vadesi Yaklaşan Kart */}
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <Clock size={20} />
                  <span>Vadesi Yaklaşan</span>
                </div>
                <div className="text-2xl font-semibold text-amber-700">
                  {customer.currentDebt > 0
                    ? approachingDueTransactions.length
                    : 0}
                </div>
                <div className="text-sm text-amber-600 mt-1">
                  Gelecek 7 gün içinde
                </div>
              </div>
            </div>

            {/* Vadesi Yaklaşan İşlemler Özeti (eğer borç varsa ve yaklaşan vade varsa) */}
            {customer.currentDebt > 0 &&
              approachingDueTransactions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <Clock size={18} />
                    <h3 className="font-medium text-amber-800">
                      Yaklaşan Vadeler
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {approachingDueTransactions
                      .sort(
                        (a, b) =>
                          new Date(a.dueDate!).getTime() -
                          new Date(b.dueDate!).getTime()
                      )
                      .slice(0, 3) // En yakın 3 vadeyi göster
                      .map((tx) => {
                        // Bugün son gün mü kontrolü
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        const dueDate = new Date(tx.dueDate!);
                        const isTodayDue =
                          dueDate.setHours(0, 0, 0, 0) === now.getTime();

                        return (
                          <div
                            key={tx.id}
                            className="flex justify-between items-center"
                          >
                            <div className="flex items-center">
                              {isTodayDue ? (
                                <AlertTriangle
                                  size={14}
                                  className="text-red-600 mr-2"
                                />
                              ) : (
                                <Clock
                                  size={14}
                                  className="text-amber-600 mr-2"
                                />
                              )}
                              <span
                                className={
                                  isTodayDue ? "text-red-800 font-medium" : ""
                                }
                              >
                                {new Date(tx.dueDate!).toLocaleDateString(
                                  "tr-TR"
                                )}
                                {isTodayDue && " (Bugün!)"}
                              </span>
                            </div>
                            <div
                              className={`font-medium ${
                                isTodayDue ? "text-red-800" : "text-amber-800"
                              }`}
                            >
                              {formatCurrency(tx.amount)}
                            </div>
                          </div>
                        );
                      })}

                    {approachingDueTransactions.length > 3 && (
                      <div className="text-xs text-amber-700 mt-1 text-right">
                        +{approachingDueTransactions.length - 3} daha...
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Action Buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => {
                  onClose(); // Önce detay modalını kapat
                  onAddDebt(customer); // Sonra borç ekleme modalını aç
                }}
                disabled={limitUsagePercent >= 100}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DollarSign size={20} />
                Borç Ekle
              </button>
              <button
                onClick={() => {
                  onClose(); // Önce detay modalını kapat
                  onAddPayment(customer); // Sonra ödeme modalını aç
                }}
                disabled={customer.currentDebt === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DollarSign size={20} />
                Ödeme Al
              </button>
            </div>

            {/* Transactions List */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 font-medium">
                İşlem Geçmişi
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {/* Extra check */}
                {!Array.isArray(transactions) && (
                  <div className="p-4 text-center text-red-500">
                    Hata: İşlemler dizisi değil!
                  </div>
                )}

                {Array.isArray(transactions) && transactions.length === 0 && (
                  <div className="p-4 text-center text-gray-500">
                    Henüz işlem bulunmuyor.
                  </div>
                )}

                {Array.isArray(sortedTransactions) &&
                sortedTransactions.length > 0
                  ? sortedTransactions.map((transaction) => {
                      // Related sale data (if exists)
                      const relatedSale = relatedSales[transaction.id];
                      const hasDiscount =
                        relatedSale &&
                        (relatedSale.discount ||
                          (relatedSale.originalTotal &&
                            relatedSale.originalTotal > relatedSale.total));

                      // Vadesi yaklaşan işlem kontrolü
                      const now = new Date();
                      now.setHours(0, 0, 0, 0); // Saat kısmını sıfırlıyoruz

                      const futureDate = new Date();
                      futureDate.setDate(now.getDate() + 7);
                      futureDate.setHours(23, 59, 59, 999); // Günün sonunu temsil etmek için

                      // Bugün son gün mü?
                      const dueDateObj = transaction.dueDate
                        ? new Date(transaction.dueDate)
                        : null;
                      const isTodayDue =
                        dueDateObj &&
                        new Date(dueDateObj).setHours(0, 0, 0, 0) ===
                          now.getTime();

                      // Borç 0 ise yaklaşan vadeleri göstermeyelim
                      const isApproachingDue =
                        customer.currentDebt > 0 &&
                        transaction.type === "debt" &&
                        transaction.status === "active" &&
                        transaction.dueDate &&
                        isSameOrAfter(new Date(transaction.dueDate), now) &&
                        isSameOrBefore(
                          new Date(transaction.dueDate),
                          futureDate
                        );

                      return (
                        <div
                          key={transaction.id}
                          className={`p-4 hover:bg-gray-50 ${
                            transaction.status === "overdue"
                              ? "bg-red-50"
                              : isTodayDue && customer.currentDebt > 0
                              ? "bg-red-50"
                              : isApproachingDue
                              ? "bg-amber-50"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {transaction.type === "debt" ? (
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <ChevronRight
                                    className="text-blue-600"
                                    size={20}
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <CheckCircle
                                    className="text-green-600"
                                    size={20}
                                  />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">
                                  {transaction.type === "debt"
                                    ? "Borç"
                                    : "Ödeme"}
                                  {transaction.status === "paid" && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                      <CheckCircle size={10} className="mr-1" />
                                      Ödendi
                                    </span>
                                  )}

                                  {/* Discount badge - if discount applied */}
                                  {hasDiscount && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                      <Tag size={10} className="mr-1" />
                                      İndirimli
                                    </span>
                                  )}

                                  {/* Vadesi yaklaşan badge - borç 0 değilse ve aktifse */}
                                  {isApproachingDue && (
                                    <span
                                      className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        isTodayDue
                                          ? "bg-red-100 text-red-800"
                                          : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {isTodayDue ? (
                                        <AlertTriangle
                                          size={10}
                                          className="mr-1"
                                        />
                                      ) : (
                                        <Clock size={10} className="mr-1" />
                                      )}
                                      {isTodayDue
                                        ? "Bugün Son Gün!"
                                        : "Vadesi Yaklaşıyor"}
                                    </span>
                                  )}

                                  {/* Vadesi geçmiş badge */}
                                  {transaction.status === "overdue" && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                      <AlertTriangle
                                        size={10}
                                        className="mr-1"
                                      />
                                      Vadesi Geçmiş!
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {transaction.description || "Açıklama yok"}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              {/* Show original amount if discount exists */}
                              {hasDiscount ? (
                                <div>
                                  <div
                                    className={`font-medium ${
                                      transaction.type === "debt"
                                        ? "text-blue-600"
                                        : "text-green-600"
                                    }`}
                                  >
                                    {transaction.type === "debt" ? "+" : "-"}
                                    {formatCurrency(transaction.amount)}
                                  </div>
                                  <div className="text-xs text-gray-500 line-through">
                                    {formatCurrency(
                                      relatedSale.originalTotal || 0
                                    )}
                                  </div>
                                  <div className="text-xs text-green-600">
                                    {relatedSale.discount?.type === "percentage"
                                      ? `%${relatedSale.discount.value} indirim`
                                      : `${formatCurrency(
                                          (relatedSale.originalTotal || 0) -
                                            relatedSale.total
                                        )} indirim`}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`font-medium ${
                                    transaction.type === "debt"
                                      ? "text-blue-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {transaction.type === "debt" ? "+" : "-"}
                                  {formatCurrency(transaction.amount)}
                                </div>
                              )}

                              <div className="text-sm text-gray-500">
                                {new Date(transaction.date).toLocaleDateString(
                                  "tr-TR"
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Due Date Information */}
                          {transaction.dueDate && (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              <Clock
                                size={16}
                                className={`${
                                  transaction.status === "overdue"
                                    ? "text-red-500"
                                    : isTodayDue && customer.currentDebt > 0
                                    ? "text-red-500"
                                    : isApproachingDue
                                    ? "text-amber-500"
                                    : "text-gray-400"
                                }`}
                              />
                              <span className="text-gray-500">Vade:</span>
                              <span
                                className={`font-medium ${
                                  transaction.status === "overdue"
                                    ? "text-red-600"
                                    : isTodayDue && customer.currentDebt > 0
                                    ? "text-red-600"
                                    : isApproachingDue
                                    ? "text-amber-600"
                                    : "text-gray-600"
                                }`}
                              >
                                {new Date(
                                  transaction.dueDate
                                ).toLocaleDateString("tr-TR")}
                                {isTodayDue &&
                                  customer.currentDebt > 0 &&
                                  " (Bugün!)"}
                              </span>
                              {transaction.status === "overdue" ? (
                                <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">
                                  Gecikmiş!
                                </span>
                              ) : isTodayDue && customer.currentDebt > 0 ? (
                                <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">
                                  Son Gün!
                                </span>
                              ) : isApproachingDue ? (
                                <Clock size={16} className="text-amber-500" />
                              ) : null}

                              {/* Ödenmiş Durumu */}
                              {transaction.status === "paid" && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                                  Ödendi
                                </span>
                              )}
                            </div>
                          )}

                          {/* Show product info if related sale exists */}
                          {relatedSale && (
                            <div className="mt-3 bg-gray-50 p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center text-sm font-medium text-gray-700">
                                  <ShoppingBag size={16} className="mr-2" />
                                  Satın Alınan Ürünler (
                                  {relatedSale.items.length})
                                </div>
                                <div
                                  className="text-xs text-blue-600 flex items-center cursor-pointer hover:text-blue-800"
                                  onClick={() => goToSaleDetail(relatedSale.id)}
                                >
                                  <ExternalLink size={12} className="mr-1" />
                                  <span>Satış Detayı</span>
                                </div>
                              </div>

                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {relatedSale.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between text-xs"
                                  >
                                    <div>
                                      <span className="text-gray-600">
                                        {item.quantity}x{" "}
                                      </span>
                                      <span className="text-gray-800">
                                        {item.name}
                                      </span>
                                    </div>
                                    <div className="text-gray-800 font-medium">
                                      {formatCurrency(
                                        item.priceWithVat * item.quantity
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  : // Extra check, sortedTransactions exists but empty
                    Array.isArray(sortedTransactions) &&
                    sortedTransactions.length === 0 &&
                    transactions.length > 0 && (
                      <div className="p-4 text-center text-red-500">
                        Hata: İşlemler sıralanırken bir sorun oluştu!
                      </div>
                    )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailModal;
