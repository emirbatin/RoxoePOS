import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Product, Category, VatRate } from "../../types/product";
import { calculatePriceWithoutVat } from "../../utils/vatUtils";

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
    purchasePrice: "",  // Alış Fiyatı (KDV'siz)
    priceWithVat: "",   // Satış Fiyatı (KDV'li)
    vatRate: 18 as VatRate,
    category: categories[0]?.name || "",
    stock: "",
    barcode: "",
    imageUrl: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setForm({
          name: product.name,
          purchasePrice: product.purchasePrice.toString(),
          priceWithVat: product.priceWithVat.toString(),
          vatRate: product.vatRate,
          category: product.category,
          stock: product.stock.toString(),
          barcode: product.barcode,
          imageUrl: product.imageUrl || "",
        });
      } else {
        setForm({
          name: "",
          purchasePrice: "",
          priceWithVat: "",
          vatRate: 18,
          category: categories[0]?.name || "",
          stock: "",
          barcode: "",
          imageUrl: "",
        });
      }
    }
  }, [isOpen, product, categories]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onloadend = () => {
        setForm((prev) => ({
          ...prev,
          imageUrl: (reader.result as string) || "",
        }));
      };

      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const purchasePrice = parseFloat(form.purchasePrice);
    const priceWithVat = parseFloat(form.priceWithVat);
    const stock = parseInt(form.stock);

    if (isNaN(purchasePrice) || isNaN(priceWithVat) || isNaN(stock)) {
      alert("Lütfen geçerli sayısal değerler girin.");
      return;
    }

    // KDV'siz satış fiyatını otomatik hesapla
    const salePrice = calculatePriceWithoutVat(priceWithVat, form.vatRate);

    onSave({
      name: form.name,
      purchasePrice,
      salePrice,        // Hesaplanan KDV'siz satış fiyatı
      priceWithVat,     // Kullanıcının girdiği KDV'li satış fiyatı
      vatRate: form.vatRate,
      category: form.category,
      stock,
      barcode: form.barcode,
      imageUrl: form.imageUrl,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-800">
            {product ? "Ürün Düzenle" : "Yeni Ürün Ekle"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6">
            {/* Basic Info Section */}
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-lg border space-y-4">
                <h3 className="font-medium text-gray-800 border-b pb-2">Temel Bilgiler</h3>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ürün Adı
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ürün adı girin"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kategori
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, category: e.target.value }))
                        }
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.icon} {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
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
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Barkod girin"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="bg-white p-4 rounded-lg border space-y-4">
                <h3 className="font-medium text-gray-800 border-b pb-2">Fiyatlandırma</h3>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alış Fiyatı (KDV'siz)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={form.purchasePrice}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, purchasePrice: e.target.value }))
                          }
                          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0.00"
                          required
                        />
                        <div className="absolute inset-y-0 right-3 flex items-center text-gray-500">
                          ₺
                        </div>
                      </div>
                    </div>
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
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        {VAT_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            %{rate}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Satış Fiyatı (KDV'li)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={form.priceWithVat}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, priceWithVat: e.target.value }))
                        }
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0.00"
                        required
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center text-gray-500">
                        ₺
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Section */}
              <div className="bg-white p-4 rounded-lg border space-y-4">
                <h3 className="font-medium text-gray-800 border-b pb-2">Stok Bilgisi</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stok Miktarı
                  </label>
                  <input
                    type="number"
                    value={form.stock}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, stock: e.target.value }))
                    }
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
              </div>

              {/* Image Section */}
              <div className="bg-white p-4 rounded-lg border space-y-4">
                <h3 className="font-medium text-gray-800 border-b pb-2">Ürün Görseli</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Görsel Yükle
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="w-full text-sm border p-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Görsel URL'i
                      </label>
                      <input
                        type="text"
                        value={form.imageUrl}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                        }
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="URL girin veya dosya seçin"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-32 h-32 border rounded-lg overflow-hidden flex items-center justify-center bg-gray-100">
                      {form.imageUrl ? (
                        <img
                          src={form.imageUrl}
                          alt="Ürün Görseli"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-400 text-sm text-center px-2">
                          Görsel Önizleme
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer - Always Visible */}
        <div className="border-t bg-gray-50 p-4 mt-auto">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {product ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;