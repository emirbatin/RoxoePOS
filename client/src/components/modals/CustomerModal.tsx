import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Customer } from '../../types/credit';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerData: Omit<Customer, 'id' | 'currentDebt' | 'createdAt'>) => void;
  customer?: Customer;
}

const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customer
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    taxNumber: '',
    creditLimit: 1000,
    note: ''
  });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        phone: customer.phone,
        address: customer.address || '',
        taxNumber: customer.taxNumber || '',
        creditLimit: customer.creditLimit,
        note: customer.note || ''
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        address: '',
        taxNumber: '',
        creditLimit: 1000,
        note: ''
      });
    }
  }, [customer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validasyon
    if (!formData.name.trim()) {
      setError('Müşteri adı boş olamaz');
      return;
    }

    if (!formData.phone.trim()) {
      setError('Telefon numarası boş olamaz');
      return;
    }

    if (formData.creditLimit < 0) {
      setError('Kredi limiti 0\'dan küçük olamaz');
      return;
    }

    // Telefon formatı kontrolü
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(formData.phone.replace(/[^0-9]/g, ''))) {
      setError('Geçerli bir telefon numarası giriniz');
      return;
    }

    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="relative transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
          {/* Başlık */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {customer ? 'Müşteri Düzenle' : 'Yeni Müşteri'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Ad Soyad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ad Soyad *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="05XX XXX XX XX"
              />
            </div>

            {/* Adres */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adres
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Vergi No */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vergi No
              </label>
              <input
                type="text"
                value={formData.taxNumber}
                onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Kredi Limiti */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kredi Limiti (₺)
              </label>
              <input
                type="number"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                min="0"
                step="100"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Not */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Not
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

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
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {customer ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;