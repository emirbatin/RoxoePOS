import { useState, useEffect } from 'react';
import { cashRegisterService, CashTransactionType } from '../services/cashRegisterDB';

// Kasa verilerinin dönüş tipi
interface CashData {
  currentBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  veresiyeCollections: number;
  isActive: boolean;
  openingBalance: number;
  cashSalesTotal: number;
  cardSalesTotal: number;
  dailyData: {
    date: string;
    deposits: number;
    withdrawals: number;
    veresiye: number;
    total: number;
  }[];
}

/**
 * Kasa verilerini belirli bir tarih aralığı için getiren hook
 * @param startDate Başlangıç tarihi
 * @param endDate Bitiş tarihi
 * @returns Kasa verileri ve yükleme durumu
 */
export function useCashRegisterData(startDate: Date, endDate: Date) {
  const [loading, setLoading] = useState(true);
  const [cashData, setCashData] = useState<CashData>({
    currentBalance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    veresiyeCollections: 0,
    isActive: false,
    openingBalance: 0,
    cashSalesTotal: 0,
    cardSalesTotal: 0,
    dailyData: []
  });

  useEffect(() => {
    const loadCashData = async () => {
      try {
        setLoading(true);
        
        // Aktif kasa dönemi var mı?
        const activeSession = await cashRegisterService.getActiveSession();
        
        // Tüm kasa dönemlerini getir
        const allSessions = await cashRegisterService.getAllSessions();
        
        // Tarih aralığına göre filtrele
        const filteredSessions = allSessions.filter(session => {
          const sessionDate = new Date(session.openingDate);
          return sessionDate >= startDate && sessionDate <= endDate;
        });
        
        // Veri toplama değişkenleri
        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let veresiyeCollections = 0;
        let totalCashSales = 0;
        let totalCardSales = 0;
        let totalOpeningBalance = 0;
        const dailyTransactions: Record<string, any> = {};
        
        // Her dönem için işlemleri topla
        for (const session of filteredSessions) {
          try {
            // Dönem özeti verilerini topla
            totalOpeningBalance += session.openingBalance || 0;
            totalCashSales += session.cashSalesTotal || 0;
            totalCardSales += session.cardSalesTotal || 0;
            
            // Dönem detaylarını getir
            const sessionDetails = await cashRegisterService.getSessionDetails(session.id);
            
            // Her işlem için
            if (sessionDetails.transactions && sessionDetails.transactions.length > 0) {
              for (const tx of sessionDetails.transactions) {
                // İşlem tarihini al
                const txDate = new Date(tx.date);
                const dateStr = txDate.toISOString().split('T')[0];
                
                // Günlük veriler için hazırlık
                if (!dailyTransactions[dateStr]) {
                  dailyTransactions[dateStr] = {
                    date: dateStr,
                    deposits: 0,
                    withdrawals: 0,
                    veresiye: 0,
                    total: 0
                  };
                }
                
                // İşlem tipine göre sınıflandır
                const isDeposit = tx.type === CashTransactionType.DEPOSIT;
                const isWithdrawal = tx.type === CashTransactionType.WITHDRAWAL;
                const isVeresiye = tx.type === CashTransactionType.CREDIT_COLLECTION;
                
                if (isDeposit) {
                  totalDeposits += tx.amount;
                  dailyTransactions[dateStr].deposits += tx.amount;
                  dailyTransactions[dateStr].total += tx.amount;
                } else if (isWithdrawal) {
                  totalWithdrawals += tx.amount;
                  dailyTransactions[dateStr].withdrawals += tx.amount;
                  dailyTransactions[dateStr].total -= tx.amount;
                } else if (isVeresiye) {
                  // Veresiye tahsilatlarını hem toplam girişlere hem de ayrı olarak ekle
                  totalDeposits += tx.amount;
                  veresiyeCollections += tx.amount;
                  dailyTransactions[dateStr].deposits += tx.amount;
                  dailyTransactions[dateStr].veresiye += tx.amount;
                  dailyTransactions[dateStr].total += tx.amount;
                }
              }
            }
          } catch (error) {
            console.error(`Dönem detayları yüklenirken hata (${session.id}):`, error);
          }
        }
        
        // Günlük verileri tarihe göre sırala
        const sortedDailyData = Object.values(dailyTransactions).sort((a, b) => 
          a.date.localeCompare(b.date)
        );
        
        // Hesaplanan verileri state'e ata
        setCashData({
          currentBalance: activeSession ? 
            (activeSession.openingBalance + activeSession.cashSalesTotal + 
             activeSession.cashDepositTotal - activeSession.cashWithdrawalTotal) : 0,
          totalDeposits,
          totalWithdrawals,
          veresiyeCollections,
          isActive: !!activeSession,
          openingBalance: totalOpeningBalance,
          cashSalesTotal: totalCashSales,
          cardSalesTotal: totalCardSales,
          dailyData: sortedDailyData
        });
      } catch (error) {
        console.error("Kasa verileri yüklenirken hata:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCashData();
  }, [startDate, endDate]);
  
  return { cashData, loading };
}