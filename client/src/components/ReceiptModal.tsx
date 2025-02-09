import React, { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import {
  ReceiptConfig,
  ReceiptInfo,
  ReceiptModalProps,
} from "../types/receipt";
import { formatCurrency, formatVatRate } from "../utils/vatUtils";
import { receiptService } from "../services/receiptService";

const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [config, setConfig] = useState<ReceiptConfig | null>(null);

  // Load receipt config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem("receiptConfig");
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  if (!isOpen) return null;

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const result = await receiptService.printReceipt(receiptData);
      if (!result) {
        alert("Yazdırma sırasında bir hata oluştu!");
      }
    } catch (error) {
      console.error("Yazdırma hatası:", error);
      alert("Yazdırma sırasında bir hata oluştu!");
    } finally {
      setIsPrinting(false);
    }
  };

  // Dotted line component
  const DottedLine = () => (
    <div className="w-full flex justify-center my-2">
      <div className="text-gray-400 text-sm tracking-widest">
        - - - - - - - - - - - - - - - - - - - - - - - - -
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-gray-900">Fiş Görüntüle</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
            >
              <Printer size={18} />
              <span>{isPrinting ? "Yazdırılıyor..." : "Yazdır"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow-sm mx-auto w-[280px] relative font-mono text-[11px] leading-tight">
            {/* Top tear effect */}
            <div className="absolute -top-2 left-0 right-0 h-4 bg-[linear-gradient(45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%),linear-gradient(-45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%)] bg-size-[10px_10px]" />

            <div className="p-3">
              {/* Store Info */}
              <div className="text-center space-y-0.5 mb-2">
                <div className="font-bold text-base">
                  {config?.storeName || "MARKET ADI"}
                </div>
                <div className="text-[10px]">{config?.legalName || ""}</div>
                {config?.address.map((line, index) => (
                  <div key={index} className="text-[10px]">
                    {line}
                  </div>
                ))}
                {config?.phone && (
                  <div className="text-[10px]">Tel: {config.phone}</div>
                )}
                <div className="flex justify-between text-[10px] mt-1">
                  <span>VD: {config?.taxOffice || "---"}</span>
                  <span>VN: {config?.taxNumber || "---"}</span>
                </div>
                {config?.mersisNo && (
                  <div className="text-[10px]">
                    Mersis No: {config.mersisNo}
                  </div>
                )}
              </div>

              <DottedLine />

              {/* Receipt Details */}
              <div className="space-y-0.5 mb-2">
                <div className="flex justify-between text-[10px]">
                  <span>Fiş No:</span>
                  <span>
                    {receiptData.receiptNo.toString().padStart(4, "0")}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Tarih:</span>
                  <span>
                    {new Date(receiptData.date).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Saat:</span>
                  <span>
                    {new Date(receiptData.date).toLocaleTimeString("tr-TR")}
                  </span>
                </div>
              </div>

              <DottedLine />

              {/* Items */}
              <div className="space-y-2 mb-3">
                {receiptData.items.map((item, index) => (
                  <div key={item.id}>
                    <div className="font-bold uppercase">{item.name}</div>
                    <div className="flex justify-between text-[10px]">
                      <span>
                        {item.quantity} x {formatCurrency(item.priceWithVat)}
                      </span>
                      <span>
                        {formatCurrency(item.priceWithVat * item.quantity)}
                      </span>
                    </div>
                    <div className="text-[10px] text-right">
                      KDV(%{item.vatRate}):{" "}
                      {formatCurrency(
                        item.priceWithVat * item.quantity -
                          (item.priceWithVat * item.quantity) /
                            (1 + item.vatRate / 100)
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <DottedLine />

              {/* Totals */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span>TOPLAM</span>
                  <span className="font-bold">
                    {formatCurrency(receiptData.total)}
                  </span>
                </div>

                {/* KDV Breakdown */}
                <div className="text-[10px] space-y-0.5 pt-1 border-t border-dashed">
                  <div className="flex justify-between">
                    <span>KDV Toplam:</span>
                    <span>{formatCurrency(receiptData.vatAmount)}</span>
                  </div>

                  {/* KDV by rate */}
                  {[1, 8, 18].map((rate) => {
                    const itemsWithRate = receiptData.items.filter(
                      (item) => item.vatRate === rate
                    );
                    const vatAmount = itemsWithRate.reduce((sum, item) => {
                      const itemTotal = item.priceWithVat * item.quantity;
                      return sum + (itemTotal - itemTotal / (1 + rate / 100));
                    }, 0);

                    if (vatAmount > 0) {
                      return (
                        <div key={rate} className="flex justify-between">
                          <span>KDV %{rate}:</span>
                          <span>{formatCurrency(vatAmount)}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              <DottedLine />

              {/* Footer */}
              <div className="text-center space-y-2">
                <div className="text-[10px]">
                  {config?.footer.returnPolicy ||
                    "Ürün iade ve değişimlerinde bu fiş ve ambalaj gereklidir"}
                </div>
                <div className="font-bold text-[10px]">
                  ***{" "}
                  {config?.footer.message ||
                    "Bizi tercih ettiğiniz için teşekkür ederiz"}{" "}
                  ***
                </div>

                {/* Machine Readable Section */}
                <div className="mt-3 pt-2 border-t border-dashed space-y-1">
                  <div className="text-[10px]">
                    EKÜ NO: {receiptData.receiptNo.toString().padStart(4, "0")}
                    <span className="mx-2">|</span>Z NO:{" "}
                    {receiptData.receiptNo.toString().padStart(4, "0")}
                  </div>
                  <div className="font-mono text-[8px] mt-1 tracking-widest">
                    ||| || ||| || || |||
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom tear effect */}
            <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[linear-gradient(45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%),linear-gradient(-45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%)] bg-size-[10px_10px]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
