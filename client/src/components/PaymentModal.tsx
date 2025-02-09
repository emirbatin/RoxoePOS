// PaymentModal.tsx

import React, { useState, useRef, useEffect } from "react";
import { formatCurrency } from "../utils/vatUtils";
import { posService } from "../services/posServices";
import { creditService } from "../services/creditServices";
import { PaymentModalProps, PaymentResult, PaymentMethod } from "../types/pos";
import { Customer } from "../types/credit";

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
  items = [],
}) => {
  // Ödeme modları: "normal" (tek sefer), "split" (bölünmüş)
  const [mode, setMode] = useState<"normal" | "split">("normal");
  // Eğer split seçildiyse: "product" (ürün bazında) veya "equal" (eşit bölüşüm)
  const [splitType, setSplitType] = useState<"product" | "equal">("product");

  // NORMAL ödeme state'leri
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("nakit");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [processingPOS, setProcessingPOS] = useState(false);
  const receivedInputRef = useRef<HTMLInputElement>(null);

  // ÜRÜN BAZINDA SPLIT
  const [remainingItems, setRemainingItems] = useState(items);
  const [productPayments, setProductPayments] = useState<
    {
      itemId: number;
      paymentMethod: PaymentMethod;
      received: number;
      customer?: Customer | null;
    }[]
  >([]);
  const [productPaymentInputs, setProductPaymentInputs] = useState<
    Record<
      number,
      { paymentMethod: PaymentMethod; received: string; customerId: string }
    >
  >({});

  // EŞİT BÖLÜŞÜM SPLIT
  const [friendCount, setFriendCount] = useState(2);
  const [equalPayments, setEqualPayments] = useState<
    { paymentMethod: PaymentMethod; received: string; customerId: string }[]
  >([]);

  // Modal açılınca miktar inputuna odaklanmak
  useEffect(() => {
    if (isOpen && receivedInputRef.current) {
      receivedInputRef.current.focus();
    }
  }, [isOpen]);

  // Modal kapandığında tüm stateleri sıfırlama
  useEffect(() => {
    if (!isOpen) {
      setMode("normal");
      setSplitType("product");
      setPaymentMethod("nakit");
      setReceivedAmount("");
      setSelectedCustomer(null);
      setProcessingPOS(false);
      setRemainingItems(items);
      setProductPayments([]);
      setProductPaymentInputs({});
      setFriendCount(2);
      setEqualPayments([]);
    }
  }, [isOpen, items, setSelectedCustomer]);

  // Veresiye limiti kontrol yardımı
  const checkVeresiyeLimit = (cust: Customer, amount: number) => {
    return cust.currentDebt + amount <= cust.creditLimit;
  };

  /** =======================
   *       NORMAL ÖDEME
   *  ======================= */
  const parsedReceived = parseFloat(receivedAmount) || 0;
  const change = parsedReceived - total;

  const handleNormalPayment = async () => {
    // Eksik ödeme
    if (
      (paymentMethod === "nakit" || paymentMethod === "nakitpos") &&
      parsedReceived < total
    ) {
      alert(
        "Lütfen en az toplam tutar kadar nakit veya nakit pos ödemesi girin."
      );
      return;
    }

    // Veresiye müşteri + limit
    if (paymentMethod === "veresiye") {
      if (!selectedCustomer) {
        alert("Veresiye için müşteri seçmeniz gerekiyor.");
        return;
      }
      if (!checkVeresiyeLimit(selectedCustomer, total)) {
        alert("Seçilen müşterinin limiti yetersiz!");
        return;
      }
    }

    // Kart veya NakitPOS -> POS işlemi
    if (paymentMethod === "kart" || paymentMethod === "nakitpos") {
      setProcessingPOS(true);
      try {
        const connected = await posService.connect("Ingenico");
        if (!connected) {
          alert("POS cihazına bağlanılamadı!");
          return;
        }
        const result = await posService.processPayment(total);
        if (!result.success) {
          alert(result.message);
        } else {
          onComplete({
            mode: "normal",
            paymentMethod,
            received: parsedReceived,
          });
        }
      } catch (error) {
        alert("POS işlemi sırasında bir hata oluştu!");
        console.error(error);
      } finally {
        setProcessingPOS(false);
        await posService.disconnect();
      }
      return; // POS akışı bitti
    }

    // Diğer durum: nakit veya veresiye
    onComplete({ mode: "normal", paymentMethod, received: parsedReceived });
  };

  /** =======================
   *   ÜRÜN BAZINDA SPLIT
   *  ======================= */
  const handleProductPay = async (itemId: number) => {
    const input = productPaymentInputs[itemId];
    if (!input) {
      alert("Bu ürün için ödeme yöntemi ve tutar girilmedi!");
      return;
    }

    const { paymentMethod: pm, received, customerId } = input;
    const receivedNum = parseFloat(received);
    const item = remainingItems.find((i) => i.id === itemId);
    if (!item) {
      alert("Ürün bulunamadı!");
      return;
    }

    if (isNaN(receivedNum) || receivedNum <= 0) {
      alert("Geçerli bir ödeme tutarı girin!");
      return;
    }
    if (receivedNum < item.amount) {
      alert(
        `Eksik ödeme! Bu ürün için en az ${formatCurrency(
          item.amount
        )} girmelisiniz.`
      );
      return;
    }

    let cust: Customer | null = null;
    if (pm === "veresiye") {
      if (!customerId) {
        alert("Veresiye seçtiniz, lütfen müşteri belirleyin.");
        return;
      }
      const foundCust = customers.find((c) => c.id.toString() === customerId);
      if (!foundCust) {
        alert("Geçersiz müşteri!");
        return;
      }
      if (!checkVeresiyeLimit(foundCust, item.amount)) {
        alert("Müşteri limiti yetersiz!");
        return;
      }
      cust = foundCust;
    }

    if (pm === "kart" || pm === "nakitpos") {
      setProcessingPOS(true);
      try {
        const connected = await posService.connect("Ingenico");
        if (!connected) {
          alert("POS cihazına bağlanılamadı!");
          setProcessingPOS(false);
          return;
        }
        const result = await posService.processPayment(item.amount);
        setProcessingPOS(false);
        await posService.disconnect();

        if (!result.success) {
          alert(result.message);
          return;
        }
      } catch (error) {
        setProcessingPOS(false);
        alert("POS işlemi sırasında bir hata oldu!");
        console.error(error);
        return;
      }
    }

    // Başarılı
    setProductPayments((prev) => [
      ...prev,
      { itemId, paymentMethod: pm, received: receivedNum, customer: cust },
    ]);
    setRemainingItems((prev) => prev.filter((x) => x.id !== itemId));
    setProductPaymentInputs((prev) => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
  };

  /** =======================
   *   EŞİT BÖLÜŞÜM SPLIT
   *  ======================= */
  const handleEqualChange = (
    index: number,
    updates: {
      paymentMethod: PaymentMethod;
      received: string;
      customerId: string;
    }
  ) => {
    const newPays = [...equalPayments];
    newPays[index] = updates;
    setEqualPayments(newPays);
  };

  const handleFinalizeSplit = () => {
    if (splitType === "equal") {
      let sum = 0;
      for (let i = 0; i < friendCount; i++) {
        const p = equalPayments[i];
        if (!p) {
          alert(`${i + 1}. kişi için ödeme bilgisi eksik!`);
          return;
        }
        const val = parseFloat(p.received) || 0;
        sum += val;

        if (p.paymentMethod === "veresiye" && val > 0) {
          if (!p.customerId) {
            alert(`${i + 1}. kişi veresiye seçti ama müşteri belirlenmedi!`);
            return;
          }
          const c = customers.find(
            (cust) => cust.id.toString() === p.customerId
          );
          if (!c) {
            alert(`${i + 1}. kişi için seçilen müşteri hatalı!`);
            return;
          }
          if (!checkVeresiyeLimit(c, val)) {
            alert(`${i + 1}. kişinin veresiye limiti yetersiz!`);
            return;
          }
        }
      }
      if (sum < total) {
        alert(
          `Toplam tutar: ${formatCurrency(
            total
          )}. Şu an girilen toplam: ${formatCurrency(sum)}. Eksik ödeme!`
        );
        return;
      }
    }
    // Ürün bazında split'te direkt onComplete
    onComplete({
      mode: "split",
      splitOption: splitType,
      productPayments: splitType === "product" ? productPayments : undefined,
      equalPayments:
        splitType === "equal"
          ? equalPayments.map((p) => ({
              paymentMethod: p.paymentMethod,
              received: parseFloat(p.received) || 0,
              customer:
                p.paymentMethod === "veresiye"
                  ? customers.find((c) => c.id.toString() === p.customerId) ||
                    null
                  : null,
            }))
          : undefined,
    });
  };

  /** =======================
   *         RENDER
   *  ======================= */

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="text-2xl font-semibold mb-2">Ödeme Ekranı</h2>
          {processingPOS && (
            <div className="bg-blue-50 text-blue-700 p-3 rounded-md mb-4">
              POS işlemi yapılıyor...
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-xl font-semibold mb-2">Ödeme Özeti</h3>
            <div className="bg-gray-50 p-4 rounded-md shadow-sm space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Ara Toplam:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>KDV:</span>
                <span className="font-medium">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-800 font-semibold border-t pt-2">
                <span>Toplam Tutar:</span>
                <span className="text-primary-600">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">Ödeme Modu</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode("normal")}
                className={`py-3 rounded-md font-medium ${
                  mode === "normal"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Normal Ödeme
              </button>
              <button
                onClick={() => setMode("split")}
                className={`py-3 rounded-md font-medium ${
                  mode === "split"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Hesabı Böl
              </button>
            </div>
          </section>

          {mode === "normal" && (
            <section className="space-y-4">
              <h3 className="text-xl font-semibold mb-2">Ödeme Yöntemi</h3>
              <div className="grid grid-cols-2 gap-4">
                {(
                  ["nakit", "kart", "veresiye", "nakitpos"] as PaymentMethod[]
                ).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`py-3 rounded-md ${
                      paymentMethod === method
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {method === "nakit" && "💵 Nakit"}
                    {method === "kart" && "💳 Kredi Kartı"}
                    {method === "veresiye" && "🧾 Veresiye"}
                    {method === "nakitpos" && "💵 Nakit POS"}
                  </button>
                ))}
              </div>

              {(paymentMethod === "nakit" || paymentMethod === "nakitpos") && (
                <div className="space-y-2">
                  <input
                    ref={receivedInputRef}
                    type="number"
                    placeholder="Alınan Tutar"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {receivedAmount && (
                    <div
                      className={`px-4 py-2 rounded-md ${
                        change >= 0
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {change >= 0
                        ? `Para Üstü: ${formatCurrency(change)}`
                        : `Eksik Ödeme: ${formatCurrency(Math.abs(change))}`}
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "veresiye" && (
                <div className="space-y-2">
                  <select
                    value={selectedCustomer?.id || ""}
                    onChange={(e) =>
                      setSelectedCustomer(
                        customers.find(
                          (customer) => customer.id === parseInt(e.target.value)
                        ) || null
                      )
                    }
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Müşteri Seçin</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} (Borç:{" "}
                        {formatCurrency(customer.currentDebt)}) / Limit:{" "}
                        {formatCurrency(customer.creditLimit)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>
          )}

          {mode === "split" && (
            <section className="space-y-4">
              <h3 className="text-xl font-semibold mb-2">
                Hesap Bölme Seçeneği
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSplitType("product")}
                  className={`py-3 rounded-md font-medium ${
                    splitType === "product"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  Ürün Bazında
                </button>
                <button
                  onClick={() => setSplitType("equal")}
                  className={`py-3 rounded-md font-medium ${
                    splitType === "equal"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  Eşit Bölüşüm
                </button>
              </div>

              {splitType === "product" && (
                <div className="space-y-4">
                  {remainingItems.length === 0 ? (
                    <div className="bg-green-50 text-green-700 px-4 py-2 rounded-md">
                      Tüm ürünler ödendi.
                    </div>
                  ) : (
                    remainingItems.map((item) => (
                      <div key={item.id} className="p-4 border rounded-md">
                        <div className="flex justify-between items-center mb-2">
                          <span>{item.name}</span>
                          <span className="font-medium">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <select
                            value={
                              productPaymentInputs[item.id]?.paymentMethod ||
                              "nakit"
                            }
                            onChange={(e) =>
                              setProductPaymentInputs((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  paymentMethod: e.target
                                    .value as PaymentMethod,
                                },
                              }))
                            }
                            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="nakit">Nakit</option>
                            <option value="kart">Kredi Kartı</option>
                            <option value="veresiye">Veresiye</option>
                            <option value="nakitpos">POS (Nakit)</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Ödenen Tutar"
                            value={
                              productPaymentInputs[item.id]?.received || ""
                            }
                            onChange={(e) =>
                              setProductPaymentInputs((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  received: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {productPaymentInputs[item.id]?.paymentMethod ===
                            "veresiye" && (
                            <select
                              value={
                                productPaymentInputs[item.id]?.customerId || ""
                              }
                              onChange={(e) =>
                                setProductPaymentInputs((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    customerId: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="">Müşteri Seçin</option>
                              {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                  {customer.name} (Borç:{" "}
                                  {formatCurrency(customer.currentDebt)}) /
                                  Limit: {formatCurrency(customer.creditLimit)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <button
                          onClick={() => handleProductPay(item.id)}
                          className="w-full mt-2 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                        >
                          Öde
                        </button>
                      </div>
                    ))
                  )}

                  {remainingItems.length === 0 && (
                    <button
                      onClick={handleFinalizeSplit}
                      className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Tüm Ödemeler Tamamlandı
                    </button>
                  )}
                </div>
              )}

              {splitType === "equal" && (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <input
                      type="number"
                      placeholder="Kişi Sayısı"
                      value={friendCount}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 1;
                        setFriendCount(count);
                        setEqualPayments(
                          Array(count).fill({
                            paymentMethod: "nakit",
                            received: "",
                            customerId: "",
                          })
                        );
                      }}
                      min={1}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex justify-between mt-2 text-sm text-gray-600">
                      <span>Toplam Tutar:</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Kişi Başı:</span>
                      <span>{formatCurrency(total / friendCount)}</span>
                    </div>
                  </div>

                  {Array.from({ length: friendCount }, (_, i) => {
                    const payment = equalPayments[i] || {
                      paymentMethod: "nakit",
                      received: "",
                      customerId: "",
                    };

                    return (
                      <div key={i} className="p-4 border rounded-md">
                        <h4 className="font-medium mb-2">Kişi {i + 1}</h4>
                        <div className="space-y-2">
                          <select
                            value={payment.paymentMethod}
                            onChange={(e) =>
                              handleEqualChange(i, {
                                ...payment,
                                paymentMethod: e.target.value as PaymentMethod,
                              })
                            }
                            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="nakit">Nakit</option>
                            <option value="kart">Kart</option>
                            <option value="veresiye">Veresiye</option>
                            <option value="nakitpos">POS (Nakit)</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Kişinin Ödemesi"
                            value={payment.received}
                            onChange={(e) =>
                              handleEqualChange(i, {
                                ...payment,
                                received: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {payment.paymentMethod === "veresiye" && (
                            <select
                              value={payment.customerId}
                              onChange={(e) =>
                                handleEqualChange(i, {
                                  ...payment,
                                  customerId: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="">Müşteri Seç</option>
                              {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                  {customer.name} (Borç:{" "}
                                  {formatCurrency(customer.currentDebt)}) /{" "}
                                  {formatCurrency(customer.creditLimit)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={handleFinalizeSplit}
                    className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Ödemeleri Tamamla
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {mode === "split" && (
          <div className="px-6 py-4 border-t">
            <button
              onClick={onClose}
              className="w-full py-2 border rounded-md hover:bg-gray-50"
            >
              Vazgeç
            </button>
          </div>
        )}

        {mode === "normal" && (
          <div className="px-6 py-4 border-t flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Vazgeç
            </button>
            <button
              onClick={handleNormalPayment}
              className={`px-4 py-2 rounded-md text-white ${
                (paymentMethod === "nakit" && change < 0) ||
                (paymentMethod === "veresiye" && !selectedCustomer)
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-primary-600 hover:bg-primary-700"
              }`}
              disabled={
                (paymentMethod === "nakit" && change < 0) ||
                (paymentMethod === "veresiye" && !selectedCustomer)
              }
            >
              Ödemeyi Tamamla
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
