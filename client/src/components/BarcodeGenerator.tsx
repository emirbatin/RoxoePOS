import React, { useState } from 'react';
import { Printer, Download, X } from 'lucide-react';
import { Product } from '../types/product';

interface BarcodeGeneratorProps {
  product: Product;
  onClose: () => void;
}

const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({ product, onClose }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [showPriceOnBarcode, setShowPriceOnBarcode] = useState<boolean>(true);
  const [barcodeSize, setBarcodeSize] = useState<'small' | 'medium' | 'large'>('medium');

  const handlePrint = () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    // Barkod boyutları
    const sizes = {
      small: { width: 100, height: 50 },
      medium: { width: 150, height: 75 },
      large: { width: 200, height: 100 }
    };

    const { width, height } = sizes[barcodeSize];
    canvas.width = width;
    canvas.height = height;

    // Arkaplanı beyaz yap
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);

    // Ürün adı
    context.fillStyle = '#000000';
    context.font = `${barcodeSize === 'small' ? 10 : 12}px Arial`;
    context.fillText(product.name, 10, 15, width - 20);

    // Barkod (Şimdilik simüle ediyoruz)
    context.fillRect(10, 25, width - 20, 30);

    // Fiyat (eğer gösterilmesi isteniyorsa)
    if (showPriceOnBarcode) {
      context.font = 'bold 12px Arial';
      context.fillText(
        `₺${product.priceWithVat.toFixed(2)}`,
        10,
        height - 10
      );
    }

    // Barkod numarası
    context.font = '10px monospace';
    context.fillText(product.barcode, 10, height - 25);

    // Canvas'ı resme çevir
    const dataUrl = canvas.toDataURL('image/png');

    // Yazdırma penceresi
    const printWindow = window.open('', '', `width=${width},height=${height}`);
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <style>
            @media print {
              body { margin: 0; }
              img { width: 100%; height: auto; }
            }
          </style>
        </head>
        <body>
          ${Array(quantity).fill(0).map(() => `
            <img src="${dataUrl}" style="page-break-after: always;" />
          `).join('')}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
  };

  const handleDownload = () => {
    // TODO: Barkod resmini indir
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 shadow-xl transition-all sm:w-full sm:max-w-lg">
          {/* Modal Başlığı */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Barkod Yazdırma - {product.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Kapat</span>
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Barkod Önizleme */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg flex justify-center">
            {/* Barkod çizimi gelecek */}
            <div className={`bg-white p-4 rounded border ${
              barcodeSize === 'small' ? 'w-24 h-12' :
              barcodeSize === 'medium' ? 'w-32 h-16' :
              'w-40 h-20'
            }`}>
              <div className="text-xs mb-1">{product.name}</div>
              <div className="bg-gray-800 h-6 mb-1"></div>
              <div className="text-xs font-mono">{product.barcode}</div>
              {showPriceOnBarcode && (
                <div className="text-xs font-bold">₺{product.priceWithVat.toFixed(2)}</div>
              )}
            </div>
          </div>

          {/* Ayarlar */}
          <div className="space-y-4">
            {/* Adet Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yazdırılacak Adet
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Boyut Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barkod Boyutu
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setBarcodeSize('small')}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    barcodeSize === 'small' ? 'bg-primary-50 border-primary-500 text-primary-700' : ''
                  }`}
                >
                  Küçük
                </button>
                <button
                  onClick={() => setBarcodeSize('medium')}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    barcodeSize === 'medium' ? 'bg-primary-50 border-primary-500 text-primary-700' : ''
                  }`}
                >
                  Orta
                </button>
                <button
                  onClick={() => setBarcodeSize('large')}
                  className={`flex-1 py-2 px-4 rounded-lg border ${
                    barcodeSize === 'large' ? 'bg-primary-50 border-primary-500 text-primary-700' : ''
                  }`}
                >
                  Büyük
                </button>
              </div>
            </div>

            {/* Fiyat Gösterimi */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showPrice"
                checked={showPriceOnBarcode}
                onChange={(e) => setShowPriceOnBarcode(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="showPrice" className="text-sm text-gray-700">
                Barkodda fiyat göster
              </label>
            </div>
          </div>

          {/* Butonlar */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Download size={20} />
              İndir
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Printer size={20} />
              Yazdır
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeGenerator;