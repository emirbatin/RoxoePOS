import React, { useState, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { exportService } from '../services/exportSevices'; // Doğru dosya yolu
import { Sale } from '../types/sales';
import { ProductStats } from '../types/product';
import { CashRegisterSession, CashTransaction } from '../types/cashRegister'; // Doğru tip tanımlamaları
import { cashRegisterService } from '../services/cashRegisterDB';

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
  const [generatedDailyData, setGeneratedDailyData] = useState<typeof cashData.dailyData>([]);
  
  // Eğer cashData.dailyData boşsa, otomatik olarak günlük veri oluştur
  useEffect(() => {
    // Günlük verileri hazırla (eğer boşsa)
    if (!cashData.dailyData || cashData.dailyData.length === 0) {
      const today = new Date().toLocaleDateString('tr-TR');
      const generatedData = [{
        date: today,
        deposits: cashData.totalDeposits,
        withdrawals: cashData.totalWithdrawals,
        veresiye: cashData.veresiyeCollections,
        total: cashData.totalDeposits - cashData.totalWithdrawals + cashData.veresiyeCollections
      }];
      setGeneratedDailyData(generatedData);
    } else {
      setGeneratedDailyData(cashData.dailyData);
    }
  }, [cashData]);

  // Dışa aktarma işlemi
  // ExportButton.tsx dosyasında yaklaşık satır 75-145 arasında
// handleExport fonksiyonunu şu şekilde güncelleyin:

const handleExport = async (fileType: FileType, reportType: ReportType) => {
  setShowExportMenu(false);

  if (isLoading) return;

  try {
    const dateRangeString = exportService.formatDateRange(startDate, endDate);

    if (fileType === 'excel') {
      if (reportType === 'cash') {
        // Aktif oturumu al
        const activeSession = await cashRegisterService.getActiveSession();
        
        // Tüm işlemleri ve günlük verileri hazırla
        let allTransactions: CashTransaction[] = [];
        let allVeresiyeTransactions: CashTransaction[] = [];
        let sessionIds: string[] = [];
        
        // 1. Aktif oturum ve kapalı oturum ID'lerini topla
        if (activeSession) {
          sessionIds.push(activeSession.id);
        }
        
        if (closedSessions && closedSessions.length > 0) {
          sessionIds = [...sessionIds, ...closedSessions.map(s => s.id)];
        }
        
        // 2. Tüm oturumların işlemlerini al
        for (const sessionId of sessionIds) {
          try {
            const sessionDetails = await cashRegisterService.getSessionDetails(sessionId);
            if (sessionDetails.transactions && sessionDetails.transactions.length > 0) {
              // Her bir işlem için tarih ve oturum bilgisini ekle
              const session = sessionDetails.session;
              const enrichedTransactions = sessionDetails.transactions.map(tx => ({
                ...tx,
                sessionName: session ? `Oturum #${session.id.substring(0, 8)}` : 'Bilinmeyen Oturum',
                formattedDate: new Date(tx.date).toLocaleString('tr-TR')
              }));
              
              allTransactions = [...allTransactions, ...enrichedTransactions];
            }
          } catch (error) {
            console.error(`Oturum detayları alınırken hata (${sessionId}):`, error);
          }
        }
        
        // 3. Veresiye işlemlerini filtrele
        allVeresiyeTransactions = allTransactions.filter(t => 
          (t.description?.toLowerCase().includes('veresiye') || 
          t.description?.toLowerCase().includes('tahsilat'))
        );
        
        // 4. Günlük verileri daha açıklayıcı hale getir
        const finalDailyData = cashData.dailyData.length > 0 
          ? cashData.dailyData.map(day => ({
              ...day,
              description: `${day.date} - ${day.deposits > 0 ? 'Nakit Giriş: ' + day.deposits.toFixed(2) + '₺' : ''} ${day.withdrawals > 0 ? 'Nakit Çıkış: ' + day.withdrawals.toFixed(2) + '₺' : ''} ${day.veresiye > 0 ? 'Veresiye Tahsilatı: ' + day.veresiye.toFixed(2) + '₺' : ''}`.trim()
            }))
          : [{
              date: new Date().toLocaleDateString('tr-TR'),
              deposits: cashData.totalDeposits,
              withdrawals: cashData.totalWithdrawals,
              veresiye: cashData.veresiyeCollections,
              total: cashData.totalDeposits - cashData.totalWithdrawals + cashData.veresiyeCollections,
              description: 'Günlük Özet'
            }];
        
        console.log('Excel verisi hazırlanıyor:');
        console.log('- İşlem geçmişi:', allTransactions.length);
        console.log('- Veresiye işlemleri:', allVeresiyeTransactions.length);
        console.log('- Günlük veriler:', finalDailyData.length);
        
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
          dailyData: finalDailyData,
          closedSessions: closedSessions || [],
          transactions: allTransactions,
          veresiyeTransactions: allVeresiyeTransactions,
          salesData: sales.filter(s => s.status === 'completed'),
          productSummary: productStats.map(product => ({
            productName: product.name,
            category: product.category || 'Kategori Yok',
            totalSales: product.quantity,
            totalRevenue: product.revenue,
            totalProfit: product.profit,
            profitMargin: product.profitMargin || 0
          }))
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
      // PDF kodları aynı kalabilir
    }
  } catch (error) {
    console.error('Dışa aktarma hatası:', error);
    alert('Dışa aktarma sırasında bir hata oluştu! Detay: ' + error);
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
                onClick={() => {
                  console.log('Kasa Raporu Export veriler:');
                  console.log('Günlük Veriler:', cashData.dailyData);
                  console.log('İşlem geçmişi:', transactions);
                  console.log('Veresiye işlemleri:', transactions.filter(t => 
                    t.description?.toLowerCase().includes('veresiye') || 
                    t.description?.toLowerCase().includes('tahsilat')
                  ));
                  console.log('Generatedaily data:', generatedDailyData);
                  handleExport('excel', 'cash');
                }}
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