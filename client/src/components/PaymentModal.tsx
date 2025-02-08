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
      {/* Ana Modal Kapsayıcısı */}
      <div className="bg-white rounded-xl p-4 w-[95%] max-w-md max-h-[90vh] overflow-y-auto relative shadow-lg">
        {/* POS İşlemi yükleniyor overlayi */}
        {processingPOS && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <div className="loader" />
            <p className="mt-2 text-gray-700 text-sm">
              POS İşlemi yapılıyor...
            </p>
          </div>
        )}

        {/* Başlık */}
        <h2 className="text-xl font-semibold text-gray-800 mb-3">
          Ödeme Ekranı
        </h2>

        {/* Toplam Bilgileri (üstte özet) */}
        <div className="bg-gray-50 border rounded-lg p-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Ara Toplam:</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>KDV:</span>
            <span className="font-medium">{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="font-semibold text-gray-700">Toplam Tutar:</span>
            <span className="font-semibold text-primary-600">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Ödeme Modu (Normal / Böl) */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("normal")}
            className={`flex-1 py-2 rounded text-sm font-medium ${
              mode === "normal"
                ? "bg-primary-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Normal Ödeme
          </button>
          <button
            onClick={() => setMode("split")}
            className={`flex-1 py-2 rounded text-sm font-medium ${
              mode === "split"
                ? "bg-primary-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Hesabı Böl
          </button>
        </div>

        {/* NORMAL ÖDEME BÖLÜMÜ */}
        {mode === "normal" && (
          <div className="space-y-4">
            {/* Ödeme Yöntemi */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Ödeme Yöntemi
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  ["nakit", "kart", "veresiye", "nakitpos"] as PaymentMethod[]
                ).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`border p-2 rounded text-sm ${
                      paymentMethod === m
                        ? "bg-primary-100 border-primary-500 text-primary-700"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {m === "nakit" && "Nakit"}
                    {m === "kart" && "Kredi Kartı"}
                    {m === "veresiye" && "Veresiye"}
                    {m === "nakitpos" && "Nakit POS"}
                  </button>
                ))}
              </div>
            </div>

            {/* Eğer nakit veya nakitpos seçildiyse "alınan tutar" girilebilir */}
            {(paymentMethod === "nakit" || paymentMethod === "nakitpos") && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Alınan Tutar
                </label>
                <input
                  ref={receivedInputRef}
                  type="number"
                  className="w-full border rounded p-2"
                  placeholder="0.00"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  disabled={processingPOS}
                />
                {receivedAmount && (
                  <p className="mt-1 text-xs text-gray-600">
                    {change >= 0
                      ? `Para üstü: ${formatCurrency(change)}`
                      : `Eksik: ${formatCurrency(Math.abs(change))}`}
                  </p>
                )}
              </div>
            )}

            {/* Veresiye seçiliyse müşteri seç */}
            {paymentMethod === "veresiye" && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Müşteri Seç
                </label>
                <select
                  value={selectedCustomer?.id || ""}
                  onChange={(e) =>
                    setSelectedCustomer(
                      customers.find(
                        (cust) => cust.id.toString() === e.target.value
                      ) || null
                    )
                  }
                  className="w-full border rounded p-2"
                >
                  <option value="">Müşteri Seçin</option>
                  {customers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} (Borç: {formatCurrency(cust.currentDebt)}) /
                      Limit: {formatCurrency(cust.creditLimit)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2 border rounded text-sm hover:bg-gray-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleNormalPayment}
                className="flex-1 py-2 bg-primary-600 text-white rounded text-sm"
              >
                Ödemeyi Tamamla
              </button>
            </div>
          </div>
        )}

        {/* SPLIT ÖDEME BÖLÜMÜ */}
        {mode === "split" && (
          <div>
            {/* Split türü seçimi: Ürün Bazında / Eşit Bölüşüm */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSplitType("product")}
                className={`flex-1 py-2 rounded text-sm font-medium ${
                  splitType === "product"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                Ürün Bazında
              </button>
              <button
                onClick={() => setSplitType("equal")}
                className={`flex-1 py-2 rounded text-sm font-medium ${
                  splitType === "equal"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                Eşit Bölüşüm
              </button>
            </div>

            {/* ÜRÜN BAZINDA */}
            {splitType === "product" && (
              <div className="space-y-4">
                {remainingItems.length === 0 ? (
                  <p className="text-center text-gray-600">
                    Tüm ürünlerin ödemesi alındı.
                  </p>
                ) : (
                  remainingItems.map((item) => (
                    <div key={item.id} className="border rounded p-3">
                      <div className="flex justify-between mb-2 text-sm font-medium">
                        <span>{item.name}</span>
                        <span>{formatCurrency(item.amount)}</span>
                      </div>
                      {/* Inline form */}
                      <div className="grid gap-2 text-sm">
                        <label>Ödeme Yöntemi</label>
                        <select
                          value={
                            productPaymentInputs[item.id]?.paymentMethod ||
                            "nakit"
                          }
                          onChange={(e) =>
                            setProductPaymentInputs((prev) => ({
                              ...prev,
                              [item.id]: {
                                paymentMethod: e.target.value as PaymentMethod,
                                received: prev[item.id]?.received || "",
                                customerId: prev[item.id]?.customerId || "",
                              },
                            }))
                          }
                          className="border rounded p-1"
                        >
                          <option value="nakit">Nakit</option>
                          <option value="kart">Kredi Kartı</option>
                          <option value="veresiye">Veresiye</option>
                          <option value="nakitpos">POS (Nakit)</option>
                        </select>

                        <label>Ödenen Tutar</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          className="border rounded p-1"
                          value={productPaymentInputs[item.id]?.received || ""}
                          onChange={(e) =>
                            setProductPaymentInputs((prev) => ({
                              ...prev,
                              [item.id]: {
                                paymentMethod:
                                  prev[item.id]?.paymentMethod || "nakit",
                                received: e.target.value,
                                customerId: prev[item.id]?.customerId || "",
                              },
                            }))
                          }
                        />

                        {productPaymentInputs[item.id]?.paymentMethod ===
                          "veresiye" && (
                          <>
                            <label>Müşteri Seç</label>
                            <select
                              className="border rounded p-1"
                              value={
                                productPaymentInputs[item.id]?.customerId || ""
                              }
                              onChange={(e) =>
                                setProductPaymentInputs((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    paymentMethod:
                                      prev[item.id]?.paymentMethod ||
                                      "veresiye",
                                    received: prev[item.id]?.received || "",
                                    customerId: e.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">Müşteri Seçin</option>
                              {customers.map((cust) => (
                                <option key={cust.id} value={cust.id}>
                                  {cust.name} (Borç:{" "}
                                  {formatCurrency(cust.currentDebt)}) / Limit:{" "}
                                  {formatCurrency(cust.creditLimit)}
                                </option>
                              ))}
                            </select>
                          </>
                        )}

                        <button
                          onClick={() => handleProductPay(item.id)}
                          className="mt-2 bg-green-600 text-white py-1 rounded hover:bg-green-700"
                        >
                          Öde
                        </button>
                      </div>
                    </div>
                  ))
                )}
                {remainingItems.length === 0 && (
                  <button
                    onClick={handleFinalizeSplit}
                    className="w-full py-2 bg-primary-600 text-white rounded hover:bg-primary-700 mt-3"
                  >
                    Tüm Ödemeler Tamam
                  </button>
                )}
              </div>
            )}

            {/* EŞİT BÖLÜŞÜM */}
            {splitType === "equal" && (
              <div className="space-y-4">
                <div className="text-sm border p-3 rounded">
                  <label className="block mb-1 font-medium">Kaç kişi?</label>
                  <input
                    type="number"
                    className="border rounded p-1 w-full"
                    value={friendCount}
                    onChange={(e) => {
                      const cnt = parseInt(e.target.value) || 1;
                      setFriendCount(cnt);
                      setEqualPayments(
                        Array(cnt).fill({
                          paymentMethod: "nakit",
                          received: "",
                          customerId: "",
                        })
                      );
                    }}
                    min={1}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Toplam: {formatCurrency(total)} / Kişi başı ortalama:{" "}
                    {formatCurrency(total / friendCount)}
                  </p>
                </div>

                {/* Her kişi için ödeme girişi */}
                {Array.from({ length: friendCount }, (_, i) => {
                  const pay = equalPayments[i] || {
                    paymentMethod: "nakit",
                    received: "",
                    customerId: "",
                  };
                  return (
                    <div key={i} className="border p-3 rounded text-sm">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">Kişi {i + 1}</span>
                      </div>
                      <div className="grid gap-2">
                        <label>Ödeme Yöntemi</label>
                        <select
                          value={pay.paymentMethod}
                          onChange={(e) =>
                            handleEqualChange(i, {
                              ...pay,
                              paymentMethod: e.target.value as PaymentMethod,
                            })
                          }
                          className="border rounded p-1"
                        >
                          <option value="nakit">Nakit</option>
                          <option value="kart">Kart</option>
                          <option value="veresiye">Veresiye</option>
                          <option value="nakitpos">POS (Nakit)</option>
                        </select>

                        <label>Kişinin Ödemesi</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={pay.received}
                          onChange={(e) =>
                            handleEqualChange(i, {
                              ...pay,
                              received: e.target.value,
                            })
                          }
                          className="border rounded p-1"
                        />

                        {pay.paymentMethod === "veresiye" && (
                          <>
                            <label>Müşteri Seç</label>
                            <select
                              className="border rounded p-1"
                              value={pay.customerId}
                              onChange={(e) =>
                                handleEqualChange(i, {
                                  ...pay,
                                  customerId: e.target.value,
                                })
                              }
                            >
                              <option value="">Seç</option>
                              {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} (Borç:{" "}
                                  {formatCurrency(c.currentDebt)}) /{" "}
                                  {formatCurrency(c.creditLimit)}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={handleFinalizeSplit}
                  className="w-full py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  Ödemeleri Tamamla
                </button>
              </div>
            )}
          </div>
        )}

        {/* Alt İptal Butonu - sadece modalı kapatma (Normal + Split için ortak) */}
        {mode === "split" && (
          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full py-2 border text-sm rounded hover:bg-gray-100"
            >
              Vazgeç / Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
