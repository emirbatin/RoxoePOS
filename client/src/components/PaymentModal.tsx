// PaymentModal.tsx
import React, { useState, useRef, useEffect } from "react";
import { formatCurrency } from "../utils/vatUtils";
import { posService } from "../services/posServices";
import { PaymentModalProps, PaymentMethod } from "../types/pos";
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
    // Eksik ödeme kontrolü
    if (
      (paymentMethod === "nakit" || paymentMethod === "nakitpos") &&
      parsedReceived < total
    ) {
      alert(
        "Lütfen en az toplam tutar kadar nakit veya nakit pos ödemesi girin."
      );
      return;
    }

    // Veresiye müşteri + limit kontrolü
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
        const isManualMode = await posService.isManualMode();

        // Manuel modda direkt başarılı sayıyoruz
        if (isManualMode) {
          onComplete({
            mode: "normal",
            paymentMethod,
            received: parsedReceived,
          });
          setProcessingPOS(false);
          return;
        }

        // Normal modda POS bağlantısı ve işlem
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
      return;
    }

    // Diğer durumlar: nakit veya veresiye
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

    // Nakit veya NakitPOS için para üstü kontrolü
    if ((pm === "nakit" || pm === "nakitpos") && receivedNum > item.amount) {
      const change = receivedNum - item.amount;
      const shouldContinue = window.confirm(
        `Para üstü: ${formatCurrency(
          change
        )}. Ödemeyi tamamlamak istiyor musunuz?`
      );
      if (!shouldContinue) {
        return;
      }
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
        const isManualMode = await posService.isManualMode();

        // Manuel modda direkt başarılı sayıyoruz
        if (isManualMode) {
          // Başarılı ödeme
          setProductPayments((prev) => [
            ...prev,
            {
              itemId,
              paymentMethod: pm,
              received: receivedNum,
              customer: cust,
            },
          ]);
          setRemainingItems((prev) => prev.filter((x) => x.id !== itemId));
          setProductPaymentInputs((prev) => {
            const updated = { ...prev };
            delete updated[itemId];
            return updated;
          });
          setProcessingPOS(false);
          return;
        }

        // Normal modda POS bağlantısı ve işlem
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

    // Başarılı ödeme - tüm ödeme tipleri için son işlemler
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

  const handleFinalizeSplit = async () => {
    if (splitType === "equal") {
      let sum = 0;
      const perPersonAmount = total / friendCount;

      // POS işlemleri için manuel mod kontrolü
      const isManualMode = await posService.isManualMode();

      // Her bir kişinin ödemesini kontrol et
      for (let i = 0; i < friendCount; i++) {
        const p = equalPayments[i];
        if (!p) {
          alert(`${i + 1}. kişi için ödeme bilgisi eksik!`);
          return;
        }

        const val = parseFloat(p.received) || 0;
        sum += val;

        // Nakit veya NakitPOS için para üstü kontrolü
        if (
          (p.paymentMethod === "nakit" || p.paymentMethod === "nakitpos") &&
          val > perPersonAmount
        ) {
          const change = val - perPersonAmount;
          const shouldContinue = window.confirm(
            `${i + 1}. kişi için para üstü: ${formatCurrency(
              change
            )}. Devam etmek istiyor musunuz?`
          );
          if (!shouldContinue) {
            return;
          }
        }

        // Veresiye kontrolleri
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

        // Kart veya POS ödemeleri için kontrol
        if (
          (p.paymentMethod === "kart" || p.paymentMethod === "nakitpos") &&
          val > 0
        ) {
          setProcessingPOS(true);

          try {
            // Manuel modda kontrole gerek yok, direkt devam et
            if (!isManualMode) {
              const connected = await posService.connect("Ingenico");
              if (!connected) {
                alert(`${i + 1}. kişi için POS cihazına bağlanılamadı!`);
                setProcessingPOS(false);
                return;
              }

              const result = await posService.processPayment(val);
              if (!result.success) {
                alert(
                  `${i + 1}. kişi için POS işlemi başarısız: ${result.message}`
                );
                setProcessingPOS(false);
                await posService.disconnect();
                return;
              }

              await posService.disconnect();
            }
          } catch (error) {
            setProcessingPOS(false);
            alert(`${i + 1}. kişi için POS işlemi sırasında hata oluştu!`);
            console.error(error);
            return;
          }
        }
      }

      setProcessingPOS(false);

      // Toplam tutar kontrolü
      if (sum < total) {
        alert(
          `Toplam tutar: ${formatCurrency(
            total
          )}. Şu an girilen toplam: ${formatCurrency(sum)}. Eksik ödeme!`
        );
        return;
      } else if (sum > total) {
        const totalChange = sum - total;
        const shouldContinue = window.confirm(
          `Toplam para üstü: ${formatCurrency(
            totalChange
          )}. Ödemeyi tamamlamak istiyor musunuz?`
        );
        if (!shouldContinue) {
          return;
        }
      }
    }

    // Ödemeyi tamamla
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Üst Kısım */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Ödeme Yap
              </h2>
              <p className="text-gray-500 mt-1">Ödemeyi Tamamlayın</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Toplam Tutar</p>
                <p className="text-2xl font-semibold text-primary-600">
                  {formatCurrency(total)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {processingPOS && (
            <div className="mt-4 bg-blue-50 text-blue-700 px-4 py-3 rounded-xl flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-700 border-t-transparent" />
              <span className="font-medium">POS Ödemesi İşleniyor...</span>
            </div>
          )}
        </div>

        {/* Ana İçerik Alanı */}
        <div className="flex-1 overflow-auto">
          <div className="p-8 space-y-8">
            {/* Ödeme Özeti Kartı */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Ödeme Özeti
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Ara Tutar</span>
                  <span className="font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>KDV</span>
                  <span className="font-medium">
                    {formatCurrency(vatAmount)}
                  </span>
                </div>
                <div className="h-px bg-gray-200 my-2" />
                <div className="flex justify-between text-lg font-semibold text-gray-900">
                  <span>Toplam</span>
                  <span className="text-primary-600">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Ödeme Türü Seçimi */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Ödeme Türü</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setMode("normal")}
                  className={`px-6 py-4 rounded-xl transition-all duration-200 ${
                    mode === "normal"
                      ? "bg-primary-600 text-white shadow-lg shadow-primary-100 ring-2 ring-primary-600 ring-offset-2"
                      : "bg-white border-2 border-gray-200 text-gray-700 hover:border-primary-600 hover:text-primary-600"
                  }`}
                >
                  <span className="text-lg font-medium">Normal Ödeme</span>
                </button>
                <button
                  onClick={() => setMode("split")}
                  className={`px-6 py-4 rounded-xl transition-all duration-200 ${
                    mode === "split"
                      ? "bg-primary-600 text-white shadow-lg shadow-primary-100 ring-2 ring-primary-600 ring-offset-2"
                      : "bg-white border-2 border-gray-200 text-gray-700 hover:border-primary-600 hover:text-primary-600"
                  }`}
                >
                  <span className="text-lg font-medium">Bölünmüş Ödeme</span>
                </button>
              </div>
            </div>

            {/* Normal Ödeme Bölümü */}
            {mode === "normal" && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Ödeme Yöntemi
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {(
                    ["nakit", "kart", "veresiye", "nakitpos"] as PaymentMethod[]
                  ).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`group p-4 rounded-xl transition-all duration-200 ${
                        paymentMethod === method
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-100"
                          : "bg-white border-2 border-gray-200 text-gray-700 hover:border-primary-600"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {method === "nakit" && "💵"}
                          {method === "kart" && "💳"}
                          {method === "veresiye" && "🧾"}
                          {method === "nakitpos" && "💵"}
                        </span>
                        <span className="text-lg font-medium">
                          {method === "nakit" && "Nakit"}
                          {method === "kart" && "Kredi Kartı"}
                          {method === "veresiye" && "Veresiye"}
                          {method === "nakitpos" && "Nakit POS"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {(paymentMethod === "nakit" ||
                  paymentMethod === "nakitpos") && (
                  <div className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Alınan Tutar
                    </label>
                    <div className="relative">
                      <input
                        ref={receivedInputRef}
                        type="number"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
                        placeholder="0.00"
                      />
                      {parsedReceived > total && (
                        <div className="absolute right-0 top-full mt-2 text-green-600 font-medium">
                          Para Üstü: {formatCurrency(parsedReceived - total)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {paymentMethod === "veresiye" && (
                  <div className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Müşteri Seçin
                    </label>
                    <select
                      value={selectedCustomer?.id || ""}
                      onChange={(e) =>
                        setSelectedCustomer(
                          customers.find(
                            (c) => c.id === parseInt(e.target.value)
                          ) || null
                        )
                      }
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-700"
                    >
                      <option value="">Bir Müşteri Seçin</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} (Borç:{" "}
                          {formatCurrency(customer.currentDebt)} / Limit:{" "}
                          {formatCurrency(customer.creditLimit)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Bölünmüş Ödeme Bölümü */}
            {mode === "split" && (
              <div className="space-y-6">
                {/* Bölünme Tipi Sekmeleri */}
                <div className="bg-white rounded-xl border-2 border-gray-200">
                  <nav className="flex p-1 gap-2">
                    <button
                      onClick={() => setSplitType("product")}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        splitType === "product"
                          ? "bg-primary-600 text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      Ürün Bazında
                    </button>
                    <button
                      onClick={() => setSplitType("equal")}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        splitType === "equal"
                          ? "bg-primary-600 text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      Eşit Bölünmüş
                    </button>
                  </nav>
                </div>

                {/* Ürün Bazında Bölünme */}
                {splitType === "product" && (
                  <div className="space-y-6">
                    <div className="grid gap-4">
                      {remainingItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-primary-200 transition-colors"
                        >
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-lg font-medium text-gray-900">
                              {item.name}
                            </span>
                            <span className="text-xl font-semibold text-primary-600">
                              {formatCurrency(item.amount)}
                            </span>
                          </div>

                          <div className="space-y-4">
                            {/* Ödeme Yöntemleri */}
                            <div className="grid grid-cols-2 gap-2">
                              {(
                                [
                                  "nakit",
                                  "kart",
                                  "veresiye",
                                  "nakitpos",
                                ] as PaymentMethod[]
                              ).map((method) => (
                                <button
                                  key={method}
                                  onClick={() =>
                                    setProductPaymentInputs((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        paymentMethod: method,
                                      },
                                    }))
                                  }
                                  className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                                    productPaymentInputs[item.id]
                                      ?.paymentMethod === method
                                      ? "bg-primary-600 text-white"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  }`}
                                >
                                  <span className="flex items-center justify-center gap-2">
                                    {method === "nakit" && "💵 Nakit"}
                                    {method === "kart" && "💳 Kart"}
                                    {method === "veresiye" && "🧾 Veresiye"}
                                    {method === "nakitpos" && "💵 Nakit POS"}
                                  </span>
                                </button>
                              ))}
                            </div>

                            {/* Tutar Girişi */}
                            <input
                              type="number"
                              placeholder={`Ödeme Tutarı (Min: ${formatCurrency(
                                item.amount
                              )})`}
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
                              className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />

                            {/* Veresiye için Müşteri Seçimi */}
                            {productPaymentInputs[item.id]?.paymentMethod ===
                              "veresiye" && (
                              <select
                                value={
                                  productPaymentInputs[item.id]?.customerId ||
                                  ""
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
                                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              >
                                <option value="">Müşteri Seçin</option>
                                {customers.map((customer) => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.name} (
                                    {formatCurrency(customer.currentDebt)} /
                                    {formatCurrency(customer.creditLimit)})
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* Öde Butonu */}
                            <button
                              onClick={() => handleProductPay(item.id)}
                              disabled={
                                !productPaymentInputs[item.id]?.received ||
                                parseFloat(
                                  productPaymentInputs[item.id]?.received
                                ) < item.amount ||
                                (productPaymentInputs[item.id]
                                  ?.paymentMethod === "veresiye" &&
                                  !productPaymentInputs[item.id]?.customerId)
                              }
                              className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${
                                !productPaymentInputs[item.id]?.received ||
                                parseFloat(
                                  productPaymentInputs[item.id]?.received
                                ) < item.amount ||
                                (productPaymentInputs[item.id]
                                  ?.paymentMethod === "veresiye" &&
                                  !productPaymentInputs[item.id]?.customerId)
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-100"
                              }`}
                            >
                              Öde
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tamamlanan Ödemeler Özeti */}
                    {productPayments.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">
                          Tamamlanan Ödemeler
                        </h4>
                        <div className="space-y-3">
                          {productPayments.map((payment, index) => {
                            const item = items.find(
                              (i) => i.id === payment.itemId
                            );
                            if (!item) return null;

                            return (
                              <div
                                key={index}
                                className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-medium text-gray-900">
                                    {item.name}
                                  </span>
                                  <div className="text-sm text-gray-500 mt-1">
                                    {payment.paymentMethod === "veresiye" &&
                                    payment.customer
                                      ? `Veresiye: ${payment.customer.name}`
                                      : payment.paymentMethod}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-primary-600">
                                    {formatCurrency(payment.received)}
                                  </div>
                                  {payment.received > item.amount && (
                                    <div className="text-sm text-green-600">
                                      Para Üstü:{" "}
                                      {formatCurrency(
                                        payment.received - item.amount
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ürün Bazında Bölünmede Tüm Ödemeleri Tamamla Butonu */}
                    {remainingItems.length === 0 && (
                      <button
                        onClick={handleFinalizeSplit}
                        className="w-full py-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors shadow-lg shadow-green-100"
                      >
                        Tüm Ödemeleri Tamamla
                      </button>
                    )}
                  </div>
                )}

                {/* Eşit Bölünmüş UI */}
                {splitType === "equal" && (
                  <div className="space-y-6">
                    {/* Kişi Sayısı Girişi */}
                    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Kişi Sayısı
                          </label>
                          <input
                            type="number"
                            value={friendCount}
                            onChange={(e) => {
                              const count = Math.max(
                                1,
                                parseInt(e.target.value) || 1
                              );
                              setFriendCount(count);
                              setEqualPayments(
                                Array(count).fill({
                                  paymentMethod: "nakit",
                                  received: "",
                                  customerId: "",
                                })
                              );
                            }}
                            min="1"
                            className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            Kişi Başına:
                          </div>
                          <div className="text-2xl font-bold text-primary-600">
                            {formatCurrency(total / friendCount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bireysel Ödeme Formları */}
                    <div className="grid gap-4">
                      {Array.from({ length: friendCount }, (_, i) => {
                        const payment = equalPayments[i] || {
                          paymentMethod: "nakit",
                          received: "",
                          customerId: "",
                        };
                        const perPersonAmount = total / friendCount;

                        return (
                          <div
                            key={i}
                            className="bg-white rounded-xl border-2 border-gray-200 p-6"
                          >
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <h4 className="text-lg font-medium text-gray-900">
                                  Kişi {i + 1}
                                </h4>
                                <span className="text-sm text-gray-500">
                                  Ödenecek Tutar: {formatCurrency(perPersonAmount)}
                                </span>
                              </div>

                              {/* Ödeme Yöntemleri */}
                              <div className="grid grid-cols-2 gap-2">
                                {(
                                  [
                                    "nakit",
                                    "kart",
                                    "veresiye",
                                    "nakitpos",
                                  ] as PaymentMethod[]
                                ).map((method) => (
                                  <button
                                    key={method}
                                    onClick={() =>
                                      handleEqualChange(i, {
                                        ...payment,
                                        paymentMethod: method,
                                      })
                                    }
                                    className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                                      payment.paymentMethod === method
                                        ? "bg-primary-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    <span className="flex items-center justify-center gap-2">
                                      {method === "nakit" && "💵 Nakit"}
                                      {method === "kart" && "💳 Kart"}
                                      {method === "veresiye" && "🧾 Veresiye"}
                                      {method === "nakitpos" && "💵 Nakit POS"}
                                    </span>
                                  </button>
                                ))}
                              </div>

                              {/* Tutar Girişi */}
                              <input
                                type="number"
                                placeholder="Ödeme Tutarı"
                                value={payment.received}
                                onChange={(e) =>
                                  handleEqualChange(i, {
                                    ...payment,
                                    received: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              />

                              {/* Veresiye için Müşteri Seçimi */}
                              {payment.paymentMethod === "veresiye" && (
                                <select
                                  value={payment.customerId}
                                  onChange={(e) =>
                                    handleEqualChange(i, {
                                      ...payment,
                                      customerId: e.target.value,
                                    })
                                  }
                                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                  <option value="">Müşteri Seçin</option>
                                  {customers.map((customer) => (
                                    <option
                                      key={customer.id}
                                      value={customer.id}
                                    >
                                      {customer.name} (
                                      {formatCurrency(customer.currentDebt)} /
                                      {formatCurrency(customer.creditLimit)})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Eşit Bölüşüm Ödeme Özeti */}
                    {equalPayments.some(
                      (p) => parseFloat(p.received || "0") > 0
                    ) && (
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">
                          Ödeme Özeti
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between text-gray-700">
                            <span>Toplam Alınan:</span>
                            <span className="font-medium">
                              {formatCurrency(
                                equalPayments.reduce(
                                  (sum, p) =>
                                    sum + (parseFloat(p.received) || 0),
                                  0
                                )
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-gray-700">
                            <span>Toplam Tutar:</span>
                            <span className="font-medium">
                              {formatCurrency(total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Eşit Bölüşüm Ödemelerini Tamamla Butonu */}
                    <button
                      onClick={handleFinalizeSplit}
                      className={`w-full py-4 rounded-xl font-medium transition-all duration-200 ${
                        !equalPayments.every(
                          (p) => parseFloat(p.received || "0") > 0
                        )
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-100"
                      }`}
                      disabled={
                        !equalPayments.every(
                          (p) => parseFloat(p.received || "0") > 0
                        )
                      }
                    >
                      Ödemeleri Tamamla
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Alt Kısım */}
        <div className="px-8 py-6 border-t border-gray-100 bg-white">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              İptal
            </button>

            {mode === "normal" && (
              <button
                onClick={handleNormalPayment}
                disabled={
                  (paymentMethod === "nakit" && parsedReceived < total) ||
                  (paymentMethod === "veresiye" && !selectedCustomer)
                }
                className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 ${
                  (paymentMethod === "nakit" && parsedReceived < total) ||
                  (paymentMethod === "veresiye" && !selectedCustomer)
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-100"
                }`}
              >
                Ödemeyi Tamamla
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
