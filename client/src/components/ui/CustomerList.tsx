import React from "react";
import {
  Edit,
  Trash2,
  AlertTriangle,
  CreditCard,
  Clock,
  AlertCircle,
  Eye,
  Tag,
  ReceiptText,
  Banknote,
  User
} from "lucide-react";
import { Customer, CustomerSummary, CreditTransaction } from "../../types/credit";
import { Column } from "../../types/table"; // Import the Column type
import { Table } from "./Table"; // Import the reusable Table component
import { useAlert } from "../AlertProvider";

// Tooltip bileşeni için TypeScript interface
interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

// Tooltip bileşeni
const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <div className="group relative flex">
      {children}
      <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {content}
        <div className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-800"></div>
      </div>
    </div>
  );
};

interface CustomerListProps {
  customers: Customer[];
  summaries: Record<number, CustomerSummary>;
  transactions?: Record<number, CreditTransaction[]>; // İşlemler için yeni prop
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: number) => void;
  onAddDebt: (customer: Customer) => void;
  onAddPayment: (customer: Customer) => void;
  onViewDetail: (customer: Customer) => void;
  approachingDueDays?: number; // Yaklaşan vadeler için gün sayısı
}

const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  summaries,
  transactions,
  onEdit,
  onDelete,
  onAddDebt,
  onAddPayment,
  onViewDetail,
  approachingDueDays = 7, // Varsayılan 7 gün
}) => {
  const { showError, confirm, showSuccess } = useAlert();
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  };

  const handleDelete = async (customer: Customer) => {
    if (customer.currentDebt > 0) {
      showError("Borcu olan müşteri silinemez!");
      return;
    }

    const confirmed = await confirm(
      `${customer.name} isimli müşteriyi silmek istediğinize emin misiniz?`
    );

    if (confirmed) {
      onDelete(customer.id);
      showSuccess("Müşteri Başarıyla Silindi");
    }
  };

  // Bugünü de dahil eden tarih karşılaştırma fonksiyonu (sadece saat/dakika farkından etkilenmemesi için)
  const isSameOrBefore = (date1: Date, date2: Date) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Sadece tarih kısmını karşılaştırmak için saat/dakika/saniye kısımlarını sıfırlıyoruz
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    
    return d1.getTime() <= d2.getTime();
  };
  
  const isSameOrAfter = (date1: Date, date2: Date) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Sadece tarih kısmını karşılaştırmak için saat/dakika/saniye kısımlarını sıfırlıyoruz
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    
    return d1.getTime() >= d2.getTime();
  };

  // Yaklaşan vadeler için kontrol fonksiyonu
  const hasApproachingDueDate = (customerId: number) => {
    if (!transactions || !transactions[customerId]) return false;
    
    // Müşteri borcu 0 ise yaklaşan vade göstermeyelim
    const customer = customers.find(c => c.id === customerId);
    if (customer && customer.currentDebt === 0) return false;
    
    const customerTransactions = transactions[customerId];
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Sadece tarih kısmı için saat sıfırlama
    
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + approachingDueDays);
    futureDate.setHours(23, 59, 59, 999); // Günün sonu
    
    // ÖNEMLİ: Sadece active durumundaki işlemleri kontrol ediyoruz! (status !== 'paid')
    return customerTransactions.some(
      tx => tx.type === 'debt' && 
           tx.status === 'active' && // ÖNEMLİ! Ödenmiş borçları dikkate almayalım
           tx.dueDate && 
           isSameOrAfter(new Date(tx.dueDate), now) && 
           isSameOrBefore(new Date(tx.dueDate), futureDate)
    );
  };

  // Yaklaşan vadeleri olan işlem sayısını hesapla
  const getApproachingDueCount = (customerId: number) => {
    if (!transactions || !transactions[customerId]) return 0;
    
    // Müşteri borcu 0 ise sıfır dön
    const customer = customers.find(c => c.id === customerId);
    if (customer && customer.currentDebt === 0) return 0;
    
    const customerTransactions = transactions[customerId];
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Sadece tarih kısmı için saat sıfırlama
    
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + approachingDueDays);
    futureDate.setHours(23, 59, 59, 999); // Günün sonu
    
    // ÖNEMLİ: Sadece active durumundaki işlemleri sayıyoruz! (status !== 'paid')
    return customerTransactions.filter(
      tx => tx.type === 'debt' && 
           tx.status === 'active' && // ÖNEMLİ! Ödenmiş borçları dikkate almayalım
           tx.dueDate && 
           isSameOrAfter(new Date(tx.dueDate), now) && 
           isSameOrBefore(new Date(tx.dueDate), futureDate)
    ).length;
  };

  // Yakın vadelerdeki en yakın tarihi bulma
  const getNextDueDate = (customerId: number) => {
    if (!transactions || !transactions[customerId]) return null;
    
    // Müşteri borcu 0 ise null dön
    const customer = customers.find(c => c.id === customerId);
    if (customer && customer.currentDebt === 0) return null;
    
    const customerTransactions = transactions[customerId];
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Sadece tarih kısmı için saat sıfırlama
    
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + approachingDueDays);
    futureDate.setHours(23, 59, 59, 999); // Günün sonu
    
    const approachingDues = customerTransactions
      .filter(
        tx => tx.type === 'debt' && 
             tx.status === 'active' && 
             tx.dueDate && 
             isSameOrAfter(new Date(tx.dueDate), now) && 
             isSameOrBefore(new Date(tx.dueDate), futureDate)
      )
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    
    return approachingDues.length > 0 ? new Date(approachingDues[0].dueDate!) : null;
  };

  // Define columns for the Table component
  const columns: Column<Customer>[] = [
    {
      key: "name",
      title: "Müşteri",
      render: (customer) => (
        <div className="font-medium text-gray-900">
          {customer.name}
          {customer.taxNumber && (
            <div className="text-sm text-gray-500">
              VN: {customer.taxNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "contact",
      title: "İletişim",
      render: (customer) => (
        <div className="text-sm">
          <div>{customer.phone}</div>
          {customer.address && (
            <div className="text-gray-500">{customer.address}</div>
          )}
        </div>
      ),
    },
    {
      key: "creditLimit",
      title: "Limit",
      render: (customer) => {
        const limitUsagePercent =
          (customer.currentDebt / customer.creditLimit) * 100;
        const isNearLimit = limitUsagePercent > 80;

        return (
          <div
            className={`${isNearLimit ? "text-orange-600" : "text-gray-600"}`}
          >
            <div className="flex items-center">
              <CreditCard size={16} className="mr-1" />
              <span className="font-medium text-gray-900">
                {formatCurrency(customer.creditLimit)}
              </span>
              {isNearLimit && <AlertCircle size={16} className="ml-1" />}
            </div>
            <div className="text-xs text-gray-500">{`Kullanım: %${limitUsagePercent.toFixed(
              0
            )}`}</div>
          </div>
        );
      },
    },
    {
      key: "currentDebt",
      title: "Mevcut Borç",
      render: (customer) => {
        const summary = summaries[customer.id];

        // İndirim varsa hesapla
        const hasDiscount = summary?.discountedSalesCount > 0;

        return (
          <div>
            <div className="font-medium text-gray-900">
              {formatCurrency(customer.currentDebt)}
            </div>

            {/* İndirim bilgisi */}
            {hasDiscount && (
              <div className="flex items-center text-xs text-green-600 my-1">
                <Tag size={12} className="mr-1" />
                {summary.discountedSalesCount} işlemde{" "}
                {formatCurrency(summary.totalDiscount || 0)} indirim
              </div>
            )}

            <div className="text-xs text-gray-500">
              {summary?.activeTransactions} aktif işlem
            </div>
          </div>
        );
      },
    },
    {
      key: "overdue",
      title: "Vadesi Geçen",
      render: (customer) => {
        const summary = summaries[customer.id];
        const hasOverdue = summary?.overdueTransactions > 0;

        return hasOverdue ? (
          <div className="text-red-600">
            <div className="flex items-center gap-1">
              <AlertTriangle size={16} />
              <span>{formatCurrency(summary.totalOverdue)}</span>
            </div>
            <div className="text-xs mt-1">
              {summary.overdueTransactions} işlem geçmiş
            </div>
          </div>
        ) : (
          <div className="text-green-600">Yok</div>
        );
      },
    },
    {
      key: "approachingDue",
      title: "Yaklaşan Vade",
      render: (customer) => {
        // Müşteri borcu 0 ise yaklaşan vade göstermeyelim
        if (customer.currentDebt === 0) {
          return <div className="text-gray-400">-</div>;
        }
        
        const hasApproaching = hasApproachingDueDate(customer.id);
        const approachingCount = getApproachingDueCount(customer.id);
        const nextDueDate = getNextDueDate(customer.id);
        
        // Bugün vadesi dolan var mı?
        const hasTodayDue = nextDueDate && 
          new Date(nextDueDate).setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0);
        
        if (hasApproaching) {
          return (
            <div className={hasTodayDue ? "text-red-600" : "text-amber-600"}>
              <div className="flex items-center gap-1">
                {hasTodayDue ? <AlertTriangle size={16} /> : <Clock size={16} />}
                <span>{approachingCount} işlem</span>
              </div>
              {nextDueDate && (
                <div className="text-xs mt-1 font-medium">
                  {hasTodayDue 
                    ? "Bugün son gün!" 
                    : `İlk vade: ${nextDueDate.toLocaleDateString("tr-TR")}`}
                </div>
              )}
            </div>
          );
        } else {
          return <div className="text-gray-400">-</div>;
        }
      },
    },
    {
      key: "lastTransaction",
      title: "Son İşlem",
      render: (customer) => {
        const summary = summaries[customer.id];
        return summary?.lastTransactionDate ? (
          <div className="flex items-center gap-1 text-gray-500">
            <Clock size={16} />
            {new Date(summary.lastTransactionDate).toLocaleDateString("tr-TR")}
          </div>
        ) : (
          <div className="text-gray-400">-</div>
        );
      },
    },
    {
      key: "actions",
      title: "İşlemler",
      render: (customer) => {
        const limitUsagePercent =
          (customer.currentDebt / customer.creditLimit) * 100;
        const isNearLimit = limitUsagePercent > 80;

        return (
          <div className="flex gap-1">
            <Tooltip content="Detay Görüntüle">
              <button
                onClick={() => onViewDetail(customer)}
                className="p-1 hover:bg-gray-100 rounded text-blue-600"
                type="button"
              >
                <User size={16} />
              </button>
            </Tooltip>
            
            <Tooltip content="Borç Ekle">
              <button
                onClick={() => onAddDebt(customer)}
                disabled={isNearLimit}
                className="p-1 hover:bg-gray-100 rounded text-red-600 disabled:text-gray-400"
                type="button"
              >
                <ReceiptText size={16} />
              </button>
            </Tooltip>
            
            <Tooltip content="Ödeme Al">
              <button
                onClick={() => onAddPayment(customer)}
                disabled={customer.currentDebt === 0}
                className="p-1 hover:bg-gray-100 rounded text-green-600 disabled:text-gray-400"
                type="button"
              >
                <Banknote size={16} />
              </button>
            </Tooltip>
            
            <Tooltip content="Düzenle">
              <button
                onClick={() => onEdit(customer)}
                className="p-1 hover:bg-gray-100 rounded text-gray-600"
                type="button"
              >
                <Edit size={16} />
              </button>
            </Tooltip>
            
            <Tooltip content="Sil">
              <button
                onClick={() => handleDelete(customer)}
                className="p-1 hover:bg-gray-100 rounded text-red-600"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <div className="overflow-x-auto">
      <Table<Customer, number>
        data={customers}
        columns={columns}
        idField="id"
        emptyMessage="Henüz müşteri kaydı bulunmuyor."
        totalColumns={{currentDebt: "sum", creditLimit: "sum"}}
        totalData={customers}
        showTotals={true}
      />
    </div>
  );
};

export default CustomerList;