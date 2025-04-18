import React, { useState, useEffect, useRef } from "react";
import { formatCurrency } from "../../utils/vatUtils";
import { Customer } from "../../types/credit"; // Customer tipini import ediyoruz

// Prop tipleri için bir interface tanımlıyoruz
interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomerId?: string;
  onSelect: (customer: Customer) => void;
}

/**
 * Müşteri seçimi için modal bileşeni
 */
const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  customers, 
  onSelect, 
  selectedCustomerId 
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>(customers);
  
  // Filtreleme mantığı
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCustomers(customers);
    } else {
      const searchTermLower = searchTerm.toLowerCase();
      const filtered = customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTermLower)
      );
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers]);
  
  // Modal açıldığında arama kutusuna otomatik odaklan
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      // Mobil klavyeyi aç
      searchInputRef.current.click();
    }
  }, [isOpen]);

  // Modal kapatıldığında arama terimini sıfırla
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal başlık */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Müşteri Seç</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Arama kutusu */}
        <div className="p-3 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Müşteri ara..."
              className="pl-10 w-full px-4 py-2 text-base rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Müşteri listesi */}
        <div className="flex-1 overflow-auto p-1">
          {filteredCustomers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Arama sonucu bulunamadı
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 p-2">
              {filteredCustomers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => {
                    onSelect(customer);
                    onClose();
                  }}
                  className={`p-3 rounded-lg text-left transition hover:bg-indigo-50 ${
                    selectedCustomerId === customer.id.toString() 
                      ? 'bg-indigo-100 border-2 border-indigo-500' 
                      : 'border border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className={`px-2 py-1 rounded-full text-xs ${
                      customer.creditLimit - customer.currentDebt > 500 
                        ? 'bg-green-100 text-green-800' 
                        : customer.creditLimit - customer.currentDebt <= 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {customer.creditLimit - customer.currentDebt > 0 
                        ? 'Limit Var' 
                        : 'Limit Yok'}
                    </div>
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-500 flex justify-between">
                    <span>Mevcut Borç: {formatCurrency(customer.currentDebt)}</span>
                    <span>Limit: {formatCurrency(customer.creditLimit)}</span>
                  </div>
                  
                  {/* Limit kullanım çubuğu */}
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        customer.currentDebt / customer.creditLimit > 0.8 
                          ? 'bg-red-500' 
                          : customer.currentDebt / customer.creditLimit > 0.5 
                            ? 'bg-yellow-500' 
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (customer.currentDebt / customer.creditLimit) * 100)}%` }}
                    ></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Alt Butonlar */}
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerSearchModal;