import React from "react";
import { formatCurrency } from "../utils/vatUtils";
import { Customer } from "../types/credit"; // Customer tipini import ediyoruz

// Prop tipleri için bir interface tanımlıyoruz
interface CustomerSelectionButtonProps {
  selectedCustomer: Customer | null;
  onOpenModal: () => void;
  className?: string;
}

/**
 * Müşteri seçim butonu bileşeni
 * @param selectedCustomer - Seçili müşteri objesi veya null
 * @param onOpenModal - Modal açma fonksiyonu
 * @param className - İsteğe bağlı CSS sınıfları
 */
const CustomerSelectionButton: React.FC<CustomerSelectionButtonProps> = ({ 
  selectedCustomer, 
  onOpenModal, 
  className = "" 
}) => {
  return (
    <button
      onClick={onOpenModal}
      className={`w-full p-3 rounded-lg border border-gray-300 text-left flex justify-between items-center hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
    >
      <div>
        {selectedCustomer ? (
          <div>
            <div className="font-medium text-gray-900">{selectedCustomer.name}</div>
            <div className="text-sm text-gray-500">
              Borç: {formatCurrency(selectedCustomer.currentDebt)} / 
              Limit: {formatCurrency(selectedCustomer.creditLimit)}
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Müşteri seçmek için tıklayın</div>
        )}
      </div>
      <div className="text-indigo-600">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
};

export default CustomerSelectionButton;