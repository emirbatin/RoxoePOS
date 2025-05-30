import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Product } from '../types/product';

interface BatchPriceUpdateProps {
  products: Product[];
  selectedProducts?: number[]; // Seçili ürün ID'leri (opsiyonel)
  onUpdate: (updatedProducts: Product[]) => void;
}

const BatchPriceUpdate: React.FC<BatchPriceUpdateProps> = ({
  products,
  selectedProducts,
  onUpdate
}) => {
  const [updateType, setUpdateType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState<string>('');
  const [updateTarget, setUpdateTarget] = useState<'all' | 'category' | 'selected'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Benzersiz kategorileri al
  const categories = Array.from(new Set(products.map(p => p.category)));

  const handleUpdate = () => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return;

    let productsToUpdate = [...products];

    // Hangi ürünlerin güncelleneceğini belirle
    if (updateTarget === 'category' && selectedCategory) {
      productsToUpdate = productsToUpdate.filter(p => p.category === selectedCategory);
    } else if (updateTarget === 'selected' && selectedProducts) {
      productsToUpdate = productsToUpdate.filter(p => selectedProducts.includes(p.id));
    }

    // Fiyat güncellemesi yap
    const updatedProducts = products.map(product => {
      if (!productsToUpdate.find(p => p.id === product.id)) {
        return product;
      }

      let newPriceWithVat = product.priceWithVat; // Start with the VAT-inclusive price
      if (updateType === 'percentage') {
        // Apply percentage change to the VAT-inclusive price
        newPriceWithVat = product.priceWithVat * (1 + numericValue / 100);
      } else {
        // Apply fixed change to the VAT-inclusive price
        newPriceWithVat = product.priceWithVat + numericValue;
      }

      // Calculate the sale price (without VAT) based on the new VAT-inclusive price
      const salePrice = newPriceWithVat / (1 + product.vatRate / 100); // Calculate the base price

      return {
        ...product,
        priceWithVat: Number(newPriceWithVat.toFixed(2)),
        salePrice: Number(salePrice.toFixed(2)), // Update sale price (without VAT)
      };
    });

    onUpdate(updatedProducts);
    setShowConfirm(false);
    setValue('');
  };

  return (
    <div className="bg-white p-4 rounded-lg border space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <Calculator size={20} />
        Toplu Fiyat Güncelleme
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Güncelleme Tipi */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Güncelleme Tipi
          </label>
          <select
            value={updateType}
            onChange={(e) => setUpdateType(e.target.value as 'percentage' | 'fixed')}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="percentage">Yüzde (%)</option>
            <option value="fixed">Sabit Tutar (₺)</option>
          </select>
        </div>

        {/* Değer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {updateType === 'percentage' ? 'Yüzde' : 'Tutar'}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder={updateType === 'percentage' ? 'Örn: 10' : 'Örn: 5.99'}
            step={updateType === 'percentage' ? '1' : '0.01'}
            onWheel={(e) => e.currentTarget.blur()}
          />
        </div>

        {/* Hedef Seçimi */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Güncelleme Hedefi
          </label>
          <select
            value={updateTarget}
            onChange={(e) => setUpdateTarget(e.target.value as 'all' | 'category' | 'selected')}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="all">Tüm Ürünler</option>
            <option value="category">Kategori Bazlı</option>
            {selectedProducts && selectedProducts.length > 0 && (
              <option value="selected">Seçili Ürünler ({selectedProducts.length})</option>
            )}
          </select>
        </div>

        {/* Kategori Seçimi */}
        {updateTarget === 'category' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Kategori Seçin</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Özet ve Onay */}
      {value && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            <p>
              {updateTarget === 'all' ? 'Tüm ürünlerin' :
               updateTarget === 'category' ? `${selectedCategory} kategorisindeki ürünlerin` :
               'Seçili ürünlerin'} fiyatı
              {updateType === 'percentage' ? 
                ` %${value} ${Number(value) > 0 ? 'artırılacak' : 'azaltılacak'}` :
                ` ${Number(value) > 0 ? value + '₺ artırılacak' : Math.abs(Number(value)) + '₺ azaltılacak'}`}
            </p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setValue('');
                setShowConfirm(false);
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              İptal
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Uygula
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchPriceUpdate;