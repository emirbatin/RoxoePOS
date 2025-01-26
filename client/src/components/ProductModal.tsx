import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Product, Category, VatRate } from "../types/pos";
import { calculatePriceWithVat } from "../utils/vatUtils";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, "id">) => void;
  product?: Product;
  categories: Category[];
}

const VAT_RATES: VatRate[] = [0, 1, 8, 18, 20];

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  categories,
}) => {
  const [form, setForm] = useState({
    name: "",
    price: "",
    vatRate: 18 as VatRate,
    category: categories[0]?.name || "",
    stock: "",
    barcode: "",
  });

  // Form verilerini sıfırla ve doldur
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setForm({
          name: product.name,
          price: product.price.toString(),
          vatRate: product.vatRate,
          category: product.category,
          stock: product.stock.toString(),
          barcode: product.barcode,
        });
      } else {
        setForm({
          name: "",
          price: "",
          vatRate: 18,
          category: categories[0]?.name || "",
          stock: "",
          barcode: "",
        });
      }
    }
  }, [isOpen, product, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(form.price);
    const stock = parseInt(form.stock);

    if (isNaN(price) || isNaN(stock)) {
      alert("Lütfen geçerli sayısal değerler girin.");
      return;
    }

    const priceWithVat = calculatePriceWithVat(price, form.vatRate);

    onSave({
      name: form.name,
      price,
      priceWithVat,
      vatRate: form.vatRate,
      category: form.category,
      stock,
      barcode: form.barcode,
    });

    onClose(); // Modal kapatma
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {product ? "Ürün Düzenle" : "Yeni Ürün Ekle"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Ürün Adı */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ürün Adı
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ürün adı girin"
                required
              />
            </div>

            {/* Kategori */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategori
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Barkod */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barkod
              </label>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, barcode: e.target.value }))
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Barkod girin"
                required
              />
            </div>

            {/* Fiyat (KDV'siz) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fiyat (KDV'siz)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, price: e.target.value }))
                  }
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0.00"
                  required
                />
                <div className="absolute inset-y-0 right-3 flex items-center text-gray-500">
                  ₺
                </div>
              </div>
            </div>

            {/* KDV Oranı */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                KDV Oranı
              </label>
              <select
                value={form.vatRate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    vatRate: parseInt(e.target.value) as VatRate,
                  }))
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                {VAT_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    %{rate}
                  </option>
                ))}
              </select>
            </div>

            {/* KDV'li Fiyat (Hesaplanan) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                KDV'li Fiyat (Hesaplanan)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={
                    form.price
                      ? calculatePriceWithVat(
                          parseFloat(form.price),
                          form.vatRate
                        ).toFixed(2)
                      : ""
                  }
                  className="w-full p-2 border rounded-lg bg-gray-50"
                  disabled
                />
                <div className="absolute inset-y-0 right-3 flex items-center text-gray-500">
                  ₺
                </div>
              </div>
            </div>

            {/* Stok */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stok Miktarı
              </label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, stock: e.target.value }))
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0"
                min="0"
                required
              />
            </div>
          </div>

          {/* Butonlar */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {product ? "Güncelle" : "Ekle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;