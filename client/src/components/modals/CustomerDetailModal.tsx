import React from 'react';
import { 
  X, 
  CreditCard, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  AlertCircle 
} from 'lucide-react';
import { Customer, CreditTransaction } from '../../types/credit';

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
  onAddPayment
}) => {
  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: 'TRY' 
    }).format(amount);
  };

  const limitUsagePercent = (customer.currentDebt / customer.creditLimit) * 100;
  const activeTransactions = transactions.filter(t => t.status === 'active' || t.status === 'overdue');
  const overdueTransactions = transactions.filter(t => t.status === 'overdue');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all w-full max-w-4xl">
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {customer.name}
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
          <div className="px-6 py-4">
            {/* Özet Kartları */}
            <div className="grid grid-cols-3 gap-4 mb-6">
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
                  {formatCurrency(customer.creditLimit - customer.currentDebt)} kullanılabilir
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
            </div>

            {/* İşlem Butonları */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => onAddDebt(customer)}
                disabled={limitUsagePercent >= 100}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DollarSign size={20} />
                Borç Ekle
              </button>
              <button
                onClick={() => onAddPayment(customer)}
                disabled={customer.currentDebt === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DollarSign size={20} />
                Ödeme Al
              </button>
            </div>

            {/* İşlem Listesi */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 font-medium">
                İşlem Geçmişi
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {transactions.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Henüz işlem bulunmuyor.
                  </div>
                ) : (
                  transactions.map((transaction) => (
                    <div 
                      key={transaction.id} 
                      className="p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {transaction.type === 'debt' ? (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <ChevronRight className="text-blue-600" size={20} />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <CheckCircle className="text-green-600" size={20} />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">
                              {transaction.type === 'debt' ? 'Borç' : 'Ödeme'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {transaction.description}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium ${
                            transaction.type === 'debt' ? 'text-blue-600' : 'text-green-600'
                          }`}>
                            {transaction.type === 'debt' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(transaction.date).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                      </div>
                      {transaction.dueDate && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <Clock size={16} className="text-gray-400" />
                          <span className="text-gray-500">Vade:</span>
                          <span className={`font-medium ${
                            transaction.status === 'overdue' 
                              ? 'text-red-600' 
                              : 'text-gray-600'
                          }`}>
                            {new Date(transaction.dueDate).toLocaleDateString('tr-TR')}
                          </span>
                          {transaction.status === 'overdue' && (
                            <AlertCircle size={16} className="text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  ))
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