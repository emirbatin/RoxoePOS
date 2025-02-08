import React from "react";
import {
  Edit,
  Trash2,
  AlertTriangle,
  CreditCard,
  DollarSign,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Customer, CustomerSummary } from "../types/credit";
import { Column } from "../types/table";  // Import the Column type
import { Table } from "../components/Table"; // Import the reusable Table component

interface CustomerListProps {
  customers: Customer[];
  summaries: Record<number, CustomerSummary>;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: number) => void;
  onAddDebt: (customer: Customer) => void;
  onAddPayment: (customer: Customer) => void;
  onViewDetail: (customer: Customer) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  summaries,
  onEdit,
  onDelete,
  onAddDebt,
  onAddPayment,
  onViewDetail,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  };

  const handleDelete = (customer: Customer) => {
    if (customer.currentDebt > 0) {
      alert("Borcu olan müşteri silinemez!");
      return;
    }
    if (window.confirm(`${customer.name} isimli müşteriyi silmek istediğinize emin misiniz?`)) {
      onDelete(customer.id);
    }
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
            <div className="text-sm text-gray-500">VN: {customer.taxNumber}</div>
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
          {customer.address && <div className="text-gray-500">{customer.address}</div>}
        </div>
      ),
    },
    {
      key: "creditLimit",
      title: "Limit",
      render: (customer) => {
        const limitUsagePercent = (customer.currentDebt / customer.creditLimit) * 100;
        const isNearLimit = limitUsagePercent > 80;

        return (
          <div className={`${isNearLimit ? "text-orange-600" : "text-gray-600"}`}>
            <div className="flex items-center">
              <CreditCard size={16} className="mr-1" />
              <span className="font-medium text-gray-900">{formatCurrency(customer.creditLimit)}</span>
              {isNearLimit && <AlertCircle size={16} className="ml-1" />}
            </div>
            <div className="text-xs text-gray-500">{`Kullanım: %${limitUsagePercent.toFixed(0)}`}</div>
          </div>
        );
      },
    },
    {
      key: "currentDebt",
      title: "Mevcut Borç",
      render: (customer) => {
        const summary = summaries[customer.id];
        return (
          <div>
            <div className="font-medium text-gray-900">{formatCurrency(customer.currentDebt)}</div>
            <div className="text-xs text-gray-500">{summary?.activeTransactions} aktif işlem</div>
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
          <div className="text-red-600 flex items-center gap-1">
            <AlertTriangle size={16} />
            {formatCurrency(summary.totalOverdue)}
          </div>
        ) : (
          <div className="text-green-600">Yok</div>
        );
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
        const limitUsagePercent = (customer.currentDebt / customer.creditLimit) * 100;
        const isNearLimit = limitUsagePercent > 80;

        return (
          <div className="flex gap-1">
            <button
              onClick={() => onViewDetail(customer)}
              className="p-1 hover:bg-gray-100 rounded text-primary-600"
              title="Detay"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={() => onAddDebt(customer)}
              disabled={isNearLimit}
              className="p-1 hover:bg-gray-100 rounded text-blue-600 disabled:text-gray-400"
              title="Borç Ekle"
            >
              <DollarSign size={16} />
            </button>
            <button
              onClick={() => onAddPayment(customer)}
              disabled={customer.currentDebt === 0}
              className="p-1 hover:bg-gray-100 rounded text-green-600 disabled:text-gray-400"
              title="Ödeme Al"
            >
              <DollarSign size={16} />
            </button>
            <button
              onClick={() => onEdit(customer)}
              className="p-1 hover:bg-gray-100 rounded text-gray-600"
              title="Düzenle"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => handleDelete(customer)}
              className="p-1 hover:bg-gray-100 rounded text-red-600"
              title="Sil"
            >
              <Trash2 size={16} />
            </button>
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
      />
    </div>
  );
};

export default CustomerList;