import React, { useState } from 'react';
import { Package, Plus, Minus, AlertTriangle, History, X } from 'lucide-react';
import { Product } from '../types/product';

interface StockMovement {
  id: string;
  productId: number;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  date: Date;
}

interface StockManagementProps {
  product: Product;
  onUpdate: (productId: number, newStock: number) => void;
  onClose: () => void;
}

const StockManagement: React.FC<StockManagementProps> = ({
  product,
  onUpdate,
  onClose
}) => {
  const [quantity, setQuantity] = useState<string>('');
  const [type, setType] = useState<'in' | 'out'>('in');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [movements] = useState<StockMovement[]>([]); // Gerçek uygulamada bu veriyi bir servisten alacağız

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numQuantity = parseInt(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      setError('Geçerli bir miktar giriniz');
      return;
    }

    if (!reason.trim()) {
      setError('Açıklama giriniz');
      return;
    }

    if (type === 'out' && numQuantity > product.stock) {
      setError('Çıkış miktarı stok miktarından fazla olamaz');
      return;
    }

    const newStock = type === 'in' 
      ? product.stock + numQuantity 
      : product.stock - numQuantity;

    onUpdate(product.id, newStock);
    onClose();
  };

  const commonReasons = {
    in: [
      'Yeni Alım',
      'İade',
      'Sayım Fazlası',
      'Hatalı Çıkış Düzeltme'
    ],
    out: [
      'Fire',
      'Sayım Eksiği',
      'Hasar',
      'İade'
    ]
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 shadow-xl transition-all sm:w-full sm:max-w-lg">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Stok Yönetimi - {product.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Kapat</span>
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Mevcut Stok Bilgisi */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-gray-500" />
                <span className="text-gray-600">Mevcut Stok:</span>
              </div>
              <span className="font-semibold text-lg">
                {product.stock} adet
              </span>
            </div>
          </div>

          {/* Stok Güncelleme Formu */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Giriş/Çıkış Seçimi */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('in')}
                className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg 
                  ${type === 'in' 
                    ? 'bg-green-50 text-green-600 border-green-200 border-2' 
                    : 'border hover:bg-gray-50'
                  }`}
              >
                <Plus size={20} />
                Stok Girişi
              </button>
              <button
                type="button"
                onClick={() => setType('out')}
                className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg
                  ${type === 'out'
                    ? 'bg-red-50 text-red-600 border-red-200 border-2'
                    : 'border hover:bg-gray-50'
                  }`}
              >
                <Minus size={20} />
                Stok Çıkışı
              </button>
            </div>

            {/* Miktar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Miktar
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Miktar giriniz"
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>

            {/* Sık Kullanılan Nedenler */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sık Kullanılan Nedenler
              </label>
              <div className="flex flex-wrap gap-2">
                {commonReasons[type].map((commonReason) => (
                  <button
                    key={commonReason}
                    type="button"
                    onClick={() => setReason(commonReason)}
                    className={`px-3 py-1 rounded-full text-sm
                      ${reason === commonReason
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200 border'
                        : 'border hover:bg-gray-50'
                      }`}
                  >
                    {commonReason}
                  </button>
                ))}
              </div>
            </div>

            {/* Açıklama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Stok hareketi açıklaması giriniz"
              />
            </div>

            {/* Hata Mesajı */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertTriangle size={20} />
                <span>{error}</span>
              </div>
            )}

            {/* Butonlar */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Kaydet
              </button>
            </div>
          </form>

          {/* Stok Hareketleri */}
          {movements.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <History size={16} />
                Son Hareketler
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                  >
                    <div>
                      <span className={movement.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                        {movement.type === 'in' ? '+' : '-'}{movement.quantity} adet
                      </span>
                      <div className="text-gray-500">{movement.reason}</div>
                    </div>
                    <div className="text-gray-400">
                      {movement.date.toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockManagement;