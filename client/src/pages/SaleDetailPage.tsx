// pages/SaleDetailPage.tsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Printer,
  Clock,
  CreditCard,
  XCircle,
  RotateCcw,
} from "lucide-react";
import PageLayout from "../components/layout/PageLayout";
import ReceiptModal from "../components/modals/ReceiptModal";
import ReasonModal from "../components/modals/ReasonModal";
import Button from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { Column } from "../types/table";
import { CartItem } from "../types/pos";
import { formatCurrency, formatVatRate } from "../utils/vatUtils";
import { salesDB } from "../services/salesDB"; 
import { creditService } from "../services/creditServices";
import { useAlert } from "../components/AlertProvider";
import { Sale } from "../types/sales";
import { ReceiptInfo } from "../types/receipt";

const SaleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();   // route param
  const navigate = useNavigate();
  const { showSuccess, showError, confirm } = useAlert();

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptInfo | null>(null);

  // 1) Tekil satışı yükleme
  useEffect(() => {
    async function fetchSale() {
      if (!id) return;
      try {
        setLoading(true);
        const saleData = await salesDB.getSaleById(id); // ID'ye göre çekiyoruz
        setSale(saleData || null);
      } catch (error) {
        console.error("Satış verisi yüklenirken hata:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSale();
  }, [id]);

  // 2) Ürün tablosu kolonları
  const columns: Column<CartItem>[] = [
    {
      key: "name",
      title: "Ürün",
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900">{item.name}</div>
          <div className="text-sm text-gray-500">{item.category}</div>
        </div>
      ),
    },
    {
      key: "salePrice",
      title: "Birim Fiyat",
      className: "text-right",
      render: (item) => <div className="text-sm">{formatCurrency(item.salePrice)}</div>,
    },
    {
      key: "quantity",
      title: "Miktar",
      className: "text-right",
      render: (item) => <div className="text-sm">{item.quantity}</div>,
    },
    {
      key: "vatRate",
      title: "KDV",
      className: "text-right",
      render: (item) => <div className="text-sm">{formatVatRate(item.vatRate)}</div>,
    },
    {
      key: "total",
      title: "Toplam",
      className: "text-right text-sm font-medium",
      render: (item) => (
        <div>{formatCurrency(item.priceWithVat * item.quantity)}</div>
      ),
    },
  ];

  // 3) Fişi görüntüleme fonksiyonu
  const handleOpenReceiptModal = () => {
    if (!sale) return;
    const receiptData: ReceiptInfo = {
      ...sale,
      subtotal: sale.subtotal,
      vatAmount: sale.vatAmount,
      total: sale.total,
      items: sale.items,
      date: sale.date,
    };
    setCurrentReceipt(receiptData);
    setShowReceiptModal(true);
  };

  // 4) Satış iptal (Cancel)
  const handleCancelConfirm = async (reason: string) => {
    if (!sale) return;
    try {
      const updatedSale = await salesDB.cancelSale(sale.id, reason);
      if (updatedSale) {
        setSale(updatedSale);
        showSuccess("Satış başarıyla iptal edildi.");
      } else {
        showError("Satış iptal edilirken bir hata oluştu!");
      }
    } catch (error) {
      console.error("Satış iptali sırasında hata:", error);
      showError("Satış iptal edilirken bir hata oluştu!");
    } finally {
      setShowCancelModal(false);
    }
  };

  // 5) Satış iade (Refund)
  const handleRefundConfirm = async (reason: string) => {
    if (!sale) return;
    try {
      const updatedSale = await salesDB.refundSale(sale.id, reason);
      if (updatedSale) {
        setSale(updatedSale);
        showSuccess("İade işlemi başarıyla tamamlandı.");
      } else {
        showError("İade işlemi sırasında bir hata oluştu!");
      }
    } catch (error) {
      console.error("İade işlemi sırasında hata:", error);
      showError("İade işlemi sırasında bir hata oluştu!");
    } finally {
      setShowRefundModal(false);
    }
  };

  // Yükleniyorsa
  if (loading) {
    return (
      <PageLayout title="Satış Detayı">
        <div className="p-8 text-center">Yükleniyor...</div>
      </PageLayout>
    );
  }

  // Satış yoksa
  if (!sale) {
    return (
      <PageLayout title="Satış Detayı">
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-4">Satış bulunamadı</div>
          <Button variant="primary" onClick={() => navigate("/history")}>
            Satış Listesine Dön
          </Button>
        </div>
      </PageLayout>
    );
  }

  // Sale verisi varsa göster
  return (
    <PageLayout title="Satış Detayı">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate("/history")}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="mr-2" size={20} />
          Satış Listesine Dön
        </button>
        <div className="flex gap-2">
          <Button onClick={handleOpenReceiptModal} icon={Printer}>
            Fişi Yazdır / Görüntüle
          </Button>
        </div>
      </div>

      {/* Satış ve Ürün Bilgileri */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol kısım: Ürünler Tablosu */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">Satış Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Fiş No</div>
                <div className="font-medium">{sale.receiptNo}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Tarih</div>
                <div className="font-medium">
                  {new Date(sale.date).toLocaleString("tr-TR")}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Toplam Tutar</div>
                <div className="font-medium text-lg">
                  {formatCurrency(sale.total)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Ödeme Yöntemi</div>
                <div className="font-medium">
                  {sale.paymentMethod === "nakit" && "💵 Nakit"}
                  {sale.paymentMethod === "kart" && "💳 Kart"}
                  {sale.paymentMethod === "veresiye" && "📝 Veresiye"}
                  {sale.paymentMethod === "nakitpos" && "💵 POS (Nakit)"}
                  {sale.paymentMethod === "mixed" && "Karışık (Split)"}
                </div>
                {/* Karışık ödeme detayları varsa göster */}
                {sale.paymentMethod === "mixed" && sale.splitDetails && (
                  <div className="mt-4 p-4 border rounded bg-gray-50">
                    <h3 className="font-semibold mb-2">Karışık Ödeme Detayları</h3>
                    {/* Ürün bazında ödeme */}
                    {sale.splitDetails.productPayments &&
                      sale.splitDetails.productPayments.length > 0 && (
                        <>
                          <h4 className="text-sm font-medium mb-2">
                            Ürün Bazında Split
                          </h4>
                          <ul className="space-y-1 text-sm">
                            {sale.splitDetails.productPayments.map((p, idx) => (
                              <li key={idx} className="flex justify-between">
                                <span>
                                  Ürün ID #{p.itemId} -
                                  {p.paymentMethod === "veresiye"
                                    ? "Veresiye"
                                    : p.paymentMethod === "kart"
                                    ? "Kredi Kartı"
                                    : p.paymentMethod === "nakitpos"
                                    ? "POS (Nakit)"
                                    : "Nakit"}
                                  {p.customer && ` (${p.customer.name})`}
                                </span>
                                <span className="font-medium text-gray-700">
                                  {formatCurrency(p.received)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    {/* Eşit bölüşüm ödeme */}
                    {sale.splitDetails.equalPayments &&
                      sale.splitDetails.equalPayments.length > 0 && (
                        <>
                          <h4 className="mt-4 text-sm font-medium mb-2">
                            Eşit Bölüşüm Split
                          </h4>
                          <ul className="space-y-1 text-sm">
                            {sale.splitDetails.equalPayments.map((p, idx) => (
                              <li key={idx} className="flex justify-between">
                                <span>
                                  Kişi {idx + 1} -
                                  {p.paymentMethod === "veresiye"
                                    ? "Veresiye"
                                    : p.paymentMethod === "kart"
                                    ? "Kredi Kartı"
                                    : p.paymentMethod === "nakitpos"
                                    ? "POS (Nakit)"
                                    : "Nakit"}
                                  {p.customer && ` (${p.customer.name})`}
                                </span>
                                <span className="font-medium text-gray-700">
                                  {formatCurrency(p.received)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                  </div>
                )}
              </div>

              {/* Nakit ödeme ise (cashReceived, changeAmount) */}
              {sale.paymentMethod === "nakit" && sale.cashReceived && (
                <>
                  <div>
                    <div className="text-sm text-gray-500">Alınan</div>
                    <div className="font-medium">
                      {formatCurrency(sale.cashReceived)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Para Üstü</div>
                    <div className="font-medium">
                      {formatCurrency(sale.changeAmount || 0)}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Ürünler Tablosu */}
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Ürünler</h2>
            </div>
            <Table<CartItem, number>
              data={sale.items}
              columns={columns}
              idField="id"
              className="w-full"
              emptyMessage="Bu satışta ürün bulunmuyor."
            />
            {/* Toplam Bilgiler */}
            <div className="bg-gray-50 p-4 border-t">
              <div className="flex justify-end space-y-2 text-sm">
                <div className="w-48 space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>Ara Toplam:</span>
                    <span>{formatCurrency(sale.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>KDV:</span>
                    <span>{formatCurrency(sale.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Toplam:</span>
                    <span>{formatCurrency(sale.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ kısım: Durum Bilgisi, İşlem Geçmişi vb. */}
        <div className="space-y-6">
          {/* Durum Bilgisi */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Durum Bilgisi</h2>
            <div className="space-y-4">
              <div
                className={`p-3 rounded-lg ${
                  sale.status === "completed"
                    ? "bg-green-50 text-green-700"
                    : sale.status === "cancelled"
                    ? "bg-red-50 text-red-700"
                    : "bg-orange-50 text-orange-700"
                }`}
              >
                <div className="font-medium">
                  {sale.status === "completed" && "Tamamlandı"}
                  {sale.status === "cancelled" && "İptal Edildi"}
                  {sale.status === "refunded" && "İade Edildi"}
                </div>
                {(sale.cancelReason || sale.refundReason) && (
                  <div className="text-sm mt-1">
                    {sale.cancelReason && `İptal sebebi: ${sale.cancelReason}`}
                    {sale.refundReason && `İade sebebi: ${sale.refundReason}`}
                  </div>
                )}
              </div>

              {sale.status === "completed" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <XCircle className="mr-2" size={20} />
                    İptal Et
                  </button>
                  <button
                    onClick={() => setShowRefundModal(true)}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50"
                  >
                    <RotateCcw className="mr-2" size={20} />
                    İade Al
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* İşlem Geçmişi (örnek) */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">İşlem Geçmişi</h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="text-primary-600">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="text-sm font-medium">Satış Yapıldı</div>
                  <div className="text-xs text-gray-500">
                    {new Date(sale.date).toLocaleString("tr-TR")}
                  </div>
                </div>
              </div>

              {sale.status !== "completed" && (
                <div className="flex gap-3">
                  <div className="text-red-600">
                    <XCircle size={20} />
                  </div>
                  <div>
                    {sale.status === "cancelled" ? (
                      <>
                        <div className="text-sm font-medium">Satış İptal Edildi</div>
                        <div className="text-xs text-gray-500">
                          {sale.cancelDate &&
                            new Date(sale.cancelDate).toLocaleString("tr-TR")}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {sale.cancelReason}
                        </div>
                      </>
                    ) : sale.status === "refunded" ? (
                      <>
                        <div className="text-sm font-medium">Satış İade Edildi</div>
                        <div className="text-xs text-gray-500">
                          {sale.refundDate &&
                            new Date(sale.refundDate).toLocaleString("tr-TR")}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {sale.refundReason}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ReasonModal: İptal */}
      <ReasonModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelConfirm}
        title="Satış İptali"
        actionText="İptal Et"
        type="cancel"
      />

      {/* ReasonModal: İade */}
      <ReasonModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onConfirm={handleRefundConfirm}
        title="Satış İadesi"
        actionText="İade Et"
        type="refund"
      />

      {/* ReceiptModal */}
      {currentReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setCurrentReceipt(null);
          }}
          receiptData={currentReceipt}
        />
      )}
    </PageLayout>
  );
};

export default SaleDetailPage;