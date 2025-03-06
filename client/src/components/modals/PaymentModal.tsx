import React, { useState, useRef, useEffect } from "react";
import { formatCurrency } from "../../utils/vatUtils";
import { posService } from "../../services/posServices";
import { PaymentModalProps, PaymentMethod } from "../../types/pos";
import { Customer } from "../../types/credit";
import { useAlert } from "../AlertProvider";

// Tipler: items -> quantity ve amount alanları olmalı
type PosItem = {
  id: number;
  name: string;
  amount: number;   // satırın toplam tutarı
  quantity: number; // satırın kalan adet
};

// Ürün bazında ödemeleri kaydetmek için
type ProductPaymentData = {
  itemId: number;
  paymentMethod: PaymentMethod;
  paidQuantity: number;
  paidAmount: number; // paidQuantity * birim fiyat
  received: number;   // kasaya giren para
  customer?: Customer | null;
};

// Ürün bazında UI state'i
type ProductPaymentInput = {
  paymentMethod: PaymentMethod;
  received: string;       // kullanıcı giriyor
  customerId: string;     // veresiye
  selectedQuantity: number;
};

// İndirim tipleri
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
  const [productPaymentInputs, setProductPaymentInputs] =
    useState<Record<number, ProductPaymentInput>>({});
  const [productPayments, setProductPayments] = useState<ProductPaymentData[]>([]);

  // Eşit Bölüşüm state
  const [friendCount, setFriendCount] = useState(2);
  const [equalPayments, setEqualPayments] = useState<
    { paymentMethod: PaymentMethod; received: string; customerId: string }[]
  >([]);

  useEffect(() => {
    if (isOpen && receivedInputRef.current) {
      receivedInputRef.current.focus();
    }
  }, [isOpen]);

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
          discount: applyDiscount ? {
            type: discountType,
            value: parseFloat(discountValue) || 0,
            discountedTotal: discountedTotal
          } : undefined
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
      discount: applyDiscount ? {
        type: discountType,
        value: parseFloat(discountValue) || 0,
        discountedTotal: discountedTotal
      } : undefined
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
  // Burada kişi bazında "fazla ödeme" => anında "para üstü" göstermiyoruz
  // Sadece finalde total > fatura ise para üstü
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
        if ((p.paymentMethod === "kart" || p.paymentMethod === "nakitpos") && val > 0) {
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
          `Eksik ödeme! Toplam ödendi: ${formatCurrency(totalPaid)}, Fatura: ${formatCurrency(
            discountedTotal
          )}`
        );
        return;
      } else if (totalPaid > discountedTotal) {
        // "toplam para üstü" diyerek confirm
        const change = totalPaid - discountedTotal;
        const ok = await confirm(
          `Toplam para üstü: ${formatCurrency(change)} verilecek. Devam edilsin mi?`
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
                  ? customers.find((c) => c.id.toString() === p.customerId) || null
                  : null,
            }))
          : undefined,
      // İndirim
      discount: applyDiscount ? {
        type: discountType,
        value: parseFloat(discountValue) || 0,
        discountedTotal: discountedTotal
      } : undefined
    });
  };

  /* ================
   *     RENDER
   * ================ */
  if (!isOpen) return null;

  // İndirim hesaplama
  const discountAmountValue = discountType === "percentage" 
    ? total * (parseFloat(discountValue) || 0) / 100
    : parseFloat(discountValue) || 0;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ÜST KISIM */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Ödeme Yap</h2>
              <p className="text-gray-500 mt-1">Ödemeyi Tamamlayın</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Toplam Tutar</p>
                <p className="text-2xl font-semibold text-primary-600">
                  {applyDiscount ? (
                    <>
                      <span className="line-through text-gray-400 text-lg mr-2">
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

        {/* İÇERİK */}
        <div className="flex-1 overflow-auto">
          <div className="p-8 space-y-8">
            {/* ÖDEME ÖZETİ */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Ödeme Özeti</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Ara Tutar</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>KDV</span>
                  <span className="font-medium">{formatCurrency(vatAmount)}</span>
                </div>
                
                {/* İndirim toggle */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="apply-discount"
                      checked={applyDiscount}
                      onChange={(e) => setApplyDiscount(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="apply-discount" className="ml-2 text-gray-700">
                      İndirim Uygula
                    </label>
                  </div>
                </div>
                
                {/* İndirim işlemleri */}
                {applyDiscount && (
                  <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="discount-percentage"
                          name="discount-type"
                          checked={discountType === "percentage"}
                          onChange={() => setDiscountType("percentage")}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="discount-percentage" className="ml-2 text-gray-700">
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
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="discount-amount" className="ml-2 text-gray-700">
                          Tutar (₺)
                        </label>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder={discountType === "percentage" ? "Yüzde (%)" : "Tutar (₺)"}
                        className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">İndirim Tutarı:</span>
                      <span className="font-medium text-red-600">
                        -{formatCurrency(discountAmountValue)}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="h-px bg-gray-200 my-2" />
                <div className="flex justify-between text-lg font-semibold text-gray-900">
                  <span>Toplam</span>
                  <span className="text-primary-600">
                    {applyDiscount ? (
                      <span className="flex flex-col items-end">
                        <span className="line-through text-gray-400 text-sm">
                          {formatCurrency(total)}
                        </span>
                        {formatCurrency(discountedTotal)}
                      </span>
                    ) : (
                      formatCurrency(total)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* ÖDEME TÜRÜ SEÇİMİ */}
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
                  Normal Ödeme
                </button>
                <button
                  onClick={() => setMode("split")}
                  className={`px-6 py-4 rounded-xl transition-all duration-200 ${
                    mode === "split"
                      ? "bg-primary-600 text-white shadow-lg shadow-primary-100 ring-2 ring-primary-600 ring-offset-2"
                      : "bg-white border-2 border-gray-200 text-gray-700 hover:border-primary-600 hover:text-primary-600"
                  }`}
                >
                  Bölünmüş Ödeme
                </button>
              </div>
            </div>

            {/* NORMAL ÖDEME */}
            {mode === "normal" && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Ödeme Yöntemi</h3>
                <div className="grid grid-cols-2 gap-4">
                  {(["nakit", "kart", "veresiye", "nakitpos"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`group p-4 rounded-xl transition-all duration-200 ${
                        paymentMethod === m
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-100"
                          : "bg-white border-2 border-gray-200 text-gray-700 hover:border-primary-600"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {m === "nakit" && "💵"}
                          {m === "kart" && "💳"}
                          {m === "veresiye" && "🧾"}
                          {m === "nakitpos" && "💵"}
                        </span>
                        <span className="text-lg font-medium">
                          {m === "nakit" && "Nakit"}
                          {m === "kart" && "Kredi Kartı"}
                          {m === "veresiye" && "Veresiye"}
                          {m === "nakitpos" && "Nakit POS"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Nakit / NakitPOS */}
                {(paymentMethod === "nakit" || paymentMethod === "nakitpos") && (
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
                      {parsedReceived > discountedTotal && (
                        <div className="absolute right-0 top-full mt-2 text-green-600 font-medium">
                          Para Üstü: {formatCurrency(parsedReceived - discountedTotal)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Veresiye */}
                {paymentMethod === "veresiye" && (
                  <div className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Müşteri Seçin
                    </label>
                    <select
                      value={selectedCustomer?.id || ""}
                      onChange={(e) =>
                        setSelectedCustomer(
                          customers.find((c) => c.id === Number(e.target.value)) || null
                        )
                      }
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-700"
                    >
                      /* Yarım kalan kısmın devamı (müşteri seçim dropdown) */
                      <option value="">Bir Müşteri Seçin</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} (Borç: {formatCurrency(customer.currentDebt)} / Limit:{" "}
                          {formatCurrency(customer.creditLimit)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* BÖLÜNMÜŞ ÖDEME */}
            {mode === "split" && (
              <div className="space-y-6">
                {/* Tabler */}
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

                {/* Ürün Bazında */}
                {splitType === "product" && (
                  <div className="space-y-6">
                    <div className="grid gap-4">
                      {remainingItems.map((item) => {
                        const input = productPaymentInputs[item.id] || getDefaultProductInput();
                        const unitPrice =
                          item.quantity > 0 ? item.amount / item.quantity : 0;
                        const partialCost = unitPrice * input.selectedQuantity;
                        const receivedNum = parseFloat(input.received) || 0;

                        // Nakit/nakitpos -> anlık para üstü, çünkü tek bir ürün satırı
                        const showChange =
                          (input.paymentMethod === "nakit" || input.paymentMethod === "nakitpos") &&
                          receivedNum > partialCost &&
                          partialCost > 0;

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-primary-200 transition-colors"
                          >
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-lg font-medium text-gray-900">
                                {item.name}
                              </span>
                              <span className="text-sm text-gray-600">
                                Kalan: {item.quantity} adet - {formatCurrency(item.amount)}
                              </span>
                            </div>

                            {/* Adet Seç */}
                            <div className="flex items-center gap-4 mb-4">
                              <label className="font-medium text-gray-600">Adet Seç:</label>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    handleQuantityChange(item.id, input.selectedQuantity - 1)
                                  }
                                  disabled={input.selectedQuantity <= 0}
                                  className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                  -
                                </button>
                                <span className="font-semibold w-8 text-center">
                                  {input.selectedQuantity}
                                </span>
                                <button
                                  onClick={() =>
                                    handleQuantityChange(item.id, input.selectedQuantity + 1)
                                  }
                                  disabled={input.selectedQuantity >= item.quantity}
                                  className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Ödeme Yöntemi */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              {(["nakit", "kart", "veresiye", "nakitpos"] as PaymentMethod[]).map(
                                (method) => (
                                  <button
                                    key={method}
                                    onClick={() =>
                                      setProductPaymentInputs((prev) => {
                                        const oldVal = getOrInit(prev, item.id);
                                        return {
                                          ...prev,
                                          [item.id]: {
                                            ...oldVal,
                                            paymentMethod: method,
                                          },
                                        };
                                      })
                                    }
                                    className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                                      input.paymentMethod === method
                                        ? "bg-primary-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    {method === "nakit" && "💵 Nakit"}
                                    {method === "kart" && "💳 Kart"}
                                    {method === "veresiye" && "🧾 Veresiye"}
                                    {method === "nakitpos" && "💵 Nakit POS"}
                                  </button>
                                )
                              )}
                            </div>

                            {/* Veresiye müşteri */}
                            {input.paymentMethod === "veresiye" && (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Müşteri Seçin
                                </label>
                                <select
                                  value={input.customerId}
                                  onChange={(e) =>
                                    setProductPaymentInputs((prev) => {
                                      const oldVal = getOrInit(prev, item.id);
                                      return {
                                        ...prev,
                                        [item.id]: {
                                          ...oldVal,
                                          customerId: e.target.value,
                                        },
                                      };
                                    })
                                  }
                                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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

                            {/* Alınan Tutar */}
                            <div className="mb-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Alınan Tutar
                              </label>
                              <input
                                type="number"
                                placeholder={`(Min: ${formatCurrency(partialCost)})`}
                                value={input.received}
                                onChange={(e) =>
                                  setProductPaymentInputs((prev) => {
                                    const oldVal = getOrInit(prev, item.id);
                                    return {
                                      ...prev,
                                      [item.id]: {
                                        ...oldVal,
                                        received: e.target.value,
                                      },
                                    };
                                  })
                                }
                                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              />
                            </div>

                            <p className="text-sm text-gray-600 mb-2">
                              <strong>Ödenecek Tutar:</strong>{" "}
                              {formatCurrency(partialCost)}
                            </p>

                            {/* Para üstü (Ürün bazında "fazla ödeme" anında verilebilir) */}
                            {showChange && (
                              <p className="text-sm font-medium text-green-600 mb-2">
                                Para Üstü: {formatCurrency(receivedNum - partialCost)}
                              </p>
                            )}

                            <button
                              onClick={() => handleProductPay(item.id)}
                              disabled={
                                input.selectedQuantity === 0 ||
                                receivedNum < partialCost ||
                                (input.paymentMethod === "veresiye" && !input.customerId)
                              }
                              className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${
                                input.selectedQuantity === 0 ||
                                receivedNum < partialCost ||
                                (input.paymentMethod === "veresiye" && !input.customerId)
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-100"
                              }`}
                            >
                              Öde
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Product Ödemeleri */}
                    {productPayments.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">
                          Tamamlanan Ödemeler
                        </h4>
                        <div className="space-y-3">
                          {productPayments.map((pmt, i) => {
                            const originalItem = items.find((x) => x.id === pmt.itemId);
                            if (!originalItem) return null;

                            return (
                              <div
                                key={i}
                                className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-medium text-gray-900">
                                    {originalItem.name}
                                  </span>
                                  <div className="text-sm text-gray-500 mt-1">
                                    {pmt.paidQuantity} adet,{" "}
                                    {pmt.paymentMethod === "veresiye" && pmt.customer
                                      ? `Veresiye: ${pmt.customer.name}`
                                      : pmt.paymentMethod}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-primary-600">
                                    {formatCurrency(pmt.received)}
                                  </div>
                                  {pmt.received > pmt.paidAmount && (
                                    <div className="text-sm text-green-600">
                                      Para Üstü:{" "}
                                      {formatCurrency(pmt.received - pmt.paidAmount)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Kalan ürün yoksa buton */}
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

                {/* Eşit Bölüşüm */}
                {splitType === "equal" && (
                  <div className="space-y-6">
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
                              const val = parseInt(e.target.value) || 1;
                              const count = Math.max(val, 1);
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
                        {/* Sadece bilgilendirme: kişi başına pay */}
                        <div className="text-right">
                          <div className="text-sm text-gray-500">Kişi Başına:</div>
                          <div className="text-2xl font-bold text-primary-600">
                            {formatCurrency(discountedTotal / friendCount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {Array.from({ length: friendCount }, (_, i) => {
                        const p = equalPayments[i] || {
                          paymentMethod: "nakit" as PaymentMethod,
                          received: "",
                          customerId: "",
                        };

                        // Artık p.received > payAmount => anlık "para üstü" göstermiyoruz
                        // Yalnızca finalde totalPaid > total => "toplam para üstü"

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
                                  Ödeme Payı:{" "}
                                  {formatCurrency(discountedTotal / friendCount)}
                                </span>
                              </div>

                              {/* Ödeme Yöntemi */}
                              <div className="grid grid-cols-2 gap-2">
                                {(["nakit", "kart", "veresiye", "nakitpos"] as PaymentMethod[]).map(
                                  (method) => (
                                    <button
                                      key={method}
                                      onClick={() =>
                                        handleEqualChange(i, {
                                          ...p,
                                          paymentMethod: method,
                                        })
                                      }
                                      className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                                        p.paymentMethod === method
                                          ? "bg-primary-600 text-white"
                                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      {method === "nakit" && "💵 Nakit"}
                                      {method === "kart" && "💳 Kart"}
                                      {method === "veresiye" && "🧾 Veresiye"}
                                      {method === "nakitpos" && "💵 Nakit POS"}
                                    </button>
                                  )
                                )}
                              </div>

                              {/* Alınan Tutar */}
                              <input
                                type="number"
                                placeholder="Ödeme Tutarı"
                                value={p.received}
                                onChange={(e) =>
                                  handleEqualChange(i, {
                                    ...p,
                                    received: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              />

                              {/* Veresiye müşteri */}
                              {p.paymentMethod === "veresiye" && (
                                <select
                                  value={p.customerId}
                                  onChange={(e) =>
                                    handleEqualChange(i, {
                                      ...p,
                                      customerId: e.target.value,
                                    })
                                  }
                                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                  <option value="">Müşteri Seçin</option>
                                  {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} ({formatCurrency(c.currentDebt)}/
                                      {formatCurrency(c.creditLimit)})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Ödeme Özeti */}
                    {equalPayments.some((p) => parseFloat(p.received) > 0) && (
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
                                  (sum, x) => sum + (parseFloat(x.received) || 0),
                                  0
                                )
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-gray-700">
                            <span>Toplam Tutar:</span>
                            <span className="font-medium">{formatCurrency(discountedTotal)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ödemeleri Tamamla */}
                    <button
                      onClick={handleFinalizeSplit}
                      className={`w-full py-4 rounded-xl font-medium transition-all duration-200 ${
                        !equalPayments.every((p) => parseFloat(p.received) > 0)
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-100"
                      }`}
                      disabled={!equalPayments.every((p) => parseFloat(p.received) > 0)}
                    >
                      Ödemeleri Tamamla
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ALT KISIM */}
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
                  (paymentMethod === "nakit" && parsedReceived < discountedTotal) ||
                  (paymentMethod === "veresiye" && !selectedCustomer)
                }
                className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 ${
                  (paymentMethod === "nakit" && parsedReceived < discountedTotal) ||
                  (paymentMethod === "veresiye" && !selectedCustomer)
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-100"
                }`}
              >
                Ödemeyi Tamamla
              </button>
            )}

            {/* Split modunda:
                - Ürün bazında => en altta "Tüm Ödemeleri Tamamla" (kalan yoksa)
                - Eşit => "Ödemeleri Tamamla" butonu yukarıda
            */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;