import React, { useState, useEffect } from "react";
import {
  Calendar,
  DollarSign,
  CreditCard,
  FileText,
  ArrowUp,
  ArrowDown,
  Plus,
  AlertTriangle,
  UserCheck,
  Info,
} from "lucide-react";
import PageLayout from "../components/layout/PageLayout";
import { useAlert } from "../components/AlertProvider";
import { formatCurrency } from "../utils/vatUtils";
import { CashRegisterStatus, CashTransactionType } from "../types/cashRegister";
import { cashRegisterService } from "../services/cashRegisterDB";
import { creditService } from "../services/creditServices";
import eventBus from "../utils/eventBus";

//Kasa bakiyesine toplam eklenecek.
//stoklarda toplam stok gözüksün

const CashRegisterPage: React.FC = () => {
  const { showSuccess, showError, confirm } = useAlert();

  // Cash register status states
  const [registerStatus, setRegisterStatus] = useState<CashRegisterStatus>(
    CashRegisterStatus.CLOSED
  );
  const [sessionId, setSessionId] = useState<string>("");
  const [openingDate, setOpeningDate] = useState<Date | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // Day sales information
  const [dailyCashSales, setDailyCashSales] = useState<number>(0);
  const [dailyCardSales, setDailyCardSales] = useState<number>(0);
  const [cashWithdrawals, setCashWithdrawals] = useState<number>(0);
  const [cashDeposits, setCashDeposits] = useState<number>(0);

  // End of day cash register calculations
  const [countingAmount, setCountingAmount] = useState<number>(0);
  const [countingDifference, setCountingDifference] = useState<number>(0);

  // Opening balance input state
  const [newOpeningBalance, setNewOpeningBalance] = useState<string>("");

  // Cash transaction modal states
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showWithdrawalModal, setShowWithdrawalModal] =
    useState<boolean>(false);
  const [transactionAmount, setTransactionAmount] = useState<string>("");
  const [transactionDescription, setTransactionDescription] =
    useState<string>("");

  // Cash counting modal
  const [showCountingModal, setShowCountingModal] = useState<boolean>(false);
  const [countingInputAmount, setCountingInputAmount] = useState<string>("");

  // Transaction history
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Veresiye tahsilatı için yeni state'ler
  const [showCreditCollectionModal, setShowCreditCollectionModal] =
    useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);

  const [dailyProfit, setDailyProfit] = useState<number>(0); // Günlük kâr
  const [isProfitable, setIsProfitable] = useState<boolean>(true); // Kârlı mı?

  // Load active cash register session on page load
  useEffect(() => {
    const loadCashRegister = async () => {
      setIsLoading(true);
      try {
        const activeSession = await cashRegisterService.getActiveSession();
        if (activeSession) {
          // Kasa açıksa bilgileri yükle
          setRegisterStatus(CashRegisterStatus.OPEN);
          setSessionId(activeSession.id);
          setOpeningDate(new Date(activeSession.openingDate));
          setOpeningBalance(activeSession.openingBalance);
          setDailyCashSales(activeSession.cashSalesTotal);
          setDailyCardSales(activeSession.cardSalesTotal);
          setCashDeposits(activeSession.cashDepositTotal);
          setCashWithdrawals(activeSession.cashWithdrawalTotal);

          if (activeSession.countingAmount !== undefined) {
            setCountingAmount(activeSession.countingAmount);
            setCountingDifference(activeSession.countingDifference ?? 0);
          }

          // İşlem geçmişini yükle
          const sessionDetails = await cashRegisterService.getSessionDetails(
            activeSession.id
          );
          setTransactions(sessionDetails.transactions);
        } else {
          // Kasa kapalıysa durumu ayarla
          setRegisterStatus(CashRegisterStatus.CLOSED);
        }
      } catch (error) {
        console.error("Kasa bilgileri yüklenirken hata:", error);
        showError("Kasa bilgileri yüklenirken bir hata oluştu!");
      } finally {
        setIsLoading(false);
      }
    };

    loadCashRegister();
  }, [showError]);

  // Müşteri listesini yükleme
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const customersList = await creditService.getAllCustomers();
        setCustomers(customersList);
      } catch (error) {
        console.error("Müşteriler yüklenirken hata:", error);
        showError("Müşteri listesi yüklenirken bir hata oluştu!");
      }
    };

    loadCustomers();
  }, [showError]);

  // Dynamic cash register information
  const theoreticalBalance = openingBalance + dailyCashSales + cashDeposits - cashWithdrawals;
  // openingBalance + dailyCashSales + cashDeposits - cashWithdrawals; eski hali geri dönmek gerekirse diye.
  const dailyTotalSales =
    dailyCashSales + dailyCardSales - cashWithdrawals + cashDeposits;
  //dailyCashSales + dailyCardSales eski hali geri dönmek gerekirse diye.

  // Open cash register
  const handleOpenRegister = async () => {
    if (
      !newOpeningBalance ||
      isNaN(parseFloat(newOpeningBalance)) ||
      parseFloat(newOpeningBalance) < 0
    ) {
      showError("Lütfen geçerli bir açılış bakiyesi girin");
      return;
    }

    try {
      // Kasayı aç
      const session = await cashRegisterService.openRegister(
        parseFloat(newOpeningBalance)
      );

      // YENİ: EventBus ile kasa açılış olayını yayınla
      eventBus.emit("cashRegisterOpened", {
        openingBalance: session.openingBalance,
        sessionId: session.id,
      });

      // UI güncelleme
      setRegisterStatus(CashRegisterStatus.OPEN);
      setSessionId(session.id);
      setOpeningDate(new Date(session.openingDate));
      setOpeningBalance(session.openingBalance);
      setDailyCashSales(0);
      setDailyCardSales(0);
      setCashWithdrawals(0);
      setCashDeposits(0);
      setNewOpeningBalance("");
      setTransactions([]);

      showSuccess("Kasa başarıyla açıldı");
    } catch (error) {
      console.error("Kasa açılırken hata:", error);
      showError("Kasa açılırken bir hata oluştu!");
    }
  };

  // Cash deposit transaction
  const handleCashDeposit = async () => {
    if (
      !transactionAmount ||
      isNaN(parseFloat(transactionAmount)) ||
      parseFloat(transactionAmount) <= 0
    ) {
      showError("Lütfen geçerli bir tutar girin");
      return;
    }

    try {
      // Nakit giriş işlemi ekle
      await cashRegisterService.addCashTransaction(
        sessionId,
        CashTransactionType.DEPOSIT,
        parseFloat(transactionAmount),
        transactionDescription || "Nakit Giriş"
      );

      // UI güncelleme
      setCashDeposits((prev) => prev + parseFloat(transactionAmount));

      // İşlem geçmişini yenile
      const sessionDetails = await cashRegisterService.getSessionDetails(
        sessionId
      );
      setTransactions(sessionDetails.transactions);

      showSuccess(
        `${formatCurrency(
          parseFloat(transactionAmount)
        )} nakit giriş kaydedildi`
      );

      // Modal kapatma ve form temizleme
      setShowDepositModal(false);
      setTransactionAmount("");
      setTransactionDescription("");
    } catch (error) {
      console.error("Nakit giriş eklenirken hata:", error);
      showError("Nakit giriş eklenirken bir hata oluştu!");
    }
  };

  // Cash withdrawal transaction
  const handleCashWithdrawal = async () => {
    if (
      !transactionAmount ||
      isNaN(parseFloat(transactionAmount)) ||
      parseFloat(transactionAmount) <= 0
    ) {
      showError("Lütfen geçerli bir tutar girin");
      return;
    }

    // Amount control
    if (parseFloat(transactionAmount) > theoreticalBalance) {
      showError("Kasada yeterli nakit yok");
      return;
    }

    try {
      // Nakit çıkış işlemi ekle
      await cashRegisterService.addCashTransaction(
        sessionId,
        CashTransactionType.WITHDRAWAL,
        parseFloat(transactionAmount),
        transactionDescription || "Nakit Çıkış"
      );

      // UI güncelleme
      setCashWithdrawals((prev) => prev + parseFloat(transactionAmount));

      // İşlem geçmişini yenile
      const sessionDetails = await cashRegisterService.getSessionDetails(
        sessionId
      );
      setTransactions(sessionDetails.transactions);

      showSuccess(
        `${formatCurrency(
          parseFloat(transactionAmount)
        )} nakit çıkış kaydedildi`
      );

      // Modal kapatma ve form temizleme
      setShowWithdrawalModal(false);
      setTransactionAmount("");
      setTransactionDescription("");
    } catch (error) {
      console.error("Nakit çıkış eklenirken hata:", error);
      showError("Nakit çıkış eklenirken bir hata oluştu!");
    }
  };

  // Veresiye tahsilatı işlemi
  const handleCreditCollection = async () => {
    if (!selectedCustomer) {
      showError("Lütfen bir müşteri seçin");
      return;
    }

    if (
      !transactionAmount ||
      isNaN(parseFloat(transactionAmount)) ||
      parseFloat(transactionAmount) <= 0
    ) {
      showError("Lütfen geçerli bir tutar girin");
      return;
    }

    try {
      const amount = parseFloat(transactionAmount);

      // 1. Kasa nakit girişi ekle
      await cashRegisterService.addCashTransaction(
        sessionId,
        CashTransactionType.DEPOSIT,
        amount,
        `Veresiye Tahsilatı - ${selectedCustomer.name}`
      );

      // 2. Müşteri borcunu azalt
      await creditService.addTransaction({
        customerId: selectedCustomer.id,
        type: "payment",
        amount: amount,
        date: new Date(),
        description: `Kasa Tahsilatı - ${new Date().toLocaleString("tr-TR")}`,
      });

      // 3. UI güncelleme
      setCashDeposits((prev) => prev + amount);

      // İşlem geçmişini yenile
      const sessionDetails = await cashRegisterService.getSessionDetails(
        sessionId
      );
      setTransactions(sessionDetails.transactions);

      showSuccess(`${formatCurrency(amount)} veresiye tahsilatı kaydedildi`);

      // Modal kapatma ve form temizleme
      setShowCreditCollectionModal(false);
      setTransactionAmount("");
      setTransactionDescription("");
      setSelectedCustomer(null);
    } catch (error) {
      console.error("Veresiye tahsilatı sırasında hata:", error);
      showError("Veresiye tahsilatı sırasında bir hata oluştu!");
    }
  };

  // Cash counting
  const handleCounting = async () => {
    if (!countingInputAmount || isNaN(parseFloat(countingInputAmount))) {
      showError("Lütfen geçerli bir tutar girin");
      return;
    }

    try {
      // Kasa sayım işlemi kaydet
      const updatedSession = await cashRegisterService.saveCounting(
        sessionId,
        parseFloat(countingInputAmount)
      );

      // UI güncelleme
      setCountingAmount(updatedSession.countingAmount ?? 0);
      setCountingDifference(updatedSession.countingDifference ?? 0);

      setShowCountingModal(false);
      showSuccess("Kasa sayımı kaydedildi");
    } catch (error) {
      console.error("Kasa sayımı kaydedilirken hata:", error);
      showError("Kasa sayımı kaydedilirken bir hata oluştu!");
    }
  };

  // Close day
  const handleCloseDay = async () => {
    // User confirmation
    const confirmed = await confirm(
      "Günü kapatmak istediğinize emin misiniz? Bu işlem geri alınamaz."
    );

    if (!confirmed) return;

    // Warning if no counting
    if (countingAmount === 0) {
      const proceedWithoutCounting = await confirm(
        "Kasa sayımı yapılmamış. Sayım yapmadan devam etmek istiyor musunuz?"
      );
      if (!proceedWithoutCounting) {
        setShowCountingModal(true);
        return;
      }
    }

    try {
      // Günü kapat
      await cashRegisterService.closeRegister(sessionId);

      // YENI: Kasa verilerine göre yüksek satış olup olmadığını belirle
      // Örnek olarak 1000 TL üzeri satışı yüksek sayalım, bunu kendi işletmenize göre ayarlayabilirsiniz
      const highSalesThreshold = 1000; // TL
      const isHighSales = dailyTotalSales > highSalesThreshold;

      // YENI: Zarar durumunu tespit etme mantığı
      // Zarar durumunu belirlemek için şu kriterleri kullanabiliriz:

      // 1. Negatif sayım farkı büyükse (kasadan para eksilmişse)
      const hasSignificantNegativeDifference = countingDifference < -50; // 50 TL'den fazla eksikse

      // 2. Hiç satış yoksa veya çok düşükse
      const lowSalesThreshold = 100; // TL
      const hasNoOrLowSales = dailyTotalSales < lowSalesThreshold;

      // 3. Toplam nakit çıkış, nakit girişten fazlaysa (net nakit kaybı)
      const netCashFlow = dailyCashSales + cashDeposits - cashWithdrawals;
      const hasNegativeCashFlow = netCashFlow < 0;

      // Bu koşullardan en az biri doğruysa "zarar" durumu olarak kabul edelim
      const isLossMaking =
        hasSignificantNegativeDifference ||
        (hasNoOrLowSales && hasNegativeCashFlow);

      // YENI: EventBus ile kasa kapanış verisini gönder
      eventBus.emit("cashRegisterClosed", {
        totalSales: dailyTotalSales,
        cashSales: dailyCashSales,
        cardSales: dailyCardSales,
        countingDifference: countingDifference,
        theoreticalBalance: theoreticalBalance,
        isHighSales: isHighSales,
        isLossMaking: isLossMaking, // Zarar durumunu da gönder
      });

      // UI güncelleme
      showSuccess("Gün başarıyla kapatıldı. Kasa raporu oluşturuldu.");
      setRegisterStatus(CashRegisterStatus.CLOSED);

      // Değerleri sıfırla
      setSessionId("");
      setOpeningDate(null);
      setOpeningBalance(0);
      setDailyCashSales(0);
      setDailyCardSales(0);
      setCashWithdrawals(0);
      setCashDeposits(0);
      setCountingAmount(0);
      setCountingDifference(0);
      setTransactions([]);
    } catch (error) {
      console.error("Gün kapatılırken hata:", error);
      showError("Gün kapatılırken bir hata oluştu!");
    }
  };

  // Test simulation
  const simulateSale = async (type: "cash" | "card", amount: number) => {
    try {
      // Gerçek bir satış kaydeder
      await cashRegisterService.recordSale(
        type === "cash" ? amount : 0,
        type === "card" ? amount : 0
      );

      // UI güncelleme
      if (type === "cash") {
        setDailyCashSales((prev) => prev + amount);
      } else {
        setDailyCardSales((prev) => prev + amount);
      }

      showSuccess(
        `${formatCurrency(amount)} tutarında ${
          type === "cash" ? "nakit" : "kart"
        } satış eklendi`
      );
    } catch (error) {
      console.error("Test satış simülasyonu hatası:", error);
      showError("Satış simülasyonu sırasında bir hata oluştu!");
    }
  };

  // Modal contents
  const renderDepositModal = () => (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${
        showDepositModal ? "block" : "hidden"
      }`}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Nakit Giriş Ekle</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tutar
            </label>
            <input
              type="number"
              className="w-full p-2 border rounded-lg"
              placeholder="0.00"
              onWheel={(e) => e.currentTarget.blur()}
              value={transactionAmount}
              onChange={(e) => setTransactionAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded-lg"
              placeholder="Açıklama girin"
              onWheel={(e) => e.currentTarget.blur()}
              value={transactionDescription}
              onChange={(e) => setTransactionDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowDepositModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleCashDeposit}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderWithdrawalModal = () => (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${
        showWithdrawalModal ? "block" : "hidden"
      }`}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Nakit Çıkış Ekle</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tutar
            </label>
            <input
              type="number"
              className="w-full p-2 border rounded-lg"
              placeholder="0.00"
              onWheel={(e) => e.currentTarget.blur()}
              value={transactionAmount}
              onChange={(e) => setTransactionAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded-lg"
              placeholder="Açıklama girin"
              value={transactionDescription}
              onChange={(e) => setTransactionDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowWithdrawalModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleCashWithdrawal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Veresiye Tahsilatı Modalı
  const renderCreditCollectionModal = () => (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${
        showCreditCollectionModal ? "block" : "hidden"
      }`}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Veresiye Tahsilatı</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Müşteri Seçin
            </label>
            <select
              className="w-full p-2 border rounded-lg"
              value={selectedCustomer?.id || ""}
              onChange={(e) => {
                const customerId = e.target.value;
                const customer = customers.find(
                  (c) => c.id.toString() === customerId
                );
                setSelectedCustomer(customer || null);
              }}
            >
              <option value="">Müşteri Seçin</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} (Borç: {formatCurrency(customer.currentDebt)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tahsilat Tutarı
            </label>
            <input
              type="number"
              className="w-full p-2 border rounded-lg"
              placeholder="0.00"
              onWheel={(e) => e.currentTarget.blur()}
              value={transactionAmount}
              onChange={(e) => setTransactionAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded-lg"
              placeholder="Açıklama girin (opsiyonel)"
              value={transactionDescription}
              onChange={(e) => setTransactionDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowCreditCollectionModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleCreditCollection}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Tahsilat Yap
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCountingModal = () => (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${
        showCountingModal ? "block" : "hidden"
      }`}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Kasa Sayımı</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sayılan Nakit Tutar
            </label>
            <input
              type="number"
              className="w-full p-2 border rounded-lg"
              placeholder="0.00"
              value={countingInputAmount}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => setCountingInputAmount(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500">
            <p>Teorik Kasa Bakiyesi: {formatCurrency(theoreticalBalance)}</p>
            <p>Bu bakiye ile sayımınız arasındaki fark hesaplanacaktır.</p>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowCountingModal(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleCounting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-3">
        {/* Cash Register Status Card */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">Kasa Durumu</h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                registerStatus === CashRegisterStatus.OPEN
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {registerStatus}
            </span>
          </div>

          {registerStatus === CashRegisterStatus.CLOSED ? (
            // Show when register is closed
            <div className="space-y-4">
              <p className="text-gray-600">
                Kasayı açmak için açılış bakiyesi girin.
              </p>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Açılış Bakiyesi
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full p-2 border rounded-lg"
                    value={newOpeningBalance}
                    onChange={(e) => setNewOpeningBalance(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <button
                  onClick={handleOpenRegister}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Kasa Aç
                </button>
              </div>
            </div>
          ) : (
            // Show when register is open
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-500">Açılış Tarihi</span>
                    <span>{openingDate?.toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-500">Açılış Bakiyesi</span>
                    <span className="font-medium">
                      {formatCurrency(openingBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-500">Nakit Satışlar</span>
                    <span className="text-green-600 font-medium">
                      +{formatCurrency(dailyCashSales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-500">Kart Satışlar</span>
                    <span className="text-green-600 font-medium">
                      +{formatCurrency(dailyCardSales)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-500">Nakit Girişler</span>
                    <span className="text-green-600 font-medium">
                      +{formatCurrency(cashDeposits)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-500">Nakit Çıkışlar</span>
                    <span className="text-red-600 font-medium">
                      -{formatCurrency(cashWithdrawals)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center gap-1 text-gray-500">
                      Teorik Kasa Bakiyesi
                      <div className="relative group">
                        <Info size={16} className="text-gray-400 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-gray-800/75 text-white text-xs rounded p-2 w-48">
                          Kasa Bakiyesi: Açılış bakiyesi sayılmaksızın kasaya giren ve çıkan net parayı gösterir.
                        </div>
                      </div>
                    </span>
                    <span className="font-medium">
                      {formatCurrency(theoreticalBalance)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center gap-1 text-gray-500">
                      Toplam Satış Bakiyesi
                      <div className="relative group">
                        <Info size={16} className="text-gray-400 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-gray-800/75 text-white text-xs rounded p-2 w-48">
                          Net satış hesaplaması: Nakit ve Kart satışları
                          toplamıyla beraber nakit giriş ve çıkış işlemleri
                          hesaplanmış şekilde gösterir.
                        </div>
                      </div>
                    </span>
                    <span className="font-medium">
                      {formatCurrency(dailyTotalSales)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cash counting results (if exists) */}
              {countingAmount > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border mt-4">
                  <h3 className="font-medium mb-2">Kasa Sayımı</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Sayılan Nakit</span>
                      <span className="font-medium">
                        {formatCurrency(countingAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Teorik Bakiye</span>
                      <span className="font-medium">
                        {formatCurrency(theoreticalBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Fark</span>
                      <span
                        className={`font-medium ${
                          countingDifference < 0
                            ? "text-red-600"
                            : countingDifference > 0
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
                        {countingDifference > 0 && "+"}
                        {formatCurrency(countingDifference)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-end mt-4">
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <ArrowDown size={16} />
                  Nakit Giriş
                </button>
                <button
                  onClick={() => setShowWithdrawalModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <ArrowUp size={16} />
                  Nakit Çıkış
                </button>
                {/* Veresiye Tahsilatı Butonu */}
                <button
                  onClick={() => setShowCreditCollectionModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <UserCheck size={16} />
                  Veresiye Tahsilatı
                </button>
                <button
                  onClick={() => setShowCountingModal(true)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
                >
                  <DollarSign size={16} />
                  Kasa Sayım
                </button>
                <button
                  onClick={handleCloseDay}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <FileText size={16} />
                  Günü Kapat
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-3">İşlem Geçmişi</h2>
          {registerStatus === CashRegisterStatus.OPEN ? (
            <div className="space-y-2">
              {openingDate && (
                <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border-b">
                  <div>
                    <div className="font-medium">Kasa Açılış</div>
                    <div className="text-xs text-gray-500">
                      {openingDate.toLocaleString("tr-TR")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(openingBalance)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Başlangıç Bakiyesi
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction list with veresiye highlighting */}
              {transactions.length > 0 ? (
                <div className="max-h-80 overflow-y-auto">
                  {transactions.map((transaction, index) => (
                    <div
                      key={index}
                      className={`flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border-b ${
                        transaction.description?.includes("Veresiye Tahsilatı")
                          ? "bg-purple-50"
                          : ""
                      }`}
                    >
                      <div>
                        <div className="font-medium">
                          {transaction.type === CashTransactionType.DEPOSIT
                            ? "Nakit Giriş"
                            : "Nakit Çıkış"}
                          {transaction.description
                            ? ` - ${transaction.description}`
                            : ""}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(transaction.date).toLocaleString("tr-TR")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-medium ${
                            transaction.type === CashTransactionType.DEPOSIT
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {transaction.type === CashTransactionType.DEPOSIT
                            ? "+"
                            : "-"}
                          {formatCurrency(transaction.amount)}
                        </div>
                        {/* Veresiye işlemlerine özel ek bilgi */}
                        {transaction.description?.includes(
                          "Veresiye Tahsilatı"
                        ) && (
                          <div className="text-xs text-purple-600">
                            Veresiye Tahsilatı
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-3">
                  Henüz işlem bulunmuyor.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-6">
              Kasa kapalı. İşlem geçmişi görüntülemek için kasayı açın.
            </div>
          )}
        </div>

        {/* TEST CONTROL PANEL - WILL BE DELETED IN REAL IMPLEMENTATION 
        {registerStatus === CashRegisterStatus.OPEN && (
          <div className="bg-gray-100 rounded-lg border border-gray-300 p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle size={20} className="text-yellow-500 mr-2" />
              <h3 className="text-lg font-medium">Test Kontrol Paneli</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Bu panel sadece test amaçlıdır ve gerçek uygulamada yer
              almayacaktır.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => simulateSale("cash", 50)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
              >
                +50₺ Nakit Satış Ekle
              </button>
              <button
                onClick={() => simulateSale("cash", 100)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
              >
                +100₺ Nakit Satış Ekle
              </button>
              <button
                onClick={() => simulateSale("card", 75)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
              >
                +75₺ Kart Satış Ekle
              </button>
              <button
                onClick={() => simulateSale("card", 150)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
              >
                +150₺ Kart Satış Ekle
              </button>
            </div>
          </div>
          
        )}
          */}
      </div>

      {/* Modals */}
      {renderDepositModal()}
      {renderWithdrawalModal()}
      {renderCreditCollectionModal()}
      {renderCountingModal()}
    </PageLayout>
  );
};

export default CashRegisterPage;
