import React, { useRef } from 'react';
import { Printer, X, Download } from 'lucide-react';
import { ReceiptProps } from '../types/receipt';

const ReceiptModal: React.FC<ReceiptProps> = ({ 
  isOpen, 
  onClose, 
  receiptData,
  onPrint 
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Başlık */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Satış Fişi</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Fiş İçeriği */}
        <div 
          ref={receiptRef}
          className="bg-white p-4 font-mono text-sm"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
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
            <div>Tarih: {formatDate(receiptData.date)}</div>
          </div>

          {/* Ürünler */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs border-b">
              <span>Ürün</span>
              <span className="text-right">Miktar x Fiyat = Tutar</span>
            </div>
            {receiptData.items.map((item) => (
              <div key={item.id} className="flex justify-between items-start">
                <span className="flex-1">{item.name}</span>
                <span className="text-right">
                  {item.quantity} x ₺{item.price.toFixed(2)} = ₺{(item.quantity * item.price).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Toplam Bilgileri */}
          <div className="border-t border-dashed pt-2 mb-4">
            <div className="flex justify-between font-bold">
              <span>TOPLAM</span>
              <span>₺{receiptData.total.toFixed(2)}</span>
            </div>
            <div className="text-sm">
              <div>Ödeme Şekli: {receiptData.paymentMethod === 'nakit' ? 'Nakit' : 'Kredi Kartı'}</div>
              {receiptData.paymentMethod === 'nakit' && receiptData.cashReceived && (
                <>
                  <div className="flex justify-between">
                    <span>Alınan:</span>
                    <span>₺{receiptData.cashReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Para Üstü:</span>
                    <span>₺{(receiptData.cashReceived - receiptData.total).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Alt Bilgi */}
          <div className="text-center text-xs">
            <div>*** Bizi tercih ettiğiniz için teşekkür ederiz ***</div>
            <div>{formatDate(receiptData.date)}</div>
          </div>
        </div>

        {/* Butonlar */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button
            onClick={onPrint}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Printer size={20} />
            Yazdır
          </button>
          <button
            onClick={() => {
              // PDF indirme işlemi eklenecek
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Download size={20} />
            PDF İndir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;