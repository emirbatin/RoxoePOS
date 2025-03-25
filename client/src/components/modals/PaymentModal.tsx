import React, { useState, useRef, useEffect } from "react";
import { formatCurrency } from "../../utils/vatUtils";
import { posService } from "../../services/posServices";
import { PaymentModalProps, PaymentMethod } from "../../types/pos";
import { Customer } from "../../types/credit";
import { useAlert } from "../AlertProvider";

// Tipler aynı kalıyor
type PosItem = {
  id: number;
  name: string;
  amount: number; // satırın toplam tutarı
  quantity: number; // satırın kalan adet
};

type ProductPaymentData = {
  itemId: number;
  paymentMethod: PaymentMethod;
  paidQuantity: number;
  paidAmount: number;
  received: number;
  customer?: Customer | null;
};

type ProductPaymentInput = {
  paymentMethod: PaymentMethod;
  received: string;
  customerId: string;
  selectedQuantity: number;
};

type DiscountType = "percentage" | "amount";

function getDefaultProductInput(): ProductPaymentInput {
  return {
    paymentMethod: "nakit",
    received: "",
    customerId: "",
    selectedQuantity: 0,
  };
}

function getOrInit(
  prev: Record<number, ProductPaymentInput>,
  itemId: number
): ProductPaymentInput {
  return prev[itemId] || getDefaultProductInput();
}

const PaymentModal: React.FC<PaymentModalProps & { items: PosItem[] }> = ({
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
  const { showError, confirm } = useAlert();

  // Normal vs. Split
  const [mode, setMode] = useState<"normal" | "split">("normal");
  // Split tip: product (ürün bazında) veya equal (eşit)
  const [splitType, setSplitType] = useState<"product" | "equal">("product");

  // Normal ödeme
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("nakit");
  const [receivedAmount, setReceivedAmount] = useState("");
  const receivedInputRef = useRef<HTMLInputElement>(null);
  const [processingPOS, setProcessingPOS] = useState(false);

  // İndirim state'i
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState("");

  // İndirim sonrası toplam tutar
  const [discountedTotal, setDiscountedTotal] = useState(total);

  // Ürün Bazında state
  const [remainingItems, setRemainingItems] = useState<PosItem[]>(items);
  const [productPaymentInputs, setProductPaymentInputs] = useState<
    Record<number, ProductPaymentInput>
  >({});
  const [productPayments, setProductPayments] = useState<ProductPaymentData[]>(
    []
  );

  // Eşit Bölüşüm state
  const [friendCount, setFriendCount] = useState(2);
  const [equalPayments, setEqualPayments] = useState<
    { paymentMethod: PaymentMethod; received: string; customerId: string }[]
  >([]);

  const [remainingTotal, setRemainingTotal] = useState(discountedTotal);

  const getPersonShare = (): number => {
    // Toplam tutarı kişi sayısına bölüyoruz - her kişinin eşit olarak ödemesi gereken miktar
    return discountedTotal / friendCount;
  };

  useEffect(() => {
    if (isOpen && receivedInputRef.current) {
      receivedInputRef.current.focus();
    }
  }, [isOpen]);

  // Kişi ödeme yaptığında kalan tutarı güncelle
  useEffect(() => {
    const totalPaid = equalPayments.reduce(
      (sum, p) => sum + (parseFloat(p.received) || 0),
      0
    );
    setRemainingTotal(Math.max(0, discountedTotal - totalPaid));
  }, [equalPayments, discountedTotal]);

  // İndirim hesaplama
  useEffect(() => {
    if (!applyDiscount) {
      setDiscountedTotal(total);
      return;
    }

    const discountNumValue = parseFloat(discountValue) || 0;

    if (discountType === "percentage") {
      // Yüzde olarak indirim
      const discount = total * (discountNumValue / 100);
      setDiscountedTotal(total - discount);
    } else {
      // Tutar olarak indirim
      setDiscountedTotal(Math.max(0, total - discountNumValue));
    }
  }, [total, applyDiscount, discountType, discountValue]);

  // Modal kapandığında her şeyi resetle
  useEffect(() => {
    if (!isOpen) {
      setMode("normal");
      setSplitType("product");
      setPaymentMethod("nakit");
      setReceivedAmount("");
      setSelectedCustomer(null);
      setProcessingPOS(false);

      // İndirim
      setApplyDiscount(false);
      setDiscountType("percentage");
      setDiscountValue("");
      setDiscountedTotal(total);

      // Ürün Bazında
      setRemainingItems(items);
      setProductPaymentInputs({});
      setProductPayments([]);

      // Eşit
      setFriendCount(2);
      setEqualPayments([]);
    }
  }, [isOpen, items, setSelectedCustomer, total]);

  // Veresiye limiti kontrol
  const checkVeresiyeLimit = (cust: Customer, amount: number) =>
    cust.currentDebt + amount <= cust.creditLimit;

  /** ===================
   *    NORMAL ÖDEME
   *  =================== */
  const parsedReceived = parseFloat(receivedAmount) || 0;

  const handleNormalPayment = async () => {
    if (
      (paymentMethod === "nakit" || paymentMethod === "nakitpos") &&
      parsedReceived < discountedTotal
    ) {
      showError("Nakit/NakitPOS için eksik tutar girdiniz!");
      return;
    }

    if (paymentMethod === "veresiye") {
      if (!selectedCustomer) {
        showError("Veresiye için müşteri seçmelisiniz!");
        return;
      }
      if (!checkVeresiyeLimit(selectedCustomer, discountedTotal)) {
        showError("Müşteri limiti yetersiz!");
        return;
      }
    }

    // POS işlemi
    if (paymentMethod === "kart" || paymentMethod === "nakitpos") {
      setProcessingPOS(true);
      try {
        const isManual = await posService.isManualMode();
        if (!isManual) {
          const connected = await posService.connect("Ingenico");
          if (!connected) {
            showError("POS cihazına bağlanılamadı!");
            setProcessingPOS(false);
            return;
          }
          const result = await posService.processPayment(discountedTotal);
          if (!result.success) {
            showError(result.message);
            setProcessingPOS(false);
            await posService.disconnect();
            return;
          }
          await posService.disconnect();
        }
        // Başarılı
        onComplete({
          mode: "normal",
          paymentMethod,
          received: parsedReceived,
          discount: applyDiscount
            ? {
                type: discountType,
                value: parseFloat(discountValue) || 0,
                discountedTotal: discountedTotal,
              }
            : undefined,
        });
      } catch (error) {
        showError("POS işleminde hata!");
        console.error(error);
      } finally {
        setProcessingPOS(false);
      }
      return;
    }

    // Nakit / Veresiye
    onComplete({
      mode: "normal",
      paymentMethod,
      received: parsedReceived,
      discount: applyDiscount
        ? {
            type: discountType,
            value: parseFloat(discountValue) || 0,
            discountedTotal: discountedTotal,
          }
        : undefined,
    });
  };

  /** ===================
   *  ÜRÜN BAZINDA SPLIT
   *  =================== */
  const handleQuantityChange = (itemId: number, newQty: number) => {
    const item = remainingItems.find((i) => i.id === itemId);
    if (!item) return;

    newQty = Math.max(0, Math.min(newQty, item.quantity));

    setProductPaymentInputs((prev) => {
      const oldVal = getOrInit(prev, itemId);
      return {
        ...prev,
        [itemId]: {
          ...oldVal,
          selectedQuantity: newQty,
        },
      };
    });
  };

  const handleProductPay = async (itemId: number) => {
    const item = remainingItems.find((i) => i.id === itemId);
    if (!item) {
      showError("Ürün bulunamadı!");
      return;
    }
    const input = productPaymentInputs[itemId];
    if (!input) {
      showError("Ödeme bilgisi yok!");
      return;
    }

    const { paymentMethod: pm, received, customerId, selectedQuantity } = input;
    if (selectedQuantity <= 0) {
      showError("En az 1 adet seçmelisiniz!");
      return;
    }

    const unitPrice = item.quantity > 0 ? item.amount / item.quantity : 0;
    const partialCost = unitPrice * selectedQuantity;
    const receivedNum = parseFloat(received) || 0;

    // Eksik ödeme
    if (receivedNum < partialCost) {
      showError(`Eksik ödeme! En az ${formatCurrency(partialCost)} girilmeli.`);
      return;
    }

    // Fazla ödeme -> confirm (bakkalda anında para üstü vermek istenebilir)
    if ((pm === "nakit" || pm === "nakitpos") && receivedNum > partialCost) {
      const change = receivedNum - partialCost;
      const ok = await confirm(
        `Para üstü: ${formatCurrency(change)} verilecek. Devam edilsin mi?`
      );
      if (!ok) {
        return; // Kullanıcı vazgeçti
      }
    }

    // Veresiye limiti
    let cust: Customer | null = null;
    if (pm === "veresiye") {
      if (!customerId) {
        showError("Veresiye için müşteri seçiniz!");
        return;
      }
      const found = customers.find((c) => c.id.toString() === customerId);
      if (!found) {
        showError("Seçili müşteri yok!");
        return;
      }
      if (!checkVeresiyeLimit(found, partialCost)) {
        showError("Müşteri limiti yetersiz!");
        return;
      }
      cust = found;
    }

    // Kart ya da NakitPOS -> POS
    if (pm === "kart" || pm === "nakitpos") {
      setProcessingPOS(true);
      try {
        const isManual = await posService.isManualMode();
        if (!isManual) {
          const connected = await posService.connect("Ingenico");
          if (!connected) {
            showError("POS cihazına bağlanılamadı!");
            setProcessingPOS(false);
            return;
          }
          const result = await posService.processPayment(partialCost);
          if (!result.success) {
            showError(result.message);
            setProcessingPOS(false);
            await posService.disconnect();
            return;
          }
          await posService.disconnect();
        }
      } catch (err) {
        showError("POS işleminde hata!");
        console.error(err);
        setProcessingPOS(false);
        return;
      } finally {
        setProcessingPOS(false);
      }
    }

    // Başarılı ödeme
    setProductPayments((prev) => [
      ...prev,
      {
        itemId,
        paymentMethod: pm,
        paidQuantity: selectedQuantity,
        paidAmount: partialCost,
        received: receivedNum,
        customer: cust,
      },
    ]);

    // Kalan adet / tutar
    const leftoverQty = item.quantity - selectedQuantity;
    if (leftoverQty <= 0) {
      setRemainingItems((prev) => prev.filter((x) => x.id !== itemId));
    } else {
      const leftoverAmount = unitPrice * leftoverQty;
      setRemainingItems((prev) =>
        prev.map((x) =>
          x.id === itemId
            ? { ...x, quantity: leftoverQty, amount: leftoverAmount }
            : x
        )
      );
    }

    // Inputu temizle
    setProductPaymentInputs((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  /** ===================
   *   EŞİT BÖLÜŞÜM SPLIT
   *  =================== */
  // Kişi için kalan tutarı hesapla
  const calculateRemainingForPerson = (index: number): number => {
    // Toplam ödenecek tutardan bu kişiye kadar olan kişilerin toplam ödediği tutarı çıkar
    const paidByPrevious = equalPayments
      .slice(0, index)
      .reduce((sum, p) => sum + (parseFloat(p.received) || 0), 0);

    // Kalan tutar, toplam tutardan önceki kişilerin ödediği miktarın çıkarılmasıyla bulunur
    return Math.max(0, discountedTotal - paidByPrevious);
  };

  const handleEqualChange = (
    index: number,
    updates: {
      paymentMethod: PaymentMethod;
      received: string;
      customerId: string;
    }
  ) => {
    const arr = [...equalPayments];
    arr[index] = updates;

    setEqualPayments(arr);
  };

  const handleFinalizeSplit = async () => {
    if (splitType === "equal") {
      let totalPaid = 0;
      const isManual = await posService.isManualMode();

      // Sadece POS / veresiye limit gibi kontroller
      for (let i = 0; i < friendCount; i++) {
        const p = equalPayments[i];
        const val = parseFloat(p.received) || 0;
        totalPaid += val;

        // Veresiye limit
        if (p.paymentMethod === "veresiye" && val > 0) {
          if (!p.customerId) {
            showError(`${i + 1}. kişi veresiye seçti ama müşteri yok!`);
            return;
          }
          const cust = customers.find((c) => c.id.toString() === p.customerId);
          if (!cust) {
            showError(`Geçersiz müşteri!`);
            return;
          }
          if (!checkVeresiyeLimit(cust, val)) {
            showError(`${i + 1}. kişinin veresiye limiti yetersiz!`);
            return;
          }
        }

        // Kart / nakitpos => POS (fark etmiyor kişi payını aşıyor mu, bakmayacağız)
        if (
          (p.paymentMethod === "kart" || p.paymentMethod === "nakitpos") &&
          val > 0
        ) {
          setProcessingPOS(true);
          try {
            if (!isManual) {
              const connected = await posService.connect("Ingenico");
              if (!connected) {
                showError("POS cihazına bağlanılamadı!");
                setProcessingPOS(false);
                return;
              }
              const result = await posService.processPayment(val);
              if (!result.success) {
                showError(`POS hatası: ${result.message}`);
                setProcessingPOS(false);
                await posService.disconnect();
                return;
              }
              await posService.disconnect();
            }
          } catch (err) {
            showError("POS işleminde hata oluştu!");
            console.error(err);
            setProcessingPOS(false);
            return;
          }
        }
      }

      setProcessingPOS(false);

      // Son kontrol: totalPaid < discountedTotal => eksik
      if (totalPaid < discountedTotal) {
        showError(
          `Eksik ödeme! Toplam ödendi: ${formatCurrency(
            totalPaid
          )}, Fatura: ${formatCurrency(discountedTotal)}`
        );
        return;
      } else if (totalPaid > discountedTotal) {
        // "toplam para üstü" diyerek confirm
        const change = totalPaid - discountedTotal;
        const ok = await confirm(
          `Toplam para üstü: ${formatCurrency(
            change
          )} verilecek. Devam edilsin mi?`
        );
        if (!ok) return;
      }
    }

    // Ödeme Tamamla
    onComplete({
      mode: "split",
      splitOption: splitType,
      // Ürün bazında
      productPayments: splitType === "product" ? productPayments : undefined,
      // Eşit bölüşüm
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
      // İndirim
      discount: applyDiscount
        ? {
            type: discountType,
            value: parseFloat(discountValue) || 0,
            discountedTotal: discountedTotal,
          }
        : undefined,
    });
  };

  // Ödeme butonunun devre dışı olması gerekip gerekmediğini kontrol et
  const isPaymentButtonDisabled = () => {
    if (mode === "normal") {
      if (paymentMethod === "nakit" && parsedReceived < discountedTotal) {
        return true;
      }
      if (paymentMethod === "veresiye" && !selectedCustomer) {
        return true;
      }
      return false;
    } else if (mode === "split") {
      if (splitType === "product") {
        // Tüm ürünler ödenmişse aktif, değilse pasif
        return remainingItems.length > 0;
      } else if (splitType === "equal") {
        // Tüm kişilerin ödemeleri girilmiş mi?
        return (
          !equalPayments.every((p) => parseFloat(p.received) > 0) ||
          equalPayments.length < friendCount
        );
      }
    }
    return false;
  };

  // Ödeme butonuna tıklandığında ne yapılacak
  const handlePaymentButtonClick = () => {
    if (mode === "normal") {
      handleNormalPayment();
    } else if (mode === "split") {
      handleFinalizeSplit();
    }
  };

  // Ödeme butonu metni
  const getPaymentButtonText = () => {
    if (mode === "normal") {
      return "Ödemeyi Tamamla";
    } else if (mode === "split") {
      if (splitType === "product") {
        return remainingItems.length === 0
          ? "Tüm Ödemeleri Tamamla"
          : "Ödeme İçin Tüm Ürünleri Giriniz";
      } else {
        return "Ödemeleri Tamamla";
      }
    }
    return "Ödemeyi Tamamla";
  };

  function clsx(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(" ");
  }

  // İndirim hesaplama
  const discountAmountValue =
    discountType === "percentage"
      ? (total * (parseFloat(discountValue) || 0)) / 100
      : parseFloat(discountValue) || 0;

  if (!isOpen) return null;

  // Ödeme yöntemleri
  const paymentMethods: {
    method: PaymentMethod;
    icon: string;
    label: string;
  }[] = [
    { method: "nakit", icon: "💵", label: "Nakit" },
    { method: "kart", icon: "💳", label: "Kart" },
    { method: "veresiye", icon: "🧾", label: "Veresiye" },
  ];

  /* ================
   *   DOKUNMATIK EKRAN İÇİN YENİ TASARIM
   * ================ */
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">Ödeme</h2>
            <p className="text-gray-500 text-sm">
              {formatCurrency(subtotal)} + KDV {formatCurrency(vatAmount)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-gray-500 text-sm">Toplam</p>
            <p className="text-2xl font-bold text-indigo-600">
              {applyDiscount ? (
                <>
                  <span className="line-through text-gray-400 text-sm mr-2">
                    {formatCurrency(total)}
                  </span>
                  {formatCurrency(discountedTotal)}
                </>
              ) : (
                formatCurrency(total)
              )}
            </p>
          </div>

          <button
            onClick={onClose}
            className="ml-3 p-2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
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

        {/* PROCESSING INDICATOR */}
        {processingPOS && (
          <div className="bg-blue-50 text-blue-700 px-4 py-2 flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-700 border-t-transparent" />
            <span className="font-medium text-sm">
              POS Ödemesi İşleniyor...
            </span>
          </div>
        )}

        {/* MAIN CONTENT - SCROLLABLE */}
        <div className="flex-1 overflow-auto">
          {/* ÖDEME TÜRÜ SEÇİMİ */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-base font-medium text-gray-900 mb-3">
              Ödeme Türü
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("normal")}
                className={`py-4 rounded-lg text-base font-medium transition-all ${
                  mode === "normal"
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-300"
                }`}
              >
                Normal Ödeme
              </button>
              <button
                onClick={() => setMode("split")}
                className={`py-4 rounded-lg text-base font-medium transition-all ${
                  mode === "split"
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-300"
                }`}
              >
                Bölünmüş Ödeme
              </button>
            </div>
          </div>

          {/* ÖDEME İÇERİĞİ - NORMAL */}
          {mode === "normal" && (
            <div className="p-4">
              <h3 className="text-base font-medium text-gray-900 mb-3">
                Ödeme Yöntemi
              </h3>

              {/* Büyük ödeme butonları */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {paymentMethods.map(({ method, icon, label }) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={clsx(
                      "flex flex-col items-center justify-center py-4 rounded-lg transition-all w-full h-20",
                      paymentMethod === method
                        ? "bg-indigo-600 text-white shadow"
                        : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-300"
                    )}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>

              {/* Nakit giriş bölümü */}
              {(paymentMethod === "nakit" || paymentMethod === "nakitpos") && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Alınan Tutar
                  </label>
                  <div className="relative">
                    <input
                      ref={receivedInputRef}
                      type="number"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full px-4 py-2 rounded-md text-lg border border-gray-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0.00"
                    />
                    {parsedReceived > discountedTotal && (
                      <div className="mt-2 text-green-600 font-medium text-sm">
                        Para Üstü:{" "}
                        {formatCurrency(parsedReceived - discountedTotal)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Veresiye seçim bölümü */}
              {paymentMethod === "veresiye" && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Müşteri Seçin
                  </label>
                  <select
                    value={selectedCustomer?.id || ""}
                    onChange={(e) =>
                      setSelectedCustomer(
                        customers.find(
                          (c) => c.id === Number(e.target.value)
                        ) || null
                      )
                    }
                    className="w-full px-4 py-2 text-base rounded-md border border-gray-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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

                  {selectedCustomer && (
                    <div className="mt-3 bg-blue-50 p-3 rounded-md">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">Mevcut Borç:</span>
                        <span className="font-medium">
                          {formatCurrency(selectedCustomer.currentDebt)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Kredi Limiti:</span>
                        <span className="font-medium">
                          {formatCurrency(selectedCustomer.creditLimit)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* İNDİRİM ALANI */}
              <div className="border-b border-gray-200 pb-4 mb-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="apply-discount"
                    checked={applyDiscount}
                    onChange={(e) => setApplyDiscount(e.target.checked)}
                    className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="apply-discount"
                    className="ml-2 text-base font-medium text-gray-700"
                  >
                    İndirim Uygula
                  </label>
                </div>

                {applyDiscount && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex gap-4 mb-3">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="discount-percentage"
                          name="discount-type"
                          checked={discountType === "percentage"}
                          onChange={() => setDiscountType("percentage")}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label
                          htmlFor="discount-percentage"
                          className="ml-2 text-sm text-gray-700"
                        >
                          Yüzde (%)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="discount-amount"
                          name="discount-type"
                          checked={discountType === "amount"}
                          onChange={() => setDiscountType("amount")}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label
                          htmlFor="discount-amount"
                          className="ml-2 text-sm text-gray-700"
                        >
                          Tutar (₺)
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center mb-2">
                      <input
                        type="number"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder={discountType === "percentage" ? "%" : "₺"}
                        className="w-full px-3 py-2 text-base rounded-md border border-gray-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">İndirim Tutarı:</span>
                      <span className="font-medium text-red-600">
                        -{formatCurrency(discountAmountValue)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BÖLÜNMÜŞ ÖDEME - SPLIT OPTION CHOICE */}
          {mode === "split" && (
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Bölüşüm Türü
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => setSplitType("product")}
                  className={`py-3 rounded-lg text-sm font-medium transition-all ${
                    splitType === "product"
                      ? "bg-indigo-600 text-white shadow"
                      : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-300"
                  }`}
                >
                  Ürün Bazında
                </button>
                <button
                  onClick={() => setSplitType("equal")}
                  className={`py-3 rounded-lg text-sm font-medium transition-all ${
                    splitType === "equal"
                      ? "bg-indigo-600 text-white shadow"
                      : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-300"
                  }`}
                >
                  Eşit Bölünmüş
                </button>
              </div>

              {/* ÜRÜN BAZINDA SPLIT */}
              {splitType === "product" && (
                <div className="space-y-5">
                  {/* Kalan Ürünler */}
                  {remainingItems.length > 0 && (
                    <>
                      <h3 className="text-md font-medium text-gray-900">
                        Kalan Ürünler
                      </h3>
                      {remainingItems.map((item) => {
                        const input =
                          productPaymentInputs[item.id] ||
                          getDefaultProductInput();
                        const unitPrice =
                          item.quantity > 0 ? item.amount / item.quantity : 0;
                        const partialCost = unitPrice * input.selectedQuantity;
                        const receivedNum = parseFloat(input.received) || 0;
                        const showChange =
                          (input.paymentMethod === "nakit" ||
                            input.paymentMethod === "nakitpos") &&
                          receivedNum > partialCost &&
                          partialCost > 0;

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-xl border-2 border-gray-200 p-5 mb-3"
                          >
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-md font-medium text-gray-900">
                                {item.name}
                              </span>
                              <span className="text-md text-gray-600">
                                {item.quantity} adet ×{" "}
                                {formatCurrency(unitPrice)}
                              </span>
                            </div>

                            {/* Adet Seçimi */}
                            <div className="mb-5">
                              <label className="block text-md font-medium text-gray-700 mb-2">
                                Adet Seçin
                              </label>
                              <div className="flex items-center">
                                <button
                                  onClick={() =>
                                    handleQuantityChange(
                                      item.id,
                                      input.selectedQuantity - 1
                                    )
                                  }
                                  disabled={input.selectedQuantity <= 0}
                                  className="h-12 w-12 flex items-center justify-center text-2xl bg-gray-100 rounded-l-lg disabled:text-gray-300"
                                >
                                  -
                                </button>
                                <span className="h-12 min-w-12 flex items-center justify-center text-md font-bold px-4 border-y-2 border-gray-200">
                                  {input.selectedQuantity}
                                </span>
                                <button
                                  onClick={() =>
                                    handleQuantityChange(
                                      item.id,
                                      input.selectedQuantity + 1
                                    )
                                  }
                                  disabled={
                                    input.selectedQuantity >= item.quantity
                                  }
                                  className="h-12 w-12 flex items-center justify-center text-2xl bg-gray-100 rounded-r-lg disabled:text-gray-300"
                                >
                                  +
                                </button>
                                <span className="ml-4 text-md">
                                  Toplam: <b>{formatCurrency(partialCost)}</b>
                                </span>
                              </div>
                            </div>

                            {/* Ödeme Yöntemi Seçimi */}
                            <div className="mb-4">
                              <label className="block text-md font-medium text-gray-700 mb-2">
                                Ödeme Yöntemi
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {paymentMethods.map(
                                  ({ method, icon, label }) => (
                                    <button
                                      key={method}
                                      onClick={() =>
                                        setProductPaymentInputs((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...getOrInit(prev, item.id),
                                            paymentMethod: method,
                                          },
                                        }))
                                      }
                                      className={`flex items-center justify-center gap-2 py-3 rounded-lg ${
                                        input.paymentMethod === method
                                          ? "bg-indigo-600 text-white"
                                          : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      <span className="text-md">{icon}</span>
                                      <span className="text-md">{label}</span>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>

                            {/* Alınan Tutar */}
                            <div className="mb-4">
                              <label className="block text-md font-medium text-gray-700 mb-2">
                                Alınan Tutar
                              </label>
                              <input
                                type="number"
                                placeholder={`Min: ${formatCurrency(
                                  partialCost
                                )}`}
                                value={input.received}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) =>
                                  setProductPaymentInputs((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...getOrInit(prev, item.id),
                                      received: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full px-4 py-3 text-md rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                              {showChange && (
                                <div className="mt-2 text-green-600 font-medium text-md">
                                  Para Üstü:{" "}
                                  {formatCurrency(receivedNum - partialCost)}
                                </div>
                              )}
                            </div>

                            {/* Veresiye müşteri */}
                            {input.paymentMethod === "veresiye" && (
                              <div className="mb-4">
                                <label className="block text-md font-medium text-gray-700 mb-2">
                                  Müşteri Seçin
                                </label>
                                <select
                                  value={input.customerId}
                                  onChange={(e) =>
                                    setProductPaymentInputs((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...getOrInit(prev, item.id),
                                        customerId: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full px-4 py-3 text-md rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                  <option value="">Müşteri Seçin</option>
                                  {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} ({formatCurrency(c.currentDebt)}/
                                      {formatCurrency(c.creditLimit)})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Ürün seviyesinde ödeme butonu - Merkezi butona taşındı */}
                            <button
                              onClick={() => handleProductPay(item.id)}
                              disabled={
                                input.selectedQuantity === 0 ||
                                receivedNum < partialCost ||
                                (input.paymentMethod === "veresiye" &&
                                  !input.customerId)
                              }
                              className={`w-full py-4 rounded-lg text-md font-medium transition-all ${
                                input.selectedQuantity === 0 ||
                                receivedNum < partialCost ||
                                (input.paymentMethod === "veresiye" &&
                                  !input.customerId)
                                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                  : "bg-indigo-600 text-white hover:bg-indigo-700"
                              }`}
                            >
                              Ürünü Öde
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Tamamlanan Ödemeler */}
                  {productPayments.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-md font-medium text-gray-900 mb-3">
                        Tamamlanan Ödemeler
                      </h3>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="space-y-3">
                          {productPayments.map((pmt, i) => {
                            const originalItem = items.find(
                              (x) => x.id === pmt.itemId
                            );
                            if (!originalItem) return null;

                            return (
                              <div
                                key={i}
                                className="bg-white rounded-lg p-4 border border-gray-200 flex justify-between"
                              >
                                <div>
                                  <span className="font-medium text-md">
                                    {originalItem.name}
                                  </span>
                                  <div className="text-gray-500 mt-1">
                                    {pmt.paidQuantity} adet,{" "}
                                    {pmt.paymentMethod === "veresiye" &&
                                    pmt.customer
                                      ? `Veresiye: ${pmt.customer.name}`
                                      : pmt.paymentMethod}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-md text-indigo-600">
                                    {formatCurrency(pmt.received)}
                                  </div>
                                  {pmt.received > pmt.paidAmount && (
                                    <div className="text-green-600">
                                      Para Üstü:{" "}
                                      {formatCurrency(
                                        pmt.received - pmt.paidAmount
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* EŞİT BÖLÜŞÜM SPLIT */}
              {splitType === "equal" && (
                <div className="space-y-5">
                  <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kişi Sayısı
                    </label>
                    <div className="flex items-center">
                      <button
                        onClick={() => {
                          const newCount = Math.max(1, friendCount - 1);
                          setFriendCount(newCount);
                          setEqualPayments(
                            Array(newCount).fill({
                              paymentMethod: "nakit",
                              received: "",
                              customerId: "",
                            })
                          );
                        }}
                        className="h-10 w-10 flex items-center justify-center text-lg font-bold bg-gray-100 rounded-l-md"
                      >
                        -
                      </button>
                      <div className="h-10 min-w-10 flex items-center justify-center text-lg font-bold px-3 border-y border-gray-200">
                        {friendCount}
                      </div>
                      <button
                        onClick={() => {
                          const newCount = friendCount + 1;
                          setFriendCount(newCount);
                          setEqualPayments(
                            Array(newCount).fill({
                              paymentMethod: "nakit",
                              received: "",
                              customerId: "",
                            })
                          );
                        }}
                        className="h-10 w-10 flex items-center justify-center text-lg font-bold bg-gray-100 rounded-r-md"
                      >
                        +
                      </button>
                      <div className="ml-3 text-sm">
                        <span className="text-gray-700">Kişi Başına:</span>{" "}
                        <span className="font-bold text-indigo-600">
                          {formatCurrency(discountedTotal / friendCount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Kişi Ödemeleri */}
                  {Array.from({ length: friendCount }, (_, i) => {
                    const p = equalPayments[i] || {
                      paymentMethod: "nakit" as PaymentMethod,
                      received: "",
                      customerId: "",
                    };
                    
                    // Her kişi için dinamik olarak doğru kalan tutarı hesapla
                    const personRemaining = calculateRemainingForPerson(i);

                    return (
                      <div
                        key={i}
                        className="bg-white rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-sm font-medium text-gray-900">
                            Kişi {i + 1}
                          </h4>
                          {i === 0 ? (
                            <span className="text-xs text-gray-600">
                              Toplam: {formatCurrency(discountedTotal)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">
                              Kalan: {formatCurrency(personRemaining)}
                            </span>
                          )}
                        </div>

                        {/* Ödeme Yöntemi */}
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Ödeme Yöntemi
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {paymentMethods.map(({ method, icon, label }) => (
                              <button
                                key={method}
                                onClick={() =>
                                  handleEqualChange(i, {
                                    ...p,
                                    paymentMethod: method,
                                  })
                                }
                                className={`flex items-center justify-center gap-1 py-2 rounded-md ${
                                  p.paymentMethod === method
                                    ? "bg-indigo-600 text-white"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                <span className="text-sm">{icon}</span>
                                <span className="text-xs">{label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Alınan Tutar */}
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Alınan Tutar
                          </label>
                          <input
                            type="number"
                            placeholder="Ödeme Tutarı"
                            value={p.received}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) =>
                              handleEqualChange(i, {
                                ...p,
                                received: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          {/* Para üstü gösterimi - doğru hesaplama */}
                          {parseFloat(p.received) > personRemaining && personRemaining > 0 && (
                            <div className="mt-1 text-green-600 font-medium text-xs">
                              Para Üstü:{" "}
                              {formatCurrency(parseFloat(p.received) - personRemaining)}
                            </div>
                          )}
                        </div>

                        {/* Veresiye müşteri */}
                        {p.paymentMethod === "veresiye" && (
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Müşteri Seçin
                            </label>
                            <select
                              value={p.customerId}
                              onChange={(e) =>
                                handleEqualChange(i, {
                                  ...p,
                                  customerId: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 text-xs rounded-md border border-gray-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Müşteri Seçin</option>
                              {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({formatCurrency(c.currentDebt)}/
                                  {formatCurrency(c.creditLimit)})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {equalPayments.some((p) => parseFloat(p.received) > 0) && (
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h4 className="text-md font-medium text-gray-900 mb-3">
                        Ödeme Özeti
                      </h4>
                      <div className="space-y-3 text-md">
                        <div className="flex justify-between">
                          <span className="font-medium">Toplam Alınan:</span>
                          <span>
                            {formatCurrency(
                              equalPayments.reduce(
                                (sum, x) => sum + (parseFloat(x.received) || 0),
                                0
                              )
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Toplam Tutar:</span>
                          <span>{formatCurrency(discountedTotal)}</span>
                        </div>

                        {/* Kalan ödeme miktarı */}
                        {remainingTotal > 0 && (
                          <div className="flex justify-between text-red-600 font-medium">
                            <span>Kalan Ödeme:</span>
                            <span>{formatCurrency(remainingTotal)}</span>
                          </div>
                        )}

                        {/* Eğer fazla ödeme yapıldıysa */}
                        {remainingTotal < 0 && (
                          <div className="flex justify-between text-green-600 font-medium">
                            <span>Fazla Ödeme:</span>
                            <span>
                              {formatCurrency(Math.abs(remainingTotal))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER - MEKERZİ ÖDEME BUTONLARI */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 space-y-3">
          {/* Merkezi Ödeme Tamamla Butonu */}
          <button
            onClick={handlePaymentButtonClick}
            disabled={isPaymentButtonDisabled()}
            className={`w-full py-4 rounded-lg text-base font-bold transition-all ${
              isPaymentButtonDisabled()
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700 shadow"
            }`}
          >
            {getPaymentButtonText()}
          </button>

          {/* İptal Butonu */}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg text-base font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;