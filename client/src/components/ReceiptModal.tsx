import React, { useState } from 'react';
import { Printer, X, Download } from 'lucide-react';
import { ReceiptInfo } from '../types/receipt';
import { formatCurrency, formatVatRate } from '../utils/vatUtils';
import { printService } from '../services/printServices';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptInfo;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const result = await printService.printReceipt(receiptData);
      if (!result) {
        alert('Yazdırma sırasında bir hata oluştu!');
      }
    } catch (error) {
      console.error('Yazdırma hatası:', error);
      alert('Yazdırma sırasında bir hata oluştu!');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Başlık */}
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-4 border-b">
          <h2 className="text-xl font-semibold">Satış Fişi</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 
                transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Printer size={18} />
              <span>{isPrinting ? 'Yazdırılıyor...' : 'Yazdır'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Fiş İçeriği */}
        <div className="bg-white p-4 font-mono text-sm border rounded-lg">
          {/* Mağaza Bilgileri */}
          <div className="text-center mb-4">
            <div className="font-bold text-lg">MARKET ADI</div>
            <div>Adres Satırı 1</div>
            <div>Adres Satırı 2</div>
            <div>Tel: (123) 456-7890</div>
            <div className="text-xs">Vergi No: 1234567890</div>
          </div>

          {/* Fiş Detayları */}
          <div className="border-t border-b border-dashed py-2 mb-4">
            <div>Fiş No: {receiptData.receiptNo}</div>
            <div>Tarih: {receiptData.date.toLocaleString('tr-TR')}</div>
          </div>

          {/* Ürünler */}
          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-xs border-b pb-1">
              <span>Ürün</span>
              <span className="text-right">Miktar x Fiyat = Tutar</span>
            </div>
            {receiptData.items.map((item) => (
              <div key={item.id} className="flex justify-between items-start text-sm">
                <div>
                  <div>{item.name}</div>
                  <div className="text-xs text-gray-500">
                    KDV: {formatVatRate(item.vatRate)}
                  </div>
                </div>
                <div className="text-right">
                  <div>
                    {item.quantity} x {formatCurrency(item.price)} = {formatCurrency(item.price * item.quantity)}
                  </div>
                  <div className="text-xs text-gray-500">
                    KDV: {formatCurrency((item.totalVatAmount || 0))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Toplam Bilgileri */}
          <div className="border-t border-dashed pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Ara Toplam:</span>
              <span>{formatCurrency(receiptData.subtotal)}</span>
            </div>
            
            {/* KDV Detayları */}
            {receiptData.vatBreakdown?.map((vat) => (
              <div key={vat.rate} className="flex justify-between text-sm">
                <span>KDV {formatVatRate(vat.rate)}:</span>
                <span>{formatCurrency(vat.vatAmount)}</span>
              </div>
            ))}

            <div className="flex justify-between font-bold pt-2 mt-1 border-t">
              <span>TOPLAM:</span>
              <span>{formatCurrency(receiptData.total)}</span>
            </div>

            {/* Ödeme Bilgileri */}
            <div className="pt-2 mt-2 border-t text-sm">
              <div className="flex justify-between">
                <span>Ödeme Şekli:</span>
                <span>{receiptData.paymentMethod === 'nakit' ? 'Nakit' : 'Kredi Kartı'}</span>
              </div>
              {receiptData.paymentMethod === 'nakit' && receiptData.cashReceived && (
                <>
                  <div className="flex justify-between">
                    <span>Alınan:</span>
                    <span>{formatCurrency(receiptData.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Para Üstü:</span>
                    <span>{formatCurrency(receiptData.changeAmount || 0)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Alt Bilgi */}
          <div className="text-center text-xs mt-4 pt-4 border-t">
            <div>*** Bizi tercih ettiğiniz için teşekkür ederiz ***</div>
            <div className="mt-1">{receiptData.date.toLocaleString('tr-TR')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;