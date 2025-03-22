import React, { useEffect, useState } from 'react';
import { 
  X, 
  CreditCard, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Tag,
  ShoppingBag,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { Customer, CreditTransaction } from '../../types/credit';
import { salesDB } from '../../services/salesDB';
import { Sale } from '../../types/sales';
import { useNavigate } from 'react-router-dom';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  transactions: CreditTransaction[];
  onAddDebt: (customer: Customer, amount: number, description: string, dueDate?: string) => void;
  onAddPayment: (customer: Customer, amount: number, description: string) => void;
}

// Modal view states
type ModalView = 'details' | 'add-debt' | 'add-payment';

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen,
  onClose,
  customer,
  transactions,
  onAddDebt,
  onAddPayment
}) => {
  const navigate = useNavigate();
  const [relatedSales, setRelatedSales] = useState<Record<string, Sale>>({});
  const [currentView, setCurrentView] = useState<ModalView>('details');
  
  // Form states for add debt and payment
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  
  // Debug info state
  const [debugInfo, setDebugInfo] = useState({
    transactionsLength: 0,
    hasTransactions: false,
    sortedTransactionsLength: 0
  });
  
  // Reset the view and form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setCurrentView('details');
      resetForm();
    }
  }, [isOpen]);
  
  // Reset form values
  const resetForm = () => {
    setAmount('');
    setDescription('');
    setDueDate('');
  };
  
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
        sortedTransactionsLength: 0
      });
      
      if (transactions.length > 0) {
        const loadRelatedSales = async () => {
          try {
            // Find transactions with receipt numbers
            const salesWithReceiptNo = transactions.filter(
              t => t.description && t.description.includes('Fiş No:')
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
                  const sale = allSales.find(s => s.receiptNo === receiptNo);
                  
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
    return new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: 'TRY' 
    }).format(amount);
  };

  const limitUsagePercent = (customer.currentDebt / customer.creditLimit) * 100;
  const activeTransactions = transactions.filter(t => t.status === 'active' || t.status === 'overdue');
  const overdueTransactions = transactions.filter(t => t.status === 'overdue');
  
  // Discounted sales count and total discount amount
  const discountedSales = Object.values(relatedSales).filter(sale => 
    sale && (sale.discount || (sale.originalTotal && sale.originalTotal > sale.total))
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
    setDebugInfo(prev => ({
      ...prev,
      sortedTransactionsLength: sortedTransactions.length
    }));
  }
  
  // Handle debt submission
  const handleAddDebt = () => {
    const amountValue = parseFloat(amount.replace(/[^\d.-]/g, ''));
    if (isNaN(amountValue) || amountValue <= 0) {
      alert('Lütfen geçerli bir tutar girin');
      return;
    }
    
    onAddDebt(
      customer, 
      amountValue, 
      description, 
      dueDate || undefined
    );
    
    // Reset and go back to details view
    resetForm();
    setCurrentView('details');
  };
  
  // Handle payment submission
  const handleAddPayment = () => {
    const amountValue = parseFloat(amount.replace(/[^\d.-]/g, ''));
    if (isNaN(amountValue) || amountValue <= 0) {
      alert('Lütfen geçerli bir tutar girin');
      return;
    }
    
    if (amountValue > customer.currentDebt) {
      alert('Ödeme tutarı mevcut borçtan fazla olamaz');
      return;
    }
    
    onAddPayment(
      customer, 
      amountValue, 
      description
    );
    
    // Reset and go back to details view
    resetForm();
    setCurrentView('details');
  };

  // Render the appropriate view
  const renderModalContent = () => {
    switch (currentView) {
      case 'add-debt':
        return (
          <div className="px-6 py-4">
            <button 
              onClick={() => setCurrentView('details')}
              className="flex items-center text-blue-600 mb-4"
            >
              <ArrowLeft size={16} className="mr-1" />
              <span>Müşteri Detayına Dön</span>
            </button>
            
            <h3 className="text-lg font-medium mb-4">Yeni Borç Ekle</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tutar
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">TL</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Borç açıklaması"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vade Tarihi (İsteğe Bağlı)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Mevcut Limit: {formatCurrency(customer.creditLimit)}
                </div>
                <div className="text-sm text-gray-500">
                  Kullanılabilir: {formatCurrency(customer.creditLimit - customer.currentDebt)}
                </div>
              </div>
              
              <div className="pt-4">
                <button
                  onClick={handleAddDebt}
                  disabled={limitUsagePercent >= 100}
                  className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DollarSign size={20} className="mr-2" />
                  Borç Ekle
                </button>
              </div>
            </div>
          </div>
        );
      
      case 'add-payment':
        return (
          <div className="px-6 py-4">
            <button 
              onClick={() => setCurrentView('details')}
              className="flex items-center text-blue-600 mb-4"
            >
              <ArrowLeft size={16} className="mr-1" />
              <span>Müşteri Detayına Dön</span>
            </button>
            
            <h3 className="text-lg font-medium mb-4">Ödeme Al</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tutar
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">TL</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ödeme açıklaması"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Toplam Borç: {formatCurrency(customer.currentDebt)}
                </div>
              </div>
              
              <div className="pt-4">
                <button
                  onClick={handleAddPayment}
                  disabled={customer.currentDebt === 0}
                  className="w-full flex justify-center items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DollarSign size={20} className="mr-2" />
                  Ödeme Al
                </button>
              </div>
            </div>
          </div>
        );
      
      case 'details':
      default:
        return (
          <div className="px-6 py-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
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
              
              {/* Discount Summary Card */}
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <Tag size={20} />
                  <span>İndirimler</span>
                </div>
                <div className="text-2xl font-semibold text-green-700">
                  {formatCurrency(totalDiscount)}
                </div>
                <div className="text-sm text-green-600 mt-1">
                  {discountedSales.length} işlemde indirim
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setCurrentView('add-debt')}
                disabled={limitUsagePercent >= 100}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DollarSign size={20} />
                Borç Ekle
              </button>
              <button
                onClick={() => setCurrentView('add-payment')}
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
                
                {Array.isArray(sortedTransactions) && sortedTransactions.length > 0 ? (
                  sortedTransactions.map((transaction) => {
                    // Related sale data (if exists)
                    const relatedSale = relatedSales[transaction.id];
                    const hasDiscount = relatedSale && (
                      relatedSale.discount || 
                      (relatedSale.originalTotal && relatedSale.originalTotal > relatedSale.total)
                    );
                    
                    return (
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
                                
                                {/* Discount badge - if discount applied */}
                                {hasDiscount && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    <Tag size={10} className="mr-1" />
                                    İndirimli
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
                                <div className={`font-medium ${
                                  transaction.type === 'debt' ? 'text-blue-600' : 'text-green-600'
                                }`}>
                                  {transaction.type === 'debt' ? '+' : '-'}
                                  {formatCurrency(transaction.amount)}
                                </div>
                                <div className="text-xs text-gray-500 line-through">
                                  {formatCurrency(relatedSale.originalTotal || 0)}
                                </div>
                                <div className="text-xs text-green-600">
                                  {relatedSale.discount?.type === 'percentage' 
                                    ? `%${relatedSale.discount.value} indirim` 
                                    : `${formatCurrency((relatedSale.originalTotal || 0) - relatedSale.total)} indirim`}
                                </div>
                              </div>
                            ) : (
                              <div className={`font-medium ${
                                transaction.type === 'debt' ? 'text-blue-600' : 'text-green-600'
                              }`}>
                                {transaction.type === 'debt' ? '+' : '-'}
                                {formatCurrency(transaction.amount)}
                              </div>
                            )}
                            
                            <div className="text-sm text-gray-500">
                              {new Date(transaction.date).toLocaleDateString('tr-TR')}
                            </div>
                          </div>
                        </div>
                        
                        {/* Due Date Information */}
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
                        
                        {/* Show product info if related sale exists */}
                        {relatedSale && (
                          <div className="mt-3 bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center text-sm font-medium text-gray-700">
                                <ShoppingBag size={16} className="mr-2" />
                                Satın Alınan Ürünler ({relatedSale.items.length})
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
                                <div key={idx} className="flex justify-between text-xs">
                                  <div>
                                    <span className="text-gray-600">{item.quantity}x </span>
                                    <span className="text-gray-800">{item.name}</span>
                                  </div>
                                  <div className="text-gray-800 font-medium">
                                    {formatCurrency(item.priceWithVat * item.quantity)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Extra check, sortedTransactions exists but empty
                  Array.isArray(sortedTransactions) && sortedTransactions.length === 0 && 
                  transactions.length > 0 && (
                    <div className="p-4 text-center text-red-500">
                      Hata: İşlemler sıralanırken bir sorun oluştu!
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        );
    }
  };

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

          {/* Debug Information 
          {process.env.NODE_ENV === 'development' && (
            <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-yellow-800">
              <p>Debug: Current View: {currentView}</p>
              <p>Debug: Transactions Length: {debugInfo.transactionsLength}</p>
              <p>Debug: Has Transactions: {debugInfo.hasTransactions ? 'Yes' : 'No'}</p>
              <p>Debug: Sorted Transactions Length: {debugInfo.sortedTransactionsLength}</p>
              <p>Debug: Active Transactions: {activeTransactions.length}</p>
              <p>Debug: First Transaction: {sortedTransactions.length > 0 ? JSON.stringify(sortedTransactions[0]).substring(0, 100) + '...' : 'None'}</p>
            </div>
          )}*/}

          {/* Content */}
          {renderModalContent()}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailModal;