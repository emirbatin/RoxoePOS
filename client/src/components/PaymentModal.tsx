import React, { useState, useRef, useEffect } from "react";
import { PaymentModalProps } from "../types/pos";
import { formatCurrency } from "../utils/vatUtils";
import { posService } from '../services/posServices';

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  total,
  subtotal,
  vatAmount,
  onComplete,
  customers,
  selectedCustomer,
  setSelectedCustomer,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<"nakit" | "kart" | "veresiye" | "nakitpos">("nakit");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [processingPOS, setProcessingPOS] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPaymentMethod("nakit");
      setReceivedAmount("");
      setSelectedCustomer(null);
      setProcessingPOS(false);
    }
  }, [isOpen, setSelectedCustomer]);

  if (!isOpen) return null;

  const parsedReceived = parseFloat(receivedAmount) || 0;
  const changeAmount = parsedReceived - total;

  const handlePayment = async () => {
    if (paymentMethod === "veresiye" && !selectedCustomer) {
      alert("Lütfen bir müşteri seçin!");
      return;
    }

    if (paymentMethod === "kart" || paymentMethod === "nakitpos") {
      setProcessingPOS(true);
      try {
        const connected = await posService.connect('Ingenico');
        if (!connected) {
          alert('POS cihazına bağlanılamadı!');
          return;
        }

        const result = await posService.processPayment(total);
        if (result.success) {
          onComplete(paymentMethod, parsedReceived);
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error('POS işlemi hatası:', error);
        alert('POS işlemi sırasında bir hata oluştu!');
      } finally {
        setProcessingPOS(false);
        await posService.disconnect();
      }
    } else if ((paymentMethod === "nakit" && changeAmount >= 0) || paymentMethod === "veresiye") {
      onComplete(paymentMethod, parsedReceived);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-semibold mb-4">Ödeme</h2>

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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ödeme Yöntemi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`p-3 border rounded-lg ${
                  paymentMethod === "nakit"
                    ? "bg-primary-50 border-primary-500 text-primary-700"
                    : "hover:bg-gray-50"
                } transition-colors`}
                onClick={() => setPaymentMethod("nakit")}
                disabled={processingPOS}
              >
                💵 Nakit
              </button>
              <button
                className={`p-3 border rounded-lg ${
                  paymentMethod === "kart"
                    ? "bg-primary-50 border-primary-500 text-primary-700"
                    : "hover:bg-gray-50"
                } transition-colors`}
                onClick={() => setPaymentMethod("kart")}
                disabled={processingPOS}
              >
                💳 Kredi Kartı
              </button>
              <button
                className={`p-3 border rounded-lg ${
                  paymentMethod === "veresiye"
                    ? "bg-primary-50 border-primary-500 text-primary-700"
                    : "hover:bg-gray-50"
                } transition-colors`}
                onClick={() => setPaymentMethod("veresiye")}
                disabled={processingPOS}
              >
                📝 Veresiye
              </button>
              <button
                className={`p-3 border rounded-lg ${
                  paymentMethod === "nakitpos"
                    ? "bg-primary-50 border-primary-500 text-primary-700"
                    : "hover:bg-gray-50"
                } transition-colors`}
                onClick={() => setPaymentMethod("nakitpos")}
                disabled={processingPOS}
              >
                💵 POS (Nakit)
              </button>
            </div>
          </div>

          {(paymentMethod === "nakit" || paymentMethod === "nakitpos") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alınan Tutar
              </label>
              <input
                ref={inputRef}
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="0.00"
                disabled={processingPOS}
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

          {paymentMethod === "veresiye" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Müşteri Seç
              </label>
              <select
                value={selectedCustomer?.id || ""}
                onChange={(e) =>
                  setSelectedCustomer(
                    customers.find(c => c.id.toString() === e.target.value) || null
                  )
                }
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={processingPOS}
              >
                <option value="" disabled>Müşteri Seçin</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - Kalan Bakiye: {formatCurrency(customer.creditLimit - customer.currentDebt)}
                  </option>
                ))}
              </select>
              {selectedCustomer && (
                <div className="mt-2 p-2 bg-blue-50 text-blue-700 rounded-lg">
                  Seçilen Müşteri: <strong>{selectedCustomer.name}</strong>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              disabled={processingPOS}
            >
              İptal
            </button>
            <button
              onClick={handlePayment}
              disabled={
                (paymentMethod === "nakit" && changeAmount < 0) ||
                (paymentMethod === "veresiye" && !selectedCustomer) ||
                processingPOS
              }
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 
                disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {processingPOS ? "İşlem yapılıyor..." : "Ödemeyi Tamamla"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;