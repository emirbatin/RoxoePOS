import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Filter,
  RefreshCw,
  DollarSign,
  Users,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { Customer, CustomerSummary } from "../types/credit";
import { creditService } from "../services/creditServices";
import CustomerList from "../components/CustomerList";
import CustomerModal from "../components/CustomerModal";
import TransactionModal from "../components/TransactionModal";
import CustomerDetailModal from "../components/CustomerDetailModal";

const CreditPage: React.FC = () => {
  // State tanımlamaları
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
  >();
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

  const handleViewCustomerDetail = (customer: Customer) => {
    setSelectedDetailCustomer(customer);
    setShowCustomerDetail(true);
  };

  // Filtre state'leri
  const [filters, setFilters] = useState({
    hasOverdue: false,
    hasDebt: false,
    nearLimit: false,
  });

  // Özet istatistikler
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalDebt: 0,
    totalOverdue: 0,
    customersWithOverdue: 0,
  });

  // Verileri yükle
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Müşterileri yükle
      const allCustomers = creditService.getAllCustomers();
      setCustomers(allCustomers);

      // Müşteri özetlerini yükle
      const summaryData: Record<number, CustomerSummary> = {};
      allCustomers.forEach((customer) => {
        summaryData[customer.id] = creditService.getCustomerSummary(
          customer.id
        );
      });
      setSummaries(summaryData);

      // İstatistikleri hesapla
      const stats = {
        totalCustomers: allCustomers.length,
        totalDebt: allCustomers.reduce((sum, c) => sum + c.currentDebt, 0),
        totalOverdue: Object.values(summaryData).reduce(
          (sum, s) => sum + s.totalOverdue,
          0
        ),
        customersWithOverdue: Object.values(summaryData).filter(
          (s) => s.overdueTransactions > 0
        ).length,
      };
      setStats(stats);
    } catch (error) {
      console.error("Veri yükleme hatası:", error);
    }
    setLoading(false);
  };

  // Filtreleme
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

    // Filtreler
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
  }, [customers, searchQuery, filters, summaries]);

  // Müşteri ekleme/düzenleme
  const handleSaveCustomer = (
    customerData: Omit<Customer, "id" | "currentDebt" | "createdAt">
  ) => {
    if (selectedCustomer) {
      const updatedCustomer = creditService.updateCustomer(
        selectedCustomer.id,
        customerData
      );
      if (updatedCustomer) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === selectedCustomer.id ? updatedCustomer : c))
        );
      }
    } else {
      const newCustomer = creditService.addCustomer(customerData);
      setCustomers((prev) => [...prev, newCustomer]);
    }
    setShowCustomerModal(false);
    setSelectedCustomer(undefined);
  };

  // Müşteri silme
  const handleDeleteCustomer = (customerId: number) => {
    const success = creditService.deleteCustomer(customerId);
    if (success) {
      setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    } else {
      alert("Borcu olan müşteri silinemez!");
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
      const transaction = creditService.addTransaction({
        customerId: selectedTransactionCustomer.id,
        type: transactionType,
        amount: data.amount,
        date: new Date(),
        dueDate: data.dueDate,
        description: data.description,
      });

      // Verileri yeniden yükle
      loadData();
      setShowTransactionModal(false);
      setSelectedTransactionCustomer(null);
    } catch (error) {
      // Hata mesajını göster
      alert(error instanceof Error ? error.message : "Bir hata oluştu");
    }
  };

  return (
    <div className="p-6">
      {/* Üst Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Veresiye</h1>
        <button
          onClick={() => {
            setSelectedCustomer(undefined);
            setShowCustomerModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus size={20} />
          Yeni Müşteri
        </button>
      </div>

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

      {/* Arama ve Filtreler */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          {/* Arama */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Müşteri ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={20}
            />
          </div>

          {/* Filtre Butonları */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg hover:bg-gray-50 ${
              showFilters
                ? "bg-primary-50 border-primary-500 text-primary-600"
                : ""
            }`}
          >
            <Filter size={20} className="text-gray-600" />
          </button>
          <button
            onClick={() => {
              setSearchQuery("");
              setFilters({
                hasOverdue: false,
                hasDebt: false,
                nearLimit: false,
              });
              setShowFilters(false);
            }}
            className="p-2 border rounded-lg hover:bg-gray-50"
            title="Filtreleri Sıfırla"
          >
            <RefreshCw size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Filtreler */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t">
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
                    setFilters((prev) => ({
                      ...prev,
                      hasDebt: e.target.checked,
                    }))
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
                <span className="text-sm text-gray-700">
                  Limiti Dolmak Üzere
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Müşteri Listesi */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <div className="mt-4 text-gray-500">Yükleniyor...</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          <CustomerList
            customers={filteredCustomers}
            summaries={summaries}
            onEdit={(customer) => {
              setSelectedCustomer(customer);
              setShowCustomerModal(true);
            }}
            onDelete={handleDeleteCustomer}
            onAddDebt={handleAddDebt}
            onAddPayment={handleAddPayment}
            onViewDetail={handleViewCustomerDetail} // Bu satırı ekleyelim
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
          transactions={creditService.getTransactionsByCustomerId(
            selectedDetailCustomer.id
          )}
          onAddDebt={handleAddDebt}
          onAddPayment={handleAddPayment}
        />
      )}
    </div>
  );
};

export default CreditPage;
