// pages/CreditPage.tsx

import React, { useState, useEffect } from "react";
import { DollarSign, Users, AlertTriangle, CreditCard } from "lucide-react";
import { Customer } from "../types/credit";
import CustomerList from "../components/ui/CustomerList";
import CustomerModal from "../components/modals/CustomerModal";
import TransactionModal from "../components/modals/TransactionModal";
import CustomerDetailModal from "../components/modals/CustomerDetailModal";
import Button from "../components/ui/Button";
import { Pagination } from "../components/ui/Pagination";
import PageLayout from "../components/layout/PageLayout";
import SearchFilterPanel from "../components/SearchFilterPanel";
import { useAlert } from "../components/AlertProvider";
import { useCustomers } from "../hooks/useCustomers";  // <-- YENİ
import { creditService } from "../services/creditServices"; 
import { CustomerSummary } from "../types/credit";

const CreditPage: React.FC = () => {
  const { showError } = useAlert();

  // 1) Müşteri hook'u (tüm müşteri listesi burada geliyor)
  const {
    customers,
    loading: customersLoading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    loadCustomers,
  } = useCustomers();

  // Müşterinin Transaction özetlerini hâlâ sayfa içinde tutabiliriz (ya da custom hook yapabilirsiniz)
  const [summaries, setSummaries] = useState<Record<number, CustomerSummary>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Modallar
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"debt" | "payment">("debt");
  const [selectedTransactionCustomer, setSelectedTransactionCustomer] = useState<Customer | null>(
    null
  );
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [selectedDetailCustomer, setSelectedDetailCustomer] = useState<Customer | null>(null);

  // Sayfalama
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtreler
  const [filters, setFilters] = useState({
    hasOverdue: false,
    hasDebt: false,
    nearLimit: false,
  });

  // İstatistikler
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalDebt: 0,
    totalOverdue: 0,
    customersWithOverdue: 0,
  });

  // Veri yükleme: Müşteri summary’leri
  useEffect(() => {
    const loadSummaries = async () => {
      try {
        // customers state hook'tan geliyor
        const summaryData: Record<number, CustomerSummary> = {};
        for (const cust of customers) {
          summaryData[cust.id] = await creditService.getCustomerSummary(cust.id);
        }
        setSummaries(summaryData);

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
        });
      } catch (error) {
        console.error("Özet verileri yüklenirken hata:", error);
      }
    };
    if (!customersLoading) {
      loadSummaries();
    }
  }, [customers, customersLoading]);

  // Filtreleme
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    let result = [...customers];

    // Arama
    if (searchQuery) {
      result = result.filter(
        (customer) =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      result = result.filter(
        (c) => c.currentDebt / c.creditLimit > 0.8
      );
    }

    setFilteredCustomers(result);
    setCurrentPage(1);
  }, [customers, searchQuery, filters, summaries]);

  // Sayfalama
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
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
      await creditService.addTransaction({
        customerId: selectedTransactionCustomer.id,
        type: transactionType,
        amount: data.amount,
        date: new Date(),
        dueDate: data.dueDate,
        description: data.description,
      });
      // Tekrar verileri yenile
      loadCustomers();
      setShowTransactionModal(false);
      setSelectedTransactionCustomer(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Bir hata oluştu");
    }
  };

  const handleViewCustomerDetail = (customer: Customer) => {
    setSelectedDetailCustomer(customer);
    setShowCustomerDetail(true);
  };

  // Filtre reset
  const resetFilters = () => {
    setSearchQuery("");
    setFilters({ hasOverdue: false, hasDebt: false, nearLimit: false });
    setShowFilters(false);
  };

  return (
    <PageLayout title="Veresiye">
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Users size={20} />
            <span>Toplam Müşteri</span>
          </div>
          <div className="text-2xl font-semibold">{stats.totalCustomers}</div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <DollarSign size={20} />
            <span>Toplam Borç</span>
          </div>
          <div className="text-2xl font-semibold text-blue-600">
            {new Intl.NumberFormat("tr-TR", {
              style: "currency",
              currency: "TRY",
            }).format(stats.totalDebt)}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle size={20} />
            <span>Vadesi Geçen Borç</span>
          </div>
          <div className="text-2xl font-semibold text-red-600">
            {new Intl.NumberFormat("tr-TR", {
              style: "currency",
              currency: "TRY",
            }).format(stats.totalOverdue)}
          </div>
          <div className="text-sm text-gray-500">
            {stats.customersWithOverdue} müşteride
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <CreditCard size={20} />
            <span>Ortalama Limit Kullanımı</span>
          </div>
          <div className="text-2xl font-semibold text-orange-600">
            {stats.totalCustomers
              ? `%${(
                  (stats.totalDebt /
                    customers.reduce((sum, c) => sum + c.creditLimit, 0)) *
                  100
                ).toFixed(0)}`
              : "%0"}
          </div>
        </div>
      </div>

      {/* Arama Barı */}
      <SearchFilterPanel
        searchTerm={searchQuery}
        onSearchTermChange={setSearchQuery}
        onReset={resetFilters}
        showFilter={showFilters}
        toggleFilter={() => setShowFilters((prev) => !prev)}
      />

      {/* Ek Filtre Alanı */}
      {showFilters && (
        <div className="p-4 border rounded-lg bg-white mb-6">
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
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Vadesi Geçenler</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.hasDebt}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, hasDebt: e.target.checked }))
                }
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
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
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Limiti Dolmak Üzere</span>
            </label>
          </div>
        </div>
      )}

      {/* Müşteri Listesi */}
      {customersLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <div className="mt-4 text-gray-500">Yükleniyor...</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          <CustomerList
            customers={currentCustomers}
            summaries={summaries}
            onEdit={(customer) => {
              setSelectedCustomer(customer);
              setShowCustomerModal(true);
            }}
            onDelete={handleDeleteCustomer}
            onAddDebt={handleAddDebt}
            onAddPayment={handleAddPayment}
            onViewDetail={handleViewCustomerDetail}
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

      {/* Müşteri Detay Modalı */}
      {selectedDetailCustomer && (
        <CustomerDetailModal
          isOpen={showCustomerDetail}
          onClose={() => {
            setShowCustomerDetail(false);
            setSelectedDetailCustomer(null);
          }}
          customer={selectedDetailCustomer}
          transactions={[]} // lazımsa ekleyin
          onAddDebt={handleAddDebt}
          onAddPayment={handleAddPayment}
        />
      )}
    </PageLayout>
  );
};

export default CreditPage;