// hooks/useSales.ts

import { useState, useEffect } from "react";
import { Sale } from "../types/sales";
import { salesDB } from "../services/salesDB";

/**
 * Satış kayıtlarını çekmek ve isterseniz belirli aralıklarla yenilemek için
 * ortak bir hook.
 * @param autoRefreshInterval Otomatik yenileme süresi (ms). Örn: 30000 => 30 sn
 */
export function useSales(autoRefreshInterval?: number) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadSales() {
    setLoading(true);
    try {
      const allSales = await salesDB.getAllSales();
      setSales(allSales);
    } catch (err) {
      console.error("Satışlar yüklenirken hata:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSales();
    let intervalId: any;
    if (autoRefreshInterval) {
      intervalId = setInterval(loadSales, autoRefreshInterval);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefreshInterval]);

  return {
    sales,
    loading,
    refresh: loadSales,
  };
}