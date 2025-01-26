import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Printer,
  Clock,
  CreditCard,
  User,
  XCircle,
  RotateCcw,
  FileText,
} from "lucide-react";

import { Sale } from "../types/sales";
import { ReceiptInfo } from "../types/receipt";

import { salesDB } from "../services/salesDB";
import { receiptService } from "../services/receiptService";

import {
  calculateCartTotals,
  calculateCartItemTotals,
  formatCurrency,
  formatVatRate,
} from "../utils/vatUtils";

import ReasonModal from "../components/ReasonModal";
import Button from "../components/Button";

const SaleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  useEffect(() => {
    const fetchSale = async () => {
      if (id) {
        try {
          const saleData = await salesDB.getSaleById(id);
          setSale(saleData);
        } catch (error) {
          console.error("Satış verisi yüklenirken hata:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchSale();
  }, [id]);

  const handlePrint = async () => {
    if (!sale) return;

    try {
      const receiptData: ReceiptInfo = {
        ...sale,
        subtotal: sale.subtotal,
        vatAmount: sale.vatAmount,
        total: sale.total,
        items: sale.items,
        date: sale.date,
      };

      const result = await receiptService.printReceipt(receiptData);
      if (result) {
        console.log("Fiş yazdırıldı");
      } else {
        alert("Fiş yazdırılırken bir hata oluştu!");
      }
    } catch (error) {
      console.error("Yazdırma hatası:", error);
      alert("Fiş yazdırılırken bir hata oluştu!");
    }
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!sale) return;

    try {
      const updatedSale = await salesDB.cancelSale(sale.id, reason);
      if (updatedSale) {
        setSale(updatedSale);
        alert("Satış başarıyla iptal edildi.");
      } else {
        alert("Satış iptal edilirken bir hata oluştu!");
      }
    } catch (error) {
      console.error("Satış iptali sırasında hata:", error);
      alert("Satış iptal edilirken bir hata oluştu!");
    } finally {
      setShowCancelModal(false);
    }
  };

  const handleRefundConfirm = async (reason: string) => {
    if (!sale) return;

    try {
      const updatedSale = await salesDB.refundSale(sale.id, reason);
      if (updatedSale) {
        setSale(updatedSale);
        alert("İade işlemi başarıyla tamamlandı.");
      } else {
        alert("İade işlemi sırasında bir hata oluştu!");
      }
    } catch (error) {
      console.error("İade işlemi sırasında hata:", error);
      alert("İade işlemi sırasında bir hata oluştu!");
    } finally {
      setShowRefundModal(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Yükleniyor...</div>;
  }

  if (!sale) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-500 mb-4">Satış bulunamadı</div>
        <button
          onClick={() => navigate("/history")}
          className="text-primary-600 hover:text-primary-700"
        >
          Satış Listesine Dön
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Üst Bar */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate("/history")}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="mr-2" size={20} />
          Satış Listesine Dön
        </button>
        <div className="flex gap-2">
          <Button onClick={handlePrint} icon={Printer}>
            Fişi Yazdır
          </Button>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Panel - Satış Detayları */}
        <div className="lg:col-span-2 space-y-6">
          {/* Satış Özeti */}
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
                  {sale.date.toLocaleString("tr-TR")}
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
                  {sale.paymentMethod === "nakit" ? "💵 Nakit" : "💳 Kart"}
                </div>
              </div>
              {sale.paymentMethod === "nakit" && sale.cashReceived && (
                <>
                  <div>
                    <div className="text-sm text-gray-500">Alınan</div>
                    <div className="font-medium">
                      {formatCurrency(sale.cashReceived || 0)}
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

          {/* Ürün Listesi */}
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Ürünler</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ürün
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Birim Fiyat
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Miktar
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      KDV
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Toplam
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {item.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.category}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {formatVatRate(item.vatRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {formatCurrency(item.price)} +{" "}
                        {formatVatRate(item.vatRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-4 text-right font-medium"
                    >
                      Toplam
                    </td>
                    <td className="px-6 py-4 text-right text-lg font-bold">
                      {formatCurrency(sale.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Sağ Panel - Durum ve İşlem Geçmişi */}
        <div className="space-y-6">
          {/* Durum Kartı */}
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

          {/* İşlem Geçmişi */}
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
                    {sale.date.toLocaleString("tr-TR")}
                  </div>
                </div>
              </div>
              {sale.status !== "completed" && (
                <div className="flex gap-3">
                  <div className="text-red-600">
                    <XCircle size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {sale.status === "cancelled"
                        ? "Satış İptal Edildi"
                        : "Ürün İade Edildi"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {sale.refundDate?.toLocaleString("tr-TR")}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {sale.cancelReason || sale.refundReason}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* İptal Modalı */}
      <ReasonModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelConfirm}
        title="Satış İptali"
        actionText="İptal Et"
        type="cancel"
      />

      {/* İade Modalı */}
      <ReasonModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onConfirm={handleRefundConfirm}
        title="Satış İadesi"
        actionText="İade Et"
        type="refund"
      />
    </div>
  );
};

export default SaleDetailPage;
