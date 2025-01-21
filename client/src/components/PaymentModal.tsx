import React, { useState, useRef, useEffect } from 'react';
import { PaymentModalProps } from '../types/pos';

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, total, onComplete }) => {
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'kart'>('nakit');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedReceived = parseFloat(receivedAmount) || 0;
  const changeAmount = parsedReceived - total;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-semibold mb-4">Ödeme</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ödeme Yöntemi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`p-3 border rounded-lg ${
                  paymentMethod === "nakit"
                    ? "bg-primary-50 border-primary-500"
                    : ""
                }`}
                onClick={() => setPaymentMethod("nakit")}
              >
                💵 Nakit
              </button>
              <button
                className={`p-3 border rounded-lg ${
                  paymentMethod === "kart"
                    ? "bg-primary-50 border-primary-500"
                    : ""
                }`}
                onClick={() => setPaymentMethod("kart")}
              >
                💳 Kredi Kartı
              </button>
            </div>
          </div>

          {paymentMethod === "nakit" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alınan Tutar
              </label>
              <input
                ref={inputRef}
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="w-full p-2 border rounded-lg"
                placeholder="0.00"
              />
              {changeAmount >= 0 && receivedAmount && (
                <div className="mt-2 text-sm text-gray-600">
                  Para üstü: ₺{changeAmount.toFixed(2)}
                </div>
              )}
            </div>
          )}

          <div className="text-xl font-bold text-primary-600 mt-4">
            Toplam: ₺{total.toFixed(2)}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={() => {
                if (
                  paymentMethod === "kart" ||
                  (paymentMethod === "nakit" && changeAmount >= 0)
                ) {
                  onComplete(paymentMethod, parsedReceived);
                }
              }}
              disabled={paymentMethod === "nakit" && changeAmount < 0}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300"
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