import React, { useState, useRef, useEffect } from 'react';
import { PaymentModalProps } from '../types/pos';
import { formatCurrency } from '../utils/vatUtils';

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  total,
  subtotal,
  vatAmount,
  onComplete
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'kart'>('nakit');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    // Modal kapandığında state'i temizle
    if (!isOpen) {
      setPaymentMethod('nakit');
      setReceivedAmount('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedReceived = parseFloat(receivedAmount) || 0;
  const changeAmount = parsedReceived - total;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-semibold mb-4">Ödeme</h2>
        
        {/* Toplam Bilgileri */}
        <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Ara Toplam:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>KDV:</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2 mt-2">
            <span>Toplam:</span>
            <span className="text-primary-600">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Ödeme Yöntemi Seçimi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ödeme Yöntemi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`p-3 border rounded-lg ${
                  paymentMethod === 'nakit'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'hover:bg-gray-50'
                } transition-colors`}
                onClick={() => setPaymentMethod('nakit')}
              >
                💵 Nakit
              </button>
              <button
                className={`p-3 border rounded-lg ${
                  paymentMethod === 'kart'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'hover:bg-gray-50'
                } transition-colors`}
                onClick={() => setPaymentMethod('kart')}
              >
                💳 Kredi Kartı
              </button>
            </div>
          </div>

          {/* Nakit Ödeme Detayları */}
          {paymentMethod === 'nakit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alınan Tutar
              </label>
              <input
                ref={inputRef}
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.00"
              />
              {changeAmount >= 0 && receivedAmount && (
                <div className="mt-2 p-2 bg-green-50 text-green-700 rounded-lg">
                  Para üstü: {formatCurrency(changeAmount)}
                </div>
              )}
              {changeAmount < 0 && receivedAmount && (
                <div className="mt-2 p-2 bg-red-50 text-red-700 rounded-lg">
                  Eksik ödeme: {formatCurrency(Math.abs(changeAmount))}
                </div>
              )}
            </div>
          )}

          {/* Onay Butonları */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={() => {
                if (paymentMethod === 'kart' || (paymentMethod === 'nakit' && changeAmount >= 0)) {
                  onComplete(paymentMethod, parsedReceived);
                }
              }}
              disabled={paymentMethod === 'nakit' && changeAmount < 0}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 
                disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Ödemeyi Tamamla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;