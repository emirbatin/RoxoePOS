// components/modals/SelectProductsModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Product } from '../../types/product';
import { formatCurrency } from '../../utils/vatUtils';

interface SelectProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedProducts: number[]) => void;
  products: Product[];
  existingProductIds?: number[]; // Grupta zaten var olan ürünler
}

const SelectProductsModal: React.FC<SelectProductsModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  products,
  existingProductIds = []
}) => {
  // State'leri doğrudan isOpen değeri ile sıfırla
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Modal kapandığında select ve close işlevini çağır 
  const handleClose = () => {
    setSelectedIds([]);
    setSearchTerm('');
    onClose();
  };

  // Filtrelenmiş ürünler
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.barcode.includes(searchTerm);
      const notInGroup = !existingProductIds.includes(product.id);
      return matchesSearch && notInGroup;
    });
  }, [products, searchTerm, existingProductIds]);

  const handleToggleSelect = (productId: number) => {
    setSelectedIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSubmit = () => {
    onSelect(selectedIds);
    handleClose();
  };

  // Modal açıldığında, bileşen render edildiğinde seçimler zaten temiz olacak
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Ürün Seç</h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Arama */}
        <div className="p-4 border-b">
          <div className="relative">
            <input
              type="text"
              placeholder="Ürün ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
        </div>

        {/* Ürün Listesi */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-2">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => handleToggleSelect(product.id)}
                className={`flex items-center p-3 rounded-lg border cursor-pointer
                  ${selectedIds.includes(product.id)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'hover:bg-gray-50'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => handleToggleSelect(product.id)}
                  className="mr-3 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-gray-500">
                    Barkod: {product.barcode}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-indigo-600">
                    {formatCurrency(product.priceWithVat)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Stok: {product.stock}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedIds.length} ürün seçildi
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectProductsModal;