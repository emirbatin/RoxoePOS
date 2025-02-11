import React, { useState } from 'react';
import { X, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { Customer } from '../../types/credit';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  type: 'debt' | 'payment';
  onSave: (data: {
    amount: number;
    description: string;
    dueDate?: Date;
  }) => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  customer,
  type,
  onSave
}) => {
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [error, setError] = useState<string>('');

  const availableLimit = customer.creditLimit - customer.currentDebt;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Geçerli bir tutar giriniz');
      return;
    }

    if (!description.trim()) {
      setError('Açıklama giriniz');
      return;
    }

    if (type === 'debt') {
      if (numAmount > availableLimit) {
        setError('Kredi limitini aşıyor!');
        return;
      }
    } else {
      if (numAmount > customer.currentDebt) {
        setError('Ödeme tutarı mevcut borçtan fazla olamaz!');
        return;
      }
    }

    onSave({
      amount: numAmount,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined
    });

    // Formu temizle
    setAmount('');
    setDescription('');
    setDueDate('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 shadow-xl transition-all sm:w-full sm:max-w-lg">
          {/* Başlık */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {type === 'debt' ? 'Borç Ekle' : 'Ödeme Al'} - {customer.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mevcut Durum */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Mevcut Borç</div>
                <div className="font-semibold text-gray-900">
                  {new Intl.NumberFormat('tr-TR', { 
                    style: 'currency', 
                    currency: 'TRY' 
                  }).format(customer.currentDebt)}
                </div>
              </div>
              {type === 'debt' && (
                <div>
                  <div className="text-sm text-gray-500">Kullanılabilir Limit</div>
                  <div className="font-semibold text-gray-900">
                    {new Intl.NumberFormat('tr-TR', { 
                      style: 'currency', 
                      currency: 'TRY' 
                    }).format(availableLimit)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tutar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tutar
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0.00"
                />
                <DollarSign 
                  className="absolute left-3 top-2.5 text-gray-400" 
                  size={20} 
                />
              </div>
            </div>

            {/* Açıklama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="İşlem açıklaması..."
              />
            </div>

            {/* Vade Tarihi (Sadece borç eklerken) */}
            {type === 'debt' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vade Tarihi
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <Calendar 
                    className="absolute left-3 top-2.5 text-gray-400" 
                    size={20} 
                  />
                </div>
              </div>
            )}

            {/* Hata Mesajı */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertTriangle size={20} />
                <span>{error}</span>
              </div>
            )}

            {/* Form Butonları */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                type="submit"
                className={`px-4 py-2 text-white rounded-lg flex items-center gap-2
                  ${type === 'debt' 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-green-600 hover:bg-green-700'
                  }`}
              >
                <DollarSign size={20} />
                {type === 'debt' ? 'Borç Ekle' : 'Ödeme Al'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;