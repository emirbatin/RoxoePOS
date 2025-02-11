// CreditPage.tsx
import React, { useState, useEffect } from "react";
import { DollarSign, Users, AlertTriangle, CreditCard } from "lucide-react";
import { Customer, CustomerSummary } from "../types/credit";
import { creditService } from "../services/creditServices";
import CustomerList from "../components/ui/CustomerList";
import CustomerModal from "../components/modals/CustomerModal";
import TransactionModal from "../components/modals/TransactionModal";
import CustomerDetailModal from "../components/modals/CustomerDetailModal";
import Button from "../components/ui/Button";
import { Pagination } from "../components/ui/Pagination";
import PageLayout from "../components/layout/PageLayout";
import SearchFilterPanel from "../components/SearchFilterPanel";

const CreditPage: React.FC = () => {
  // Temel state tanımlamaları
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [summaries, setSummaries] = useState<Record<number, CustomerSummary>>(
    {}
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<
    Customer | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"debt" | "payment">(
    "debt"
  );
  const [selectedTransactionCustomer, setSelectedTransactionCustomer] =
    useState<Customer | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [selectedDetailCustomer, setSelectedDetailCustomer] =
    useState<Customer | null>(null);

  // Pagination için state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Ek filtreler: vadesi geçen, borcu olan, limiti dolmak üzere
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

  // Veri yükleme
  const loadData = async () => {
    setLoading(true);
    try {
      // Tüm müşterileri yükle
      const allCustomers = await creditService.getAllCustomers();
      setCustomers(allCustomers);

      // Her müşteri için özet bilgileri yükle
      const summaryData: Record<number, CustomerSummary> = {};
      for (const customer of allCustomers) {
        summaryData[customer.id] = await creditService.getCustomerSummary(
          customer.id
        );
      }
      setSummaries(summaryData);

      // İstatistik hesaplamaları
      const totalCustomers = allCustomers.length;
      const totalDebt = allCustomers.reduce((sum, c) => sum + c.currentDebt, 0);
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
      console.error("Veri yükleme hatası:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtreleme işlemi: arama ve ek filtreler
  useEffect(() => {
    let result = [...customers];

    if (searchQuery) {
      result = result.filter(
        (customer) =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(searchQuery)
      );
    }

    if (filters.hasOverdue) {
      result = result.filter(
        (customer) => summaries[customer.id]?.overdueTransactions > 0
      );
    }
    if (filters.hasDebt) {
      result = result.filter((customer) => customer.currentDebt > 0);
    }
    if (filters.nearLimit) {
      result = result.filter(
        (customer) => customer.currentDebt / customer.creditLimit > 0.8
      );
    }

    setFilteredCustomers(result);
    setCurrentPage(1);
  }, [customers, searchQuery, filters, summaries]);

  // Sayfalama hesaplamaları
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  // Müşteri ekleme/düzenleme
  const handleSaveCustomer = async (
    customerData: Omit<Customer, "id" | "currentDebt" | "createdAt">
  ) => {
    try {
      if (selectedCustomer) {
        const updatedCustomer = await creditService.updateCustomer(
          selectedCustomer.id,
          customerData
        );
        if (updatedCustomer) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === selectedCustomer.id ? updatedCustomer : c
            )
          );
        }
      } else {
        const newCustomer = await creditService.addCustomer(customerData);
        setCustomers((prev) => [...prev, newCustomer]);
      }
    } catch (error) {
      console.error("Müşteri kaydedilemedi:", error);
    }
    setShowCustomerModal(false);
    setSelectedCustomer(undefined);
  };

  // Müşteri silme
  const handleDeleteCustomer = async (customerId: number) => {
    try {
      const success = await creditService.deleteCustomer(customerId);
      if (success) {
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      } else {
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
      loadData();
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
        onReset={() => {
          setSearchQuery("");
          setFilters({ hasOverdue: false, hasDebt: false, nearLimit: false });
          setShowFilters(false);
        }}
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
      {loading ? (
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
          transactions={[]}
          onAddDebt={handleAddDebt}
          onAddPayment={handleAddPayment}
        />
      )}
    </PageLayout>
  );
};

export default CreditPage;
