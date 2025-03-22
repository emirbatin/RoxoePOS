import React, { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { exportService } from '../services/exportSevices'; // Doğru dosya yolu
import { Sale } from '../types/sales';
import { ProductStats } from '../types/product';
import { CashRegisterSession, CashTransaction } from '../types/cashRegister'; // Doğru tip tanımlamaları

// Dışa aktarma tiplerini tanımlayalım
export type FileType = 'excel' | 'pdf';
export type ReportType = 'sale' | 'product' | 'cash';

// ExportButton bileşeni için props interface'i
interface ExportButtonProps {
  currentTab: 'overview' | 'cash' | 'sales' | 'products';
  startDate: Date;
  endDate: Date;
  isLoading: boolean;
  sales: Sale[];
  cashData: {
    currentBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    veresiyeCollections: number;
    isActive: boolean;
    openingBalance: number;
    cashSalesTotal: number;
    cardSalesTotal: number;
    dailyData: Array<{
      date: string;
      deposits: number;
      withdrawals: number;
      veresiye: number;
      total: number;
    }>;
  };
  productStats: ProductStats[];
  closedSessions: CashRegisterSession[];
  transactions?: CashTransaction[]; 
}

const ExportButton: React.FC<ExportButtonProps> = ({
  currentTab,
  startDate,
  endDate,
  isLoading,
  sales,
  cashData,
  productStats,
  closedSessions,
  transactions = [] 
}) => {
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Dışa aktarma işlemi
  const handleExport = async (fileType: FileType, reportType: ReportType) => {
    setShowExportMenu(false);

    if (isLoading) return;

    try {
      const dateRangeString = exportService.formatDateRange(startDate, endDate);

      if (fileType === 'excel') {
        if (reportType === 'cash') {
          // Kasa raporu için data yapısı
          const cashExportData = {
            summary: {
              openingBalance: cashData.openingBalance,
              currentBalance: cashData.currentBalance,
              totalDeposits: cashData.totalDeposits,
              totalWithdrawals: cashData.totalWithdrawals,
              veresiyeCollections: cashData.veresiyeCollections,
              cashSalesTotal: cashData.cashSalesTotal,
              cardSalesTotal: cashData.cardSalesTotal,
            },
            dailyData: cashData.dailyData,
            closedSessions: closedSessions,
            transactions: transactions,
            salesData: sales.filter(s => s.status === 'completed'),
          };
          
          await exportService.exportCashDataToExcel(
            cashExportData,
            `Kasa Raporu ${dateRangeString}`
          );
        } else {
          await exportService.exportToExcel(
            sales,
            dateRangeString,
            reportType
          );
        }
      } else if (fileType === 'pdf') {
        if (reportType === 'cash') {
          alert('Kasa raporu PDF olarak henüz desteklenmiyor!');
        } else {
          await exportService.exportToPDF(
            sales,
            dateRangeString,
            reportType
          );
        }
      }
    } catch (error) {
      console.error('Dışa aktarma hatası:', error);
      alert('Dışa aktarma sırasında bir hata oluştu!');
    }
  };

  // Aktif tab için uygun dışa aktarma seçeneklerini getiren fonksiyon
  const getExportOptions = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <>
            <button
              onClick={() => handleExport('excel', 'sale')}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 transition-all"
            >
              Satış Raporu (Excel)
            </button>
            <button
              onClick={() => handleExport('pdf', 'sale')}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 transition-all"
            >
              Satış Raporu (PDF)
            </button>
          </>
        );
      
      case 'cash':
        return (
          <>
            <button
              onClick={() => handleExport('excel', 'cash')}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 transition-all"
            >
              Kasa Raporu (Excel)
            </button>
          </>
        );
      
      case 'sales':
        return (
          <>
            <button
              onClick={() => handleExport('excel', 'sale')}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 transition-all"
            >
              Satış Raporu (Excel)
            </button>
            <button
              onClick={() => handleExport('pdf', 'sale')}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 transition-all"
            >
              Satış Raporu (PDF)
            </button>
          </>
        );
      
      case 'products':
        return (
          <>
            <button
              onClick={() => handleExport('excel', 'product')}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 transition-all"
            >
              Ürün Raporu (Excel)
            </button>
            <button
              onClick={() => handleExport('pdf', 'product')}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 transition-all"
            >
              Ürün Raporu (PDF)
            </button>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowExportMenu(!showExportMenu)}
        className="flex items-center gap-2 py-2 px-3 rounded-md border border-gray-200 bg-white hover:border-indigo-300 transition-all"
        disabled={isLoading}
      >
        <Download size={16} className="text-gray-500" />
        <span className="text-gray-700 font-medium text-sm">
          {currentTab === 'overview' ? 'Rapor İndir' : 
           currentTab === 'cash' ? 'Kasa Raporu' :
           currentTab === 'sales' ? 'Satış Raporu' : 'Ürün Raporu'}
        </span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {showExportMenu && (
        <div className="absolute top-full right-0 mt-2 p-2 bg-white rounded-lg shadow-lg z-10 border border-gray-100 w-48 animate-in fade-in slide-in-from-top-5 duration-200">
          {getExportOptions()}
        </div>
      )}
    </div>
  );
};

export default ExportButton;