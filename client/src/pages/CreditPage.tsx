// pages/CreditPage.tsx

import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Users,
  AlertTriangle,
  CreditCard,
  UserPlus,
  Clock,
} from "lucide-react";
import { Customer, CreditTransaction } from "../types/credit";
import CustomerList from "../components/ui/CustomerList";
import CustomerModal from "../components/modals/CustomerModal";
import TransactionModal from "../components/modals/TransactionModal";
import CustomerDetailModal from "../components/modals/CustomerDetailModal";
import Button from "../components/ui/Button";
import { Pagination } from "../components/ui/Pagination";
import PageLayout from "../components/layout/PageLayout";
import { useAlert } from "../components/AlertProvider";
import { useCustomers } from "../hooks/useCustomers";
import { creditService } from "../services/creditServices";
import { CustomerSummary } from "../types/credit";
import {
  cashRegisterService,
  CashTransactionType,
} from "../services/cashRegisterDB"; // Kasa entegrasyonu için
import Card from "../components/ui/Card";
import FilterPanel from "../components/ui/FilterPanel";
import { normalizedSearch } from "../utils/turkishSearch";

// Yaklaşan vade için gün sayısı (örn: 7 gün içinde vadesi dolacaklar)
const APPROACHING_DUE_DAYS = 7;

const CreditPage: React.FC = () => {
  const { showSuccess, showError, confirm } = useAlert();

  // 1) Müşteri hook'u (tüm müşteri listesi burada geliyor)
  const {
    customers,
    loading: customersLoading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    loadCustomers,
    searchCustomers,
  } = useCustomers();

  // Müşterinin Transaction özetlerini hâlâ sayfa içinde tutabiliriz (ya da custom hook yapabilirsiniz)
  const [summaries, setSummaries] = useState<Record<number, CustomerSummary>>(
    {}
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Müşteri işlemleri için yeni state
  const [customerTransactions, setCustomerTransactions] = useState<
    CreditTransaction[]
  >([]);

  // Tüm işlemleri saklamak için yeni state
  const [allTransactions, setAllTransactions] = useState<Record<number, CreditTransaction[]>>(
    {}
  );

  // Modallar
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<
    Customer | undefined
  >();
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"debt" | "payment">(
    "debt"
  );
  const [selectedTransactionCustomer, setSelectedTransactionCustomer] =
    useState<Customer | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [selectedDetailCustomer, setSelectedDetailCustomer] =
    useState<Customer | null>(null);

  // Sayfalama
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtreler
  const [filters, setFilters] = useState({
    hasOverdue: false,
    hasDebt: false,
    nearLimit: false,
    hasApproachingDue: false, // Yeni filtre: Vadesi yaklaşanlar
  });

  // İstatistikler
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalDebt: 0,
    totalOverdue: 0,
    customersWithOverdue: 0,
    customersWithApproachingDue: 0, // Vadesi yaklaşan müşteri sayısı
  });

  // Veri yükleme: Müşteri summary'leri ve işlemleri
  useEffect(() => {
    const loadSummaries = async () => {
      try {
        // customers state hook'tan geliyor
        const summaryData: Record<number, CustomerSummary> = {};
        const transactionsData: Record<number, CreditTransaction[]> = {};
        let customersWithApproachingDue = 0;

        for (const cust of customers) {
          summaryData[cust.id] = await creditService.getCustomerSummary(
            cust.id
          );
          
          // Müşterinin tüm işlemlerini yükleme
          const transactions = await creditService.getTransactionsByCustomerId(
            cust.id
          );
          transactionsData[cust.id] = transactions;
          
          // Vadesi yaklaşan işlemler
          const now = new Date();
          now.setHours(0, 0, 0, 0); // Sadece tarih kısmını karşılaştırmak için saat kısmını sıfırlıyoruz
          
          const futureDate = new Date();
          futureDate.setDate(now.getDate() + APPROACHING_DUE_DAYS);
          futureDate.setHours(23, 59, 59, 999); // Günün sonunu temsil etmek için
          
          const hasApproachingDue = transactions.some(
            tx => tx.type === 'debt' && 
                 tx.status === 'active' && 
                 tx.dueDate && 
                 isSameOrAfter(new Date(tx.dueDate), now) && 
                 isSameOrBefore(new Date(tx.dueDate), futureDate)
          );
          
          if (hasApproachingDue) {
            customersWithApproachingDue++;
          }
        }
        
        setSummaries(summaryData);
        setAllTransactions(transactionsData);

        // İstatistik hesaplama
        const totalCustomers = customers.length;
        const totalDebt = customers.reduce((sum, c) => sum + c.currentDebt, 0);
        const totalOverdue = Object.values(summaryData).reduce(
          (sum, s) => sum + s.totalOverdue,
          0
        );
        const customersWithOverdue = Object.values(summaryData).filter(
          (s) => s.overdueTransactions > 0
        ).length;

        setStats({
          totalCustomers,
          totalDebt,
          totalOverdue,
          customersWithOverdue,
          customersWithApproachingDue
        });
      } catch (error) {
        console.error("Özet verileri yüklenirken hata:", error);
      }
    };
    if (!customersLoading) {
      loadSummaries();
    }
  }, [customers, customersLoading]);

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
  
  // Yaklaşan vadeleri hesaplama fonksiyonu
  const hasApproachingDueDate = (customerId: number) => {
    const transactions = allTransactions[customerId] || [];
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Saat kısmını sıfırlıyoruz
    
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + APPROACHING_DUE_DAYS);
    futureDate.setHours(23, 59, 59, 999); // Günün sonunu temsil etmek için
    
    return transactions.some(
      tx => tx.type === 'debt' && 
            tx.status === 'active' && 
            tx.dueDate && 
            isSameOrAfter(new Date(tx.dueDate), now) && 
            isSameOrBefore(new Date(tx.dueDate), futureDate)
    );
  };

  // Filtreleme
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    let result = [...customers];

    // Arama - Türkçe karakter desteği ile güncellenmiş kısım
    if (searchQuery) {
      result = result.filter(
        (customer) =>
          normalizedSearch(customer.name, searchQuery) ||
          customer.phone.includes(searchQuery)
      );
    }

    // Ek filtreler
    if (filters.hasOverdue) {
      result = result.filter((c) => summaries[c.id]?.overdueTransactions > 0);
    }
    if (filters.hasDebt) {
      result = result.filter((c) => c.currentDebt > 0);
    }
    if (filters.nearLimit) {
      result = result.filter((c) => c.currentDebt / c.creditLimit > 0.8);
    }
    if (filters.hasApproachingDue) {
      result = result.filter((c) => hasApproachingDueDate(c.id));
    }

    setFilteredCustomers(result);
    setCurrentPage(1);
  }, [customers, searchQuery, filters, summaries, allTransactions]);

  // Sayfalama
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  // Modal işlemleri
  const handleSaveCustomer = async (
    customerData: Omit<Customer, "id" | "currentDebt" | "createdAt">
  ) => {
    try {
      if (selectedCustomer) {
        // güncelle
        const updated = await updateCustomer(selectedCustomer.id, customerData);
        if (!updated) {
          showError("Müşteri güncellenirken hata oluştu");
        }
      } else {
        // ekle
        await addCustomer(customerData);
      }
    } catch (error) {
      console.error("Müşteri kaydedilemedi:", error);
    }
    setShowCustomerModal(false);
    setSelectedCustomer(undefined);
  };

  const handleAddCustomer = () => {
    // Yeni müşteri eklemek için modalı aç
    setSelectedCustomer(undefined);
    setShowCustomerModal(true);
  };

  const handleDeleteCustomer = async (customerId: number) => {
    try {
      const success = await deleteCustomer(customerId);
      if (!success) {
        alert("Borcu olan müşteri silinemez!");
      }
    } catch (error) {
      console.error("Müşteri silinemedi:", error);
    }
  };

  // Borç/Ödeme ekleme
  const handleAddDebt = (customer: Customer) => {
    setSelectedTransactionCustomer(customer);
    setTransactionType("debt");
    setShowTransactionModal(true);
  };

  const handleAddPayment = (customer: Customer) => {
    setSelectedTransactionCustomer(customer);
    setTransactionType("payment");
    setShowTransactionModal(true);
  };

  const handleTransactionSave = async (data: {
    amount: number;
    description: string;
    dueDate?: Date;
  }) => {
    if (!selectedTransactionCustomer) return;
    try {
      // 1. Veresiye işlemini kaydet
      await creditService.addTransaction({
        customerId: selectedTransactionCustomer.id,
        type: transactionType,
        amount: data.amount,
        date: new Date(),
        dueDate: data.dueDate,
        description: data.description,
      });
  
      // 2. Eğer ödeme işlemi ise, kasaya kaydet
      if (transactionType === "payment") {
        try {
          // Aktif kasa dönemi kontrolü
          const activeSession = await cashRegisterService.getActiveSession();
          if (activeSession) {
            // Kasaya nakit girişi olarak ekle
            await cashRegisterService.addCashTransaction(
              activeSession.id,
              CashTransactionType.DEPOSIT,
              data.amount,
              `Veresiye Tahsilatı - ${selectedTransactionCustomer.name}`
            );
            showSuccess("Tahsilat başarıyla kaydedildi ve kasaya işlendi");
          } else {
            // Kasa kapalı uyarısı
            showSuccess(
              "Tahsilat başarıyla kaydedildi, ancak açık kasa dönemli olmadığı için kasaya işlenemedi"
            );
          }
        } catch (cashError) {
          console.error("Kasa kayıt hatası:", cashError);
          showSuccess(
            "Tahsilat başarıyla kaydedildi, ancak kasaya işlenirken bir hata oluştu"
          );
        }
      } else {
        showSuccess("Veresiye borç başarıyla kaydedildi");
      }
  
      // 3. Daha kapsamlı veri yenileme
      await loadCustomers(); 
      
      // Önemli: Tüm işlemleri ve durumları yeniden yükle
      const allCustomerIds = customers.map(c => c.id);
      const allNewTransactions: Record<number, CreditTransaction[]> = {};
      const allNewSummaries: Record<number, CustomerSummary> = {};
      
      for (const id of allCustomerIds) {
        const txs = await creditService.getTransactionsByCustomerId(id);
        allNewTransactions[id] = txs;
        allNewSummaries[id] = await creditService.getCustomerSummary(id);
      }
      
      // Tüm state'leri güncelle
      setAllTransactions(allNewTransactions);
      setSummaries(allNewSummaries);
  
      setShowTransactionModal(false);
      setSelectedTransactionCustomer(null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Bir hata oluştu");
    }
  };

  // Güncellenmiş müşteri detayı görüntüleme fonksiyonu
  const handleViewCustomerDetail = async (customer: Customer) => {
    try {
      // Müşterinin işlemlerini yükle
      const transactions = await creditService.getTransactionsByCustomerId(
        customer.id
      );
      setCustomerTransactions(transactions);

      // Modalı aç
      setSelectedDetailCustomer(customer);
      setShowCustomerDetail(true);
    } catch (error) {
      console.error("Müşteri işlemleri yüklenirken hata:", error);
      showError("Müşteri işlemleri yüklenirken bir hata oluştu");
    }
  };

  // Filtre reset
  const resetFilters = () => {
    setSearchQuery("");
    setFilters({ 
      hasOverdue: false, 
      hasDebt: false, 
      nearLimit: false, 
      hasApproachingDue: false 
    });
    setShowFilters(false);
  };

  return (
    <PageLayout>
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-3">
        <Card
          variant="summary"
          title="Toplam Müşteri"
          value={stats.totalCustomers}
          description="Kayıtlı müşteri sayısı"
          color="gray"
          icon={<Users size={20} />}
        />

        <Card
          variant="summary"
          title="Toplam Borç"
          value={new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
          }).format(stats.totalDebt)}
          description="Toplam müşteri borcu"
          color="blue"
          icon={<DollarSign size={20} />}
        />

        <Card
          variant="summary"
          title="Vadesi Geçen Borç"
          value={new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
          }).format(stats.totalOverdue)}
          description={`${stats.customersWithOverdue} müşteride`}
          color="red"
          icon={<AlertTriangle size={20} />}
        />

        <Card
          variant="summary"
          title="Vadesi Yaklaşan"
          value={stats.customersWithApproachingDue}
          description={`${APPROACHING_DUE_DAYS} gün içinde vadesi dolacak`}
          color="orange"
          icon={<Clock size={20} />}
        />
      </div>

      {/* Arama Barı ve Müşteri Ekleme */}
      <div className="flex flex-col mb-3">
        <div className="bg-white rounded-lg shadow-sm p-3">
          <FilterPanel
            mode="pos"
            searchTerm={searchQuery}
            onSearchTermChange={setSearchQuery}
            onReset={resetFilters}
            showFilter={showFilters}
            toggleFilter={() => setShowFilters((prev) => !prev)}
            searchPlaceholder="Müşteri Adı veya Telefon Ara..."
          />
        </div>

        {/* Ek Filtre Alanı */}
        {showFilters && (
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.hasOverdue}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      hasOverdue: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Vadesi Geçenler</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.hasApproachingDue}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      hasApproachingDue: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-gray-700">Vadesi Yaklaşanlar</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.hasDebt}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      hasDebt: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Borcu Olanlar</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.nearLimit}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      nearLimit: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  Limiti Dolmak Üzere
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Müşteri Listesi */}
      {customersLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <div className="mt-4 text-gray-500">Yükleniyor...</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          {/* Toplam müşteri sayısı ve filtreleme bilgisini gösteren başlık */}
          <div className="p-4 border-b w-full">
            <div className="flex items-center justify-between w-full">
              {/* Sol taraftaki müşteri sayısı bilgisi */}
              <div className="text-sm text-gray-600">
                {filteredCustomers.length > 0 && (
                  <div>{`Toplam ${filteredCustomers.length} müşteri`}</div>
                )}
              </div>

              {/* Sağ taraftaki yeni müşteri butonu */}
              <div className="flex justify-end">
                <Button
                  onClick={handleAddCustomer}
                  variant="primary"
                  icon={UserPlus}
                  className="w-auto whitespace-nowrap py-2 px-3 text-sm h-10"
                >
                  Yeni Müşteri
                </Button>
              </div>
            </div>

            {/* Filtre bilgilerinin gösterilmesi */}
            {(searchQuery ||
              filters.hasOverdue ||
              filters.hasApproachingDue ||
              filters.hasDebt ||
              filters.nearLimit) && (
              <div className="mt-2 text-sm text-gray-500">
                Filtreleniyor:{" "}
                {searchQuery && (
                  <>
                    <span className="text-gray-700">"{searchQuery}"</span>
                    {(filters.hasOverdue ||
                      filters.hasApproachingDue ||
                      filters.hasDebt ||
                      filters.nearLimit) &&
                      " + "}
                  </>
                )}
                {filters.hasOverdue && (
                  <span className="text-gray-700">
                    Vadesi Geçenler
                    {(filters.hasApproachingDue || filters.hasDebt || filters.nearLimit) && ", "}
                  </span>
                )}
                {filters.hasApproachingDue && (
                  <span className="text-gray-700">
                    Vadesi Yaklaşanlar
                    {(filters.hasDebt || filters.nearLimit) && ", "}
                  </span>
                )}
                {filters.hasDebt && (
                  <span className="text-gray-700">
                    Borcu Olanlar
                    {filters.nearLimit && ", "}
                  </span>
                )}
                {filters.nearLimit && (
                  <span className="text-gray-700">Limiti Dolmak Üzere</span>
                )}
              </div>
            )}
          </div>

          <CustomerList
            customers={currentCustomers}
            summaries={summaries}
            transactions={allTransactions}
            onEdit={(customer) => {
              setSelectedCustomer(customer);
              setShowCustomerModal(true);
            }}
            onDelete={handleDeleteCustomer}
            onAddDebt={handleAddDebt}
            onAddPayment={handleAddPayment}
            onViewDetail={handleViewCustomerDetail}
            approachingDueDays={APPROACHING_DUE_DAYS}
          />

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="p-4 border-t"
          />
        </div>
      )}

      {/* Müşteri Modalı */}
      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setSelectedCustomer(undefined);
        }}
        onSave={handleSaveCustomer}
        customer={selectedCustomer}
      />

      {/* İşlem Modalı */}
      {selectedTransactionCustomer && (
        <TransactionModal
          isOpen={showTransactionModal}
          onClose={() => {
            setShowTransactionModal(false);
            setSelectedTransactionCustomer(null);
          }}
          customer={selectedTransactionCustomer}
          type={transactionType}
          onSave={handleTransactionSave}
        />
      )}

      {/* Müşteri Detay Modalı - Güncellenmiş */}
      {selectedDetailCustomer && (
        <CustomerDetailModal
          isOpen={showCustomerDetail}
          onClose={() => {
            setShowCustomerDetail(false);
            setSelectedDetailCustomer(null);
            setCustomerTransactions([]); // Modal kapandığında işlemleri temizle
          }}
          customer={selectedDetailCustomer}
          transactions={customerTransactions} // Yüklenen işlemleri gönder
          onAddDebt={handleAddDebt}
          onAddPayment={handleAddPayment}
        />
      )}
    </PageLayout>
  );
};

export default CreditPage;